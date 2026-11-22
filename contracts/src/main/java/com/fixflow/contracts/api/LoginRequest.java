package com.fixflow.contracts.api;

/** Body of {@code POST /auth/login} (S1). */
public record LoginRequest(String username, String password) {
}
