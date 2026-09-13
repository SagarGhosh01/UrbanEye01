package com.urbaneye.mobile.detection

import android.graphics.Bitmap
import android.graphics.RectF

data class DetectionResult(
    val type: String, // POTHOLE, ROAD_CRACK, SURFACE_DAMAGE, WATERLOGGING, MISSING_DIVIDER, MISSING_ZEBRA_CROSSING, DAMAGED_SIGNBOARD, VEHICLE_FLOW, TRAFFIC_BOTTLENECK, SCHOOL_CHILDREN_CROSSING, RASH_DRIVING, HIT_AND_RUN
    val category: String = "DEFECT", // DEFECT, INFRASTRUCTURE, TRAFFIC, SAFETY, INCIDENT
    val confidence: Float,
    val boundingBox: RectF, // Normalized coordinates [0.0, 1.0]
    val croppedSnippetBase64: String? = null,
    val estimatedDiameterCm: Int? = null,
    val estimatedRepairCost: Int? = null,
    val registrationNumber: String? = null,
    val plateConfidence: Float? = null,
    val vehicleType: String? = null,
    val speedKmh: Float? = null,
    val riskScore: Int? = null
)
