package com.fixflow.contracts.ai;

import java.util.UUID;

/**
 * Turns an uploaded image plus machine context into a maintenance report. Called by S2 for every
 * {@code report.created} event.
 *
 * <p>Implementations: {@code GeminiAiReportService} in {@code ai-agent} (profile {@code gemini}) and
 * {@link MockAiReportService} (profile {@code mock}).
 */
public interface AiReportService {

    /**
     * @throws AiReportException when no valid report can be produced (timeout, malformed model output, ...)
     */
    AiReportResult generate(UUID reportId, UUID imageId, UUID machineId, String description);
}
