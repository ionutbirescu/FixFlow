package com.fixflow.contracts;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import com.fixflow.contracts.ai.AiReportResult;
import com.fixflow.contracts.api.CreateReportResponse;
import com.fixflow.contracts.api.CreateUserRequest;
import com.fixflow.contracts.api.ErrorResponse;
import com.fixflow.contracts.api.LoginRequest;
import com.fixflow.contracts.api.LoginResponse;
import com.fixflow.contracts.api.MachineDto;
import com.fixflow.contracts.api.MachineRequest;
import com.fixflow.contracts.api.MaintenanceEventDto;
import com.fixflow.contracts.api.PageResponse;
import com.fixflow.contracts.api.ReportDetailDto;
import com.fixflow.contracts.api.ReportSummaryDto;
import com.fixflow.contracts.api.UserDto;
import com.fixflow.contracts.model.MaintenanceType;
import com.fixflow.contracts.model.ReportStatus;
import com.fixflow.contracts.model.Role;
import com.fixflow.contracts.model.Severity;
import com.fixflow.contracts.webhook.ReportReadyWebhook;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.yaml.snakeyaml.Yaml;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

/**
 * Keeps {@code contracts/openapi.yaml} and the Java records in sync: every endpoint of the shared contract is
 * in the spec on the right server, every {@code $ref} resolves, and each schema has exactly the JSON fields
 * the matching record serializes to.
 */
@SuppressWarnings("unchecked")
class OpenApiContractTest {

    private static final String S1 = "http://localhost:8081";
    private static final String S2 = "http://localhost:8082";

    private static Map<String, Object> spec;

    @BeforeAll
    static void loadSpec() throws Exception {
        try (Reader reader = Files.newBufferedReader(Path.of("openapi.yaml"))) {
            spec = new Yaml().load(reader);
        }
    }

    @Test
    void everyContractEndpointIsOnItsServer() {
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("POST /auth/login", S1);
        expected.put("POST /auth/users", S1);
        expected.put("POST /reports", S1);
        expected.put("POST /machines", S1);
        expected.put("PUT /machines/{id}", S1);
        expected.put("DELETE /machines/{id}", S1);
        expected.put("POST " + ReportReadyWebhook.PATH, S1);
        expected.put("GET /reports", S2);
        expected.put("GET /reports/{id}", S2);
        expected.put("GET /machines", S2);
        expected.put("GET /machines/{id}/history", S2);
        expected.put("GET /images/{id}", S2);

        Map<String, String> actual = new LinkedHashMap<>();
        map(spec, "paths").forEach((path, item) -> ((Map<String, Object>) item).forEach((method, op) -> {
            List<Map<String, Object>> servers = (List<Map<String, Object>>) ((Map<String, Object>) op).get("servers");
            actual.put(method.toUpperCase() + " " + path, servers == null ? null : (String) servers.get(0).get("url"));
        }));

        assertThat(actual).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void everyRefResolves() {
        List<String> refs = new ArrayList<>();
        collectRefs(spec, refs);

        assertThat(refs).isNotEmpty().allSatisfy(ref -> assertThat(resolve(ref)).as(ref).isNotNull());
    }

    static Stream<Arguments> mirroredSchemas() {
        return Stream.of(
                arguments("LoginRequest", LoginRequest.class),
                arguments("LoginResponse", LoginResponse.class),
                arguments("CreateUserRequest", CreateUserRequest.class),
                arguments("UserDto", UserDto.class),
                arguments("CreateReportResponse", CreateReportResponse.class),
                arguments("MachineRequest", MachineRequest.class),
                arguments("MachineDto", MachineDto.class),
                arguments("MaintenanceEventDto", MaintenanceEventDto.class),
                arguments("ReportSummaryDto", ReportSummaryDto.class),
                arguments("ReportSummaryPage", PageResponse.class),
                arguments("ReportDetailDto", ReportDetailDto.class),
                arguments("AiReportResult", AiReportResult.class),
                arguments("ReportReadyWebhook", ReportReadyWebhook.class),
                arguments("ErrorResponse", ErrorResponse.class));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("mirroredSchemas")
    void schemaHasTheRecordsJsonFields(String schema, Class<?> type) {
        ObjectMapper mapper = new ObjectMapper();
        List<String> jsonFields = mapper.getSerializationConfig()
                .introspect(mapper.constructType(type))
                .findProperties().stream()
                .map(BeanPropertyDefinition::getName)
                .toList();

        assertThat(map(schemas(), schema, "properties").keySet()).containsExactlyInAnyOrderElementsOf(jsonFields);
    }

    static Stream<Arguments> mirroredEnums() {
        return Stream.of(
                arguments("Role", Role.class),
                arguments("ReportStatus", ReportStatus.class),
                arguments("Severity", Severity.class),
                arguments("MaintenanceType", MaintenanceType.class));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("mirroredEnums")
    void enumHasTheJavaValues(String schema, Class<? extends Enum<?>> type) {
        List<String> javaValues = Arrays.stream(type.getEnumConstants()).map(Enum::name).toList();

        assertThat((List<String>) map(schemas(), schema).get("enum")).containsExactlyElementsOf(javaValues);
    }

    private static Map<String, Object> schemas() {
        return map(spec, "components", "schemas");
    }

    private static Map<String, Object> map(Map<String, Object> root, String... keys) {
        Map<String, Object> node = root;
        for (String key : keys) {
            node = (Map<String, Object>) node.get(key);
            assertThat(node).as(String.join("/", keys)).isNotNull();
        }
        return node;
    }

    private static Object resolve(String ref) {
        Object node = spec;
        for (String part : ref.substring("#/".length()).split("/")) {
            if (!(node instanceof Map<?, ?> m) || !m.containsKey(part)) {
                return null;
            }
            node = m.get(part);
        }
        return node;
    }

    private static void collectRefs(Object node, List<String> refs) {
        if (node instanceof Map<?, ?> m) {
            m.forEach((k, v) -> {
                if ("$ref".equals(k)) {
                    refs.add((String) v);
                } else {
                    collectRefs(v, refs);
                }
            });
        } else if (node instanceof List<?> list) {
            list.forEach(item -> collectRefs(item, refs));
        }
    }
}
