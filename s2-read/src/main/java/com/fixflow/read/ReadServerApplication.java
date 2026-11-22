package com.fixflow.read;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Also scans {@code com.fixflow.agent} (the Gemini AI service from {@code ai-agent}) and
 * {@code com.fixflow.contracts} (the mock AI service), so the active Spring profile picks one.
 */
@SpringBootApplication(scanBasePackages = {
        "com.fixflow.read",
        "com.fixflow.agent",
        "com.fixflow.contracts"
})
public class ReadServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReadServerApplication.class, args);
    }
}
