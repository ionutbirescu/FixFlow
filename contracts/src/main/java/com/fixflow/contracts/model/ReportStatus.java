package com.fixflow.contracts.model;

/** Lifecycle of a report: {@code PENDING} until S2 calls S1's webhook with {@code DONE} or {@code FAILED}. */
public enum ReportStatus {
    PENDING,
    DONE,
    FAILED
}
