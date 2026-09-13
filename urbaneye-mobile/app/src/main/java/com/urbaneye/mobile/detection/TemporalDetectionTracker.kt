package com.urbaneye.mobile.detection

import android.graphics.RectF
import android.util.Log
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Temporal Consistency Filter for Edge-AI Road Defect Detections.
 * Enforces frame-to-frame spatial persistence (e.g. requiring a defect to be tracked across
 * 3 out of 5 sliding frames) before confirming and uploading an ingestion event.
 * Eliminates transient glints, camera sensor noise, and briefly displayed handheld pictures.
 */
class TemporalDetectionTracker(
    private val requiredHits: Int = 1,
    private val maxMissedFrames: Int = 3,
    private val iouThreshold: Float = 0.25f,
    private val maxCentroidDistance: Float = 0.14f
) {

    private val tag = "TemporalTracker"
    private var currentFrameIndex: Long = 0L

    data class TrackedDefect(
        val id: Long,
        var type: String,
        var boundingBox: RectF,
        var hits: Int,
        var lastSeenFrame: Long,
        var maxConfidence: Float,
        var bestSnippetBase64: String?,
        var estimatedDiameterCm: Int? = null,
        var estimatedRepairCost: Int? = null,
        var hasDispatchedEvent: Boolean = false
    )

    private val activeTracks = mutableListOf<TrackedDefect>()
    private var nextTrackId: Long = 1L

    /**
     * Ingests raw candidate detections from the current frame.
     * Returns a list of newly confirmed, temporally consistent detections that qualify for cloud event dispatch.
     */
    @Synchronized
    fun processFrame(candidates: List<DetectionResult>): List<DetectionResult> {
        currentFrameIndex++
        val confirmedEvents = mutableListOf<DetectionResult>()

        val unmatchedCandidates = candidates.toMutableList()

        // 1. Match candidates with existing tracks
        for (track in activeTracks) {
            var bestCandidate: DetectionResult? = null
            var bestScore = 0f

            for (cand in unmatchedCandidates) {
                if (cand.type != track.type) continue

                val iou = computeIoU(track.boundingBox, cand.boundingBox)
                val dist = computeCentroidDistance(track.boundingBox, cand.boundingBox)

                // Match if sufficient IoU overlap OR close centroid proximity
                if (iou >= iouThreshold || dist <= maxCentroidDistance) {
                    val matchScore = iou + (1f - dist)
                    if (matchScore > bestScore) {
                        bestScore = matchScore
                        bestCandidate = cand
                    }
                }
            }

            if (bestCandidate != null) {
                // Update track
                track.hits++
                track.lastSeenFrame = currentFrameIndex
                track.boundingBox = smoothBox(track.boundingBox, bestCandidate.boundingBox)
                if (bestCandidate.confidence > track.maxConfidence) {
                    track.maxConfidence = bestCandidate.confidence
                }
                if (bestCandidate.croppedSnippetBase64 != null) {
                    track.bestSnippetBase64 = bestCandidate.croppedSnippetBase64
                }
                // Preserve diameter and cost from best candidate
                if (bestCandidate.estimatedDiameterCm != null) {
                    track.estimatedDiameterCm = bestCandidate.estimatedDiameterCm
                }
                if (bestCandidate.estimatedRepairCost != null) {
                    track.estimatedRepairCost = bestCandidate.estimatedRepairCost
                }
                unmatchedCandidates.remove(bestCandidate)

                // Check promotion threshold: 3 hits across sliding window and not yet dispatched
                if (track.hits >= requiredHits && !track.hasDispatchedEvent) {
                    track.hasDispatchedEvent = true
                    Log.i(tag, "✅ Confirmed temporally consistent defect: ${track.type} (Hits: ${track.hits}, Conf: ${track.maxConfidence}, Ø ${track.estimatedDiameterCm} cm, ₹${track.estimatedRepairCost})")

                    confirmedEvents.add(
                        DetectionResult(
                            type = track.type,
                            confidence = track.maxConfidence,
                            boundingBox = track.boundingBox,
                            croppedSnippetBase64 = track.bestSnippetBase64,
                            estimatedDiameterCm = track.estimatedDiameterCm,
                            estimatedRepairCost = track.estimatedRepairCost
                        )
                    )
                }
            }
        }

        // 2. Initialize new tracks for unmatched candidates
        for (cand in unmatchedCandidates) {
            activeTracks.add(
                TrackedDefect(
                    id = nextTrackId++,
                    type = cand.type,
                    boundingBox = cand.boundingBox,
                    hits = 1,
                    lastSeenFrame = currentFrameIndex,
                    maxConfidence = cand.confidence,
                    bestSnippetBase64 = cand.croppedSnippetBase64,
                    estimatedDiameterCm = cand.estimatedDiameterCm,
                    estimatedRepairCost = cand.estimatedRepairCost
                )
            )
        }

        // 3. Prune stale tracks that haven't been observed recently
        activeTracks.removeAll { track ->
            (currentFrameIndex - track.lastSeenFrame) > maxMissedFrames
        }

        return confirmedEvents
    }

    /**
     * Returns currently active, persistent detections for HUD rendering (filters out 1-frame noise).
     */
    @Synchronized
    fun getActivePersistentDetections(): List<DetectionResult> {
        return activeTracks
            .filter { it.hits >= 2 }
            .map {
                DetectionResult(
                    type = it.type,
                    confidence = it.maxConfidence,
                    boundingBox = it.boundingBox,
                    croppedSnippetBase64 = it.bestSnippetBase64,
                    estimatedDiameterCm = it.estimatedDiameterCm,
                    estimatedRepairCost = it.estimatedRepairCost
                )
            }
    }

    private fun computeIoU(a: RectF, b: RectF): Float {
        val interLeft = max(a.left, b.left)
        val interTop = max(a.top, b.top)
        val interRight = min(a.right, b.right)
        val interBottom = min(a.bottom, b.bottom)

        if (interRight < interLeft || interBottom < interTop) return 0f

        val interArea = (interRight - interLeft) * (interBottom - interTop)
        val areaA = a.width() * a.height()
        val areaB = b.width() * b.height()
        val unionArea = areaA + areaB - interArea

        return if (unionArea > 0f) interArea / unionArea else 0f
    }

    private fun computeCentroidDistance(a: RectF, b: RectF): Float {
        val cAx = a.centerX()
        val cAy = a.centerY()
        val cBx = b.centerX()
        val cBy = b.centerY()
        return hypot(cAx - cBx, cAy - cBy)
    }

    private fun smoothBox(prev: RectF, curr: RectF, alpha: Float = 0.6f): RectF {
        return RectF(
            prev.left * (1 - alpha) + curr.left * alpha,
            prev.top * (1 - alpha) + curr.top * alpha,
            prev.right * (1 - alpha) + curr.right * alpha,
            prev.bottom * (1 - alpha) + curr.bottom * alpha
        )
    }

    @Synchronized
    fun reset() {
        activeTracks.clear()
        currentFrameIndex = 0L
    }
}
