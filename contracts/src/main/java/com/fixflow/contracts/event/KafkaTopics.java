package com.fixflow.contracts.event;

/** Kafka names shared by S1 (producer) and S2 (consumer). */
public final class KafkaTopics {

    /** Topic carrying {@link ReportCreatedEvent}, keyed by {@code reportId}. */
    public static final String REPORT_CREATED = "report.created";

    /** Dead-letter topic for events S2 could not process after its retries. */
    public static final String REPORT_CREATED_DLT = "report.created.DLT";

    public static final int REPORT_CREATED_PARTITIONS = 3;

    /** Consumer group of S2. */
    public static final String S2_GROUP_ID = "s2-readers";

    private KafkaTopics() {
    }
}
