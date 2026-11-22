package com.fixflow.contracts.ai;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fixflow.contracts.model.Severity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The report JSON: produced by the AI (C), stored by S2 (B), shown by the client (D).
 * Serialized as {@code { id_image, report, severity, recommendations, nextServiceDate }}.
 *
 * @param idImage         serialized as {@code id_image}, as fixed in the shared contract
 * @param nextServiceDate suggested day for the next service, ISO-8601 date, e.g. {@code 2026-12-15}
 */
public record AiReportResult(
        @JsonProperty("id_image") UUID idImage,
        String report,
        Severity severity,
        List<String> recommendations,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate nextServiceDate) {

    public AiReportResult {
        recommendations = recommendations == null ? List.of() : List.copyOf(recommendations);
    }
}
