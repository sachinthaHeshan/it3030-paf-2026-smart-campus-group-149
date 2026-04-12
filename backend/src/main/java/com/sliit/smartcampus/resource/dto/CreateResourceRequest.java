package com.sliit.smartcampus.resource.dto;

import java.util.List;

public record CreateResourceRequest(
        String name,
        String type,
        Integer capacity,
        String location,
        String description,
        String status,
        List<AvailabilityWindowRequest> availabilityWindows) {
}
