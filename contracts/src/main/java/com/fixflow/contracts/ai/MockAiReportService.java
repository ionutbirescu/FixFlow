package com.fixflow.contracts.ai;

import com.fixflow.contracts.model.Severity;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Fake AI for running and testing without Gemini (Spring profile {@code mock}). Deterministic: the severity
 * comes from keywords in the description, so demos and tests know what to expect.
 *
 * <ul>
 *   <li>fire, smoke, spark, burn &rarr; {@code CRITICAL}, next service in 1 day</li>
 *   <li>leak, overheat, crack, broken &rarr; {@code HIGH}, 7 days</li>
 *   <li>noise, vibration, wear, loose &rarr; {@code MEDIUM}, 30 days</li>
 *   <li>anything else &rarr; {@code LOW}, 90 days</li>
 *   <li>{@code #fail} anywhere in the description &rarr; throws {@link AiReportException} (to test the FAILED path)</li>
 * </ul>
 */
@Service
@Profile("mock")
public class MockAiReportService implements AiReportService {

    static final String FAIL_TRIGGER = "#fail";

    private final Clock clock;

    public MockAiReportService() {
        this(Clock.systemUTC());
    }

    MockAiReportService(Clock clock) {
        this.clock = clock;
    }

    @Override
    public AiReportResult generate(UUID reportId, UUID imageId, UUID machineId, String description) {
        String original = description == null ? "" : description.strip();
        String text = original.toLowerCase(Locale.ROOT);
        if (text.contains(FAIL_TRIGGER)) {
            throw new AiReportException("Mock AI failure requested with " + FAIL_TRIGGER + " in the description");
        }

        Rule rule = Rule.matching(text);
        return new AiReportResult(
                imageId,
                "[mock] " + rule.summary + " Reported: \"" + original + "\"",
                rule.severity,
                rule.recommendations,
                LocalDate.now(clock).plusDays(rule.daysToService));
    }

    private enum Rule {
        CRITICAL(Severity.CRITICAL, 1, List.of("fire", "smoke", "spark", "burn"),
                "Signs of fire or electrical damage. Stop the machine immediately.",
                List.of("Stop the machine and isolate power", "Inspect wiring and motor windings",
                        "Do not restart before an electrician signs off")),
        HIGH(Severity.HIGH, 7, List.of("leak", "overheat", "crack", "broken"),
                "Component failure likely soon.",
                List.of("Schedule repair within the week", "Check fluid levels and seals",
                        "Reduce load until repaired")),
        MEDIUM(Severity.MEDIUM, 30, List.of("noise", "vibration", "wear", "loose"),
                "Early signs of mechanical wear.",
                List.of("Tighten fasteners and check alignment", "Lubricate moving parts")),
        LOW(Severity.LOW, 90, List.of(),
                "No significant issue visible.",
                List.of("Continue regular maintenance"));

        final Severity severity;
        final int daysToService;
        final List<String> keywords;
        final String summary;
        final List<String> recommendations;

        Rule(Severity severity, int daysToService, List<String> keywords, String summary, List<String> recommendations) {
            this.severity = severity;
            this.daysToService = daysToService;
            this.keywords = keywords;
            this.summary = summary;
            this.recommendations = recommendations;
        }

        static Rule matching(String text) {
            for (Rule rule : values()) {
                if (rule.keywords.stream().anyMatch(text::contains)) {
                    return rule;
                }
            }
            return LOW;
        }
    }
}
