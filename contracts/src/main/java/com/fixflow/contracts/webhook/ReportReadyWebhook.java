package com.fixflow.contracts.webhook;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fixflow.contracts.model.ReportStatus;

import java.util.UUID;

/**
 * Body of S2's call to S1's {@value #PATH}, sent with the {@value #SECRET_HEADER} header.
 *
 * @param status {@code DONE} or {@code FAILED} (never {@code PENDING})
 * @param error  why the AI failed; only set when {@code status} is {@code FAILED}, omitted from the JSON otherwise
 */
public record ReportReadyWebhook(
        UUID reportId,
        ReportStatus status,
        @JsonInclude(JsonInclude.Include.NON_NULL) String error) {

    public static final String PATH = "/internal/report-ready";
    public static final String SECRET_HEADER = "X-Webhook-Secret";

    public static ReportReadyWebhook done(UUID reportId) {
        return new ReportReadyWebhook(reportId, ReportStatus.DONE, null);
    }

    public static ReportReadyWebhook failed(UUID reportId, String error) {
        return new ReportReadyWebhook(reportId, ReportStatus.FAILED, error);
    }
}
