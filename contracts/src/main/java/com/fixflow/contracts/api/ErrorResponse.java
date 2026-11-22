package com.fixflow.contracts.api;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;

/**
 * Standard error body returned by S1 and S2 for every 4xx/5xx response.
 *
 * @param status  HTTP status code, e.g. {@code 404}
 * @param error   HTTP reason phrase, e.g. {@code Not Found}
 * @param message human-readable detail, safe to show in the UI
 * @param path    request path, e.g. {@code /reports/6f1c...}
 */
public record ErrorResponse(
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant timestamp,
        int status,
        String error,
        String message,
        String path) {
}
