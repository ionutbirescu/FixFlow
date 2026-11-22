package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fixflow.contracts.ai.AiReportResult;
import com.fixflow.contracts.model.ReportStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Response of S2's {@code GET /reports/{id}}: the request, its status and, once {@code DONE}, the AI report.
 * The client polls it every 3 s until {@code status} is {@code DONE} or {@code FAILED}.
 *
 * @param completedAt {@code null} while {@code PENDING}
 * @param error       why the AI failed; only set when {@code FAILED}
 * @param aiReport    only set when {@code DONE}
 */
public record ReportDetailDto(
        UUID id,
        UUID machineId,
        UUID userId,
        UUID imageId,
        String description,
        ReportStatus status,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant completedAt,
        String error,
        AiReportResult aiReport) {
}
