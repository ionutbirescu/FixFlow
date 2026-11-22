package com.fixflow.contracts.ai;

/**
 * Thrown by an {@link AiReportService} when it cannot produce a report. S2 catches it and calls S1's webhook
 * with {@code FAILED} and the exception message as {@code error}.
 */
public class AiReportException extends RuntimeException {

    public AiReportException(String message) {
        super(message);
    }

    public AiReportException(String message, Throwable cause) {
        super(message, cause);
    }
}
