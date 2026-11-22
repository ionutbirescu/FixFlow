package com.fixflow.contracts.api;

import com.fixflow.contracts.model.Role;

/** Body of {@code POST /auth/users} (S1, MANAGER only). */
public record CreateUserRequest(String username, String password, Role role) {
}
