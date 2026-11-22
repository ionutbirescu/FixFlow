/**
 * Shared contracts for every FixFlow module. The HTTP API they mirror is described in {@code contracts/openapi.yaml}.
 *
 * <ul>
 *   <li>{@code model}: enums shared by everything ({@code ReportStatus}, {@code Severity}, {@code Role}, {@code MaintenanceType})</li>
 *   <li>{@code event}: the Kafka {@code report.created} event and topic names (S1 &rarr; S2)</li>
 *   <li>{@code ai}: {@code AiReportService}, its result and exception, and the {@code mock} implementation (S2 &rarr; AI)</li>
 *   <li>{@code webhook}: the {@code POST /internal/report-ready} payload (S2 &rarr; S1)</li>
 *   <li>{@code api}: request and response bodies of the S1 and S2 REST APIs</li>
 * </ul>
 *
 * Changing anything here needs agreement from both sides of the contract.
 */
package com.fixflow.contracts;
