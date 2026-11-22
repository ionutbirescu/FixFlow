package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;

/** Body of {@code POST /machines} and {@code PUT /machines/{id}} (S1, MANAGER only). */
public record MachineRequest(
        String name,
        String model,
        String location,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate installedAt,
        int serviceIntervalDays) {
}
