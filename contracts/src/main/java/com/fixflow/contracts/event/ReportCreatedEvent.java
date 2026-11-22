package com.fixflow.contracts.event;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;
import java.util.UUID;

/**
 * Published by S1 to {@value KafkaTopics#REPORT_CREATED} after the report is committed; consumed by S2.
 *
 * @param createdAt ISO-8601 UTC timestamp, e.g. {@code 2026-11-22T14:05:00Z}
 */
public record ReportCreatedEvent(
        UUID reportId,
        UUID imageId,
        UUID machineId,
        UUID userId,
        String description,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt) {
}
