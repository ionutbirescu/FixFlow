package com.fixflow.contracts.api;

import com.fixflow.contracts.model.Role;

import java.util.UUID;

/** A user account, as returned by {@code POST /auth/users} (S1). Never contains the password. */
public record UserDto(UUID id, String username, Role role) {
}
