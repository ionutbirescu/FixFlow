package com.fixflow.contracts.api;

import com.fixflow.contracts.model.Role;

/** Response of {@code POST /auth/login} (S1): a JWT (HS256, 8 h) and the user's role. */
public record LoginResponse(String token, Role role) {
}
