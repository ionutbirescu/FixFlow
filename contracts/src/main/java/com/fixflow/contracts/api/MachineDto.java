package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A machine, as returned by S1's machine endpoints and S2's {@code GET /machines}.
 *
 * @param installedAt         ISO-8601 date
 * @param serviceIntervalDays days between preventive services
 */
public record MachineDto(
        UUID id,
        String name,
        String model,
        String location,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate installedAt,
        int serviceIntervalDays) {
}
