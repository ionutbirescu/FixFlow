package com.fixflow.contracts.api;

import java.util.List;
import java.util.function.Function;

/**
 * A page of results. Use this instead of serializing Spring Data's {@code Page}, whose JSON shape is not stable.
 *
 * @param page zero-based page index
 */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public PageResponse {
        content = content == null ? List.of() : List.copyOf(content);
    }

    public <R> PageResponse<R> map(Function<? super T, ? extends R> mapper) {
        return new PageResponse<>(content.stream().<R>map(mapper).toList(), page, size, totalElements, totalPages);
    }
}
