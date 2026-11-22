package com.fixflow.contracts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixflow.contracts.ai.AiReportResult;
import com.fixflow.contracts.api.ReportDetailDto;
import com.fixflow.contracts.event.ReportCreatedEvent;
import com.fixflow.contracts.model.ReportStatus;
import com.fixflow.contracts.model.Severity;
import com.fixflow.contracts.webhook.ReportReadyWebhook;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Checks the JSON shapes fixed in the shared contracts. Uses a plain ObjectMapper (dates as timestamps by
 * default) to prove the annotations alone keep dates as ISO-8601 strings, whatever mapper a module uses.
 */
class ContractJsonTest {

    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    private final UUID reportId = UUID.fromString("3f0e2c1a-5b6d-4e7f-8a9b-0c1d2e3f4a5b");
    private final UUID imageId = UUID.fromString("6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f");
    private final UUID machineId = UUID.fromString("0b6e1f2a-3c4d-4e5f-9a6b-7c8d9e0f1a2b");
    private final UUID userId = UUID.fromString("9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a");

    @Test
    void aiReportResultUsesContractFieldNames() throws Exception {
        var result = new AiReportResult(imageId, "Bearing wear", Severity.HIGH,
                List.of("Replace bearing", "Check lubrication"), LocalDate.of(2026, 12, 15));

        JsonNode json = mapper.valueToTree(result);

        assertThat(json.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("id_image", "report", "severity", "recommendations", "nextServiceDate");
        assertThat(json.get("id_image").asText()).isEqualTo(imageId.toString());
        assertThat(json.get("severity").asText()).isEqualTo("HIGH");
        assertThat(json.get("nextServiceDate").asText()).isEqualTo("2026-12-15");
        assertThat(mapper.treeToValue(json, AiReportResult.class)).isEqualTo(result);
    }

    @Test
    void reportCreatedEventHasIsoUtcTimestamp() throws Exception {
        var event = new ReportCreatedEvent(reportId, imageId, machineId, userId, "Oil leak under the press",
                Instant.parse("2026-11-22T14:05:00Z"));

        JsonNode json = mapper.valueToTree(event);

        assertThat(json.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("reportId", "imageId", "machineId", "userId", "description", "createdAt");
        assertThat(json.get("createdAt").asText()).isEqualTo("2026-11-22T14:05:00Z");
        assertThat(mapper.treeToValue(json, ReportCreatedEvent.class)).isEqualTo(event);
    }

    @Test
    void webhookOmitsErrorUnlessFailed() throws Exception {
        JsonNode done = mapper.valueToTree(ReportReadyWebhook.done(reportId));
        JsonNode failed = mapper.valueToTree(ReportReadyWebhook.failed(reportId, "Gemini timed out"));

        assertThat(done.fieldNames()).toIterable().containsExactlyInAnyOrder("reportId", "status");
        assertThat(done.get("status").asText()).isEqualTo("DONE");
        assertThat(failed.get("status").asText()).isEqualTo("FAILED");
        assertThat(failed.get("error").asText()).isEqualTo("Gemini timed out");
        assertThat(mapper.readValue("{\"reportId\":\"" + reportId + "\",\"status\":\"DONE\"}", ReportReadyWebhook.class))
                .isEqualTo(ReportReadyWebhook.done(reportId));
    }

    @Test
    void pendingReportDetailHasNullAiReport() {
        var pending = new ReportDetailDto(reportId, machineId, userId, imageId, "Strange noise",
                ReportStatus.PENDING, Instant.parse("2026-11-22T14:05:00Z"), null, null, null);

        JsonNode json = mapper.valueToTree(pending);

        assertThat(json.get("status").asText()).isEqualTo("PENDING");
        assertThat(json.get("createdAt").asText()).isEqualTo("2026-11-22T14:05:00Z");
        assertThat(json.get("aiReport").isNull()).isTrue();
        assertThat(json.get("completedAt").isNull()).isTrue();
    }
}
