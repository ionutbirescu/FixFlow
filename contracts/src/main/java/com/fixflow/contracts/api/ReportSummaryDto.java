package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fixflow.contracts.model.ReportStatus;
import com.fixflow.contracts.model.Severity;

import java.time.Instant;
import java.util.UUID;

/**
 * A row of S2's {@code GET /reports} list.
 *
 * @param severity    {@code null} until the report is {@code DONE}
 * @param completedAt {@code null} while the report is {@code PENDING}
 */
public record ReportSummaryDto(
        UUID id,
        UUID machineId,
        UUID userId,
        String description,
        ReportStatus status,
        Severity severity,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant completedAt) {
}
