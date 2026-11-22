package com.fixflow.contracts;

import com.fixflow.contracts.model.MaintenanceType;
import com.fixflow.contracts.model.ReportStatus;
import com.fixflow.contracts.model.Role;
import com.fixflow.contracts.model.Severity;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.params.provider.Arguments.arguments;

/**
 * Runs {@code db/migration} against a real PostgreSQL 16, then checks the schema, the seed data and the
 * constraints other packages rely on. Each test runs in a transaction that is rolled back afterwards.
 */
@Testcontainers
class DatabaseMigrationsTest {

    private static final UUID TECH1 = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID CNC_LATHE = UUID.fromString("00000000-0000-4000-8000-000000000101");
    private static final UUID WELDING_ROBOT = UUID.fromString("00000000-0000-4000-8000-000000000105");

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static SingleConnectionDataSource dataSource;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        MigrateResult result = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load()
                .migrate();
        assertThat(result.migrationsExecuted).isEqualTo(2);

        dataSource = new SingleConnectionDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword(), true);
        dataSource.setAutoCommit(false);
        jdbc = new JdbcTemplate(dataSource);
    }

    @AfterEach
    void rollBack() throws SQLException {
        dataSource.getConnection().rollback();
    }

    @AfterAll
    static void close() {
        dataSource.destroy();
    }

    @Test
    void createsTheSixTables() {
        List<String> tables = jdbc.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'flyway_schema_history'
                """, String.class);

        assertThat(tables).containsExactlyInAnyOrder(
                "users", "machines", "images", "reports", "ai_reports", "maintenance_events");
    }

    static Stream<Arguments> enumColumns() {
        return Stream.of(
                arguments("ck_users_role", Role.class),
                arguments("ck_reports_status", ReportStatus.class),
                arguments("ck_ai_reports_severity", Severity.class),
                arguments("ck_maintenance_events_type", MaintenanceType.class));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("enumColumns")
    void enumCheckAllowsExactlyTheJavaValues(String constraint, Class<? extends Enum<?>> type) {
        String definition = jdbc.queryForObject(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ?", String.class, constraint);
        List<String> allowed = Pattern.compile("'([A-Z_]+)'").matcher(definition).results()
                .map(match -> match.group(1))
                .toList();

        assertThat(allowed).as(definition)
                .containsExactlyInAnyOrderElementsOf(Arrays.stream(type.getEnumConstants()).map(Enum::name).toList());
    }

    @Test
    void seedsATechnicianAndAManagerWithPasswordFixflow() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        List<Map<String, Object>> users =
                jdbc.queryForList("SELECT username, role, password_hash FROM users ORDER BY username");

        assertThat(users).extracting(user -> user.get("username"), user -> user.get("role"))
                .containsExactly(tuple("manager1", "MANAGER"), tuple("tech1", "TECHNICIAN"));
        assertThat(users).allSatisfy(user -> assertThat(encoder.matches("fixflow", (String) user.get("password_hash")))
                .as("password of %s", user.get("username"))
                .isTrue());
    }

    @Test
    void seedsFiveMachinesWithPastHistory() {
        Map<String, Long> eventsPerMachine = new HashMap<>();
        jdbc.query("""
                SELECT m.name, count(e.id) FROM machines m
                LEFT JOIN maintenance_events e ON e.machine_id = m.id
                GROUP BY m.name
                """, (RowCallbackHandler) rs -> eventsPerMachine.put(rs.getString(1), rs.getLong(2)));
        Long eventsOutsideMachineLife = jdbc.queryForObject("""
                SELECT count(*) FROM maintenance_events e JOIN machines m ON m.id = e.machine_id
                WHERE e.performed_at > now() OR e.performed_at < m.installed_at
                """, Long.class);

        assertThat(eventsPerMachine).hasSize(5)
                .allSatisfy((machine, events) -> assertThat(events).as(machine).isGreaterThanOrEqualTo(3));
        assertThat(eventsOutsideMachineLife).isZero();
    }

    @Test
    void seededScheduleHasOneOverdueMachine() {
        Map<String, Integer> dueInDays = new HashMap<>();
        jdbc.query("""
                SELECT m.name, (max(e.performed_at)::date + m.service_interval_days) - CURRENT_DATE
                FROM machines m JOIN maintenance_events e ON e.machine_id = m.id AND e.type = 'PREVENTIVE'
                GROUP BY m.id
                """, (RowCallbackHandler) rs -> dueInDays.put(rs.getString(1), rs.getInt(2)));

        assertThat(dueInDays).containsExactlyInAnyOrderEntriesOf(Map.of(
                "CNC Lathe 01", 25,
                "Hydraulic Press 02", -70,
                "Conveyor Belt 03", 3,
                "Air Compressor 04", 8,
                "Welding Robot 05", 35));
    }

    @Test
    void aiReportsKeepRecommendationsAsTextArrayAndOnlyOneResultPerReport() {
        UUID reportId = insertPendingReport(CNC_LATHE);
        String insert = """
                INSERT INTO ai_reports (report_id, report, severity, recommendations, next_service_date)
                VALUES (?, 'Spindle belt is worn', 'MEDIUM', ?, ?)
                """;
        String[] recommendations = {"Replace the spindle belt", "Check belt tension"};

        jdbc.update(insert, reportId, recommendations, LocalDate.now().plusDays(30));
        String[] stored = jdbc.queryForObject("SELECT recommendations FROM ai_reports WHERE report_id = ?",
                (rs, row) -> (String[]) rs.getArray(1).getArray(), reportId);

        assertThat(stored).containsExactly(recommendations);
        assertThatThrownBy(() -> jdbc.update(insert, reportId, recommendations, LocalDate.now()))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void finishedReportsNeedCompletedAt() {
        UUID failed = insertPendingReport(CNC_LATHE);
        jdbc.update("UPDATE reports SET status = 'FAILED', completed_at = now(), error = 'Gemini timed out' WHERE id = ?",
                failed);
        UUID done = insertPendingReport(CNC_LATHE);

        assertThatThrownBy(() -> jdbc.update("UPDATE reports SET status = 'DONE' WHERE id = ?", done))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_reports_completed_at");
    }

    @Test
    void machineWithReportsCannotBeDeleted() {
        insertPendingReport(CNC_LATHE);

        assertThatThrownBy(() -> jdbc.update("DELETE FROM machines WHERE id = ?", CNC_LATHE))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("fk_reports_machine");
    }

    @Test
    void deletingAMachineWithoutReportsDeletesItsHistory() {
        assertThat(jdbc.update("DELETE FROM machines WHERE id = ?", WELDING_ROBOT)).isOne();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM maintenance_events WHERE machine_id = ?",
                Long.class, WELDING_ROBOT)).isZero();
    }

    /** Inserts an image and its PENDING report for tech1, like S1's upload does. */
    private static UUID insertPendingReport(UUID machineId) {
        UUID imageId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        jdbc.update("INSERT INTO images (id, path, content_type, size_bytes) VALUES (?, ?, 'image/jpeg', 245760)",
                imageId, "/data/images/" + imageId + ".jpg");
        jdbc.update("INSERT INTO reports (id, machine_id, user_id, image_id, description) VALUES (?, ?, ?, ?, ?)",
                reportId, machineId, TECH1, imageId, "Belt slips under load");
        return reportId;
    }
}
