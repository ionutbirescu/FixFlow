package com.fixflow.contracts.ai;

import com.fixflow.contracts.model.Severity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MockAiReportServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 22);

    private final MockAiReportService service = new MockAiReportService(
            Clock.fixed(Instant.parse("2026-11-22T10:00:00Z"), ZoneOffset.UTC));

    private final UUID reportId = UUID.randomUUID();
    private final UUID imageId = UUID.randomUUID();
    private final UUID machineId = UUID.randomUUID();

    @ParameterizedTest
    @CsvSource({
            "'Smoke coming from the motor', CRITICAL, 1",
            "'Oil LEAK under the press',    HIGH,     7",
            "'Loud noise when starting',    MEDIUM,   30",
            "'Routine photo, looks fine',   LOW,      90",
    })
    void severityAndNextServiceDateFollowKeywords(String description, Severity severity, int days) {
        AiReportResult result = service.generate(reportId, imageId, machineId, description);

        assertThat(result.severity()).isEqualTo(severity);
        assertThat(result.nextServiceDate()).isEqualTo(TODAY.plusDays(days));
        assertThat(result.idImage()).isEqualTo(imageId);
        assertThat(result.recommendations()).isNotEmpty();
        assertThat(result.report()).startsWith("[mock]").contains(description);
    }

    @Test
    void missingDescriptionIsLow() {
        assertThat(service.generate(reportId, imageId, machineId, null).severity()).isEqualTo(Severity.LOW);
    }

    @Test
    void failTriggerThrowsAiReportException() {
        assertThatThrownBy(() -> service.generate(reportId, imageId, machineId, "Smoke #FAIL"))
                .isInstanceOf(AiReportException.class)
                .hasMessageContaining("#fail");
    }

    @Test
    void registeredOnlyUnderMockProfile() {
        try (var withMock = new AnnotationConfigApplicationContext()) {
            withMock.getEnvironment().setActiveProfiles("mock");
            withMock.scan("com.fixflow.contracts");
            withMock.refresh();
            assertThat(withMock.getBean(AiReportService.class)).isInstanceOf(MockAiReportService.class);
        }
        try (var withoutMock = new AnnotationConfigApplicationContext()) {
            withoutMock.scan("com.fixflow.contracts");
            withoutMock.refresh();
            assertThat(withoutMock.getBeanNamesForType(AiReportService.class)).isEmpty();
        }
    }
}
