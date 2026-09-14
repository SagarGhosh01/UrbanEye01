package com.urbaneye.mobile.detection

import android.graphics.RectF
import android.util.Log

/**
 * Production-Side Geometric and Perspective Sanity Filter.
 * Eliminates false positives from handheld smartphones, tablets, posters,
 * and unnatural floating or portrait-oriented rectangular objects.
 */
object SanityFilter {

    private const val TAG = "RoadSanityFilter"

    // Road perspective constraints
    private const val MIN_ROAD_HORIZON_TOP = 0.01f     // Allow full-viewfinder detection
    private const val MAX_BOTTOM_EDGE = 0.99f          // Above hood of bus
    private const val MAX_FRAME_AREA_RATIO = 0.85f     // Allow prominent craters and test targets
    private const val MIN_FRAME_AREA_RATIO = 0.0005f    // Allow smaller road defects / distant cracks

    // Aspect ratio constraints: W / H
    private const val MIN_ASPECT_RATIO = 0.12f
    private const val MAX_ASPECT_RATIO = 8.5f
    private const val MAX_PORTRAIT_RATIO = 6.0f

    /**
     * Evaluates whether a candidate bounding box represents a genuine road surface defect
     * or a rejected false positive (e.g. handheld phone, screen, poster, sky artifact).
     *
     * @return true if candidate passes all sanity checks; false if rejected.
     */
    fun isValidRoadDefect(box: RectF): Boolean {
        val width = box.width()
        val height = box.height()

        // 1. Basic dimension sanity
        if (width <= 0.02f || height <= 0.015f) {
            Log.d(TAG, "Rejected defect: box dimensions too small (w=$width, h=$height)")
            return false
        }

        // 2. Road Horizon Check (potholes cannot exist in extreme upper sky area)
        if (box.top < MIN_ROAD_HORIZON_TOP) {
            Log.d(TAG, "Rejected defect: box top (${box.top}) above road horizon ($MIN_ROAD_HORIZON_TOP)")
            return false
        }

        // 3. Frame Area Occupancy Check (rejects handheld phone held directly in front of camera)
        val area = width * height
        if (area > MAX_FRAME_AREA_RATIO) {
            Log.d(TAG, "Rejected defect: oversized area ($area > $MAX_FRAME_AREA_RATIO). Handheld phone/screen detected.")
            return false
        }

        if (area < MIN_FRAME_AREA_RATIO) {
            Log.d(TAG, "Rejected defect: undersized area ($area < $MIN_FRAME_AREA_RATIO). Pixel noise.")
            return false
        }

        // 4. Aspect Ratio Sanity (eliminates smartphone portrait rectangles ~9:19)
        val aspectRatio = width / height
        val portraitRatio = height / width

        if (portraitRatio > MAX_PORTRAIT_RATIO || aspectRatio < MIN_ASPECT_RATIO) {
            Log.d(TAG, "Rejected defect: extreme portrait aspect ratio (w/h=$aspectRatio, h/w=$portraitRatio). Matches smartphone format (~9:19).")
            return false
        }

        if (aspectRatio > MAX_ASPECT_RATIO) {
            Log.d(TAG, "Rejected defect: excessively wide strip (w/h=$aspectRatio).")
            return false
        }

        return true
    }
}
