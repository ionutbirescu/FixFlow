package com.fixflow.contracts.api;

import java.util.UUID;

/** Response of {@code POST /reports} (S1, {@code 202 Accepted}). Poll S2's {@code GET /reports/{reportId}}. */
public record CreateReportResponse(UUID reportId) {
}
