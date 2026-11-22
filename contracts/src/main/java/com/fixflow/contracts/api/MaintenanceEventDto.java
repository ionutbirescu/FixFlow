package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fixflow.contracts.model.MaintenanceType;

import java.time.Instant;
import java.util.UUID;

/**
 * One entry of a machine's maintenance log, as returned by S2's {@code GET /machines/{id}/history}.
 *
 * @param performedAt ISO-8601 UTC timestamp
 * @param performedBy name of whoever did the work
 */
public record MaintenanceEventDto(
        UUID id,
        UUID machineId,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant performedAt,
        MaintenanceType type,
        String description,
        String performedBy) {
}
