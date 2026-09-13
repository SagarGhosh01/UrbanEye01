package com.urbaneye.mobile.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import com.urbaneye.mobile.detection.DetectionResult

class OverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val boxPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        isAntiAlias = true
    }

    private val textBgPaint = Paint().apply {
        style = Paint.Style.FILL
        color = Color.argb(190, 0, 0, 0)
    }

    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 34f
        isFakeBoldText = true
        isAntiAlias = true
    }

    private var detections: List<DetectionResult> = emptyList()

    fun setDetections(results: List<DetectionResult>) {
        this.detections = results
        postInvalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()

        for (detection in detections) {
            val box = detection.boundingBox

            // Map normalized coordinates [0, 1] to view dimensions
            val screenRect = RectF(
                box.left * viewWidth,
                box.top * viewHeight,
                box.right * viewWidth,
                box.bottom * viewHeight
            )

            // Distinct color by defect type — matches detectionCategories.ts hex table exactly.
            // Phase 1 live categories only; future phases will add cases here when implemented.
            val color = when (detection.type) {
                "POTHOLE"                  -> Color.rgb(249, 115,  22) // #f97316 Orange
                "ROAD_CRACK"               -> Color.rgb(234, 179,   8) // #eab308 Amber
                "SURFACE_DAMAGE"           -> Color.rgb(146,  64,  14) // #92400e Ochre
                "WATERLOGGING"             -> Color.rgb( 37,  99, 235) // #2563eb Blue
                "MISSING_DIVIDER"          -> Color.rgb(  8, 145, 178) // #0891b2 Cyan
                "MISSING_ZEBRA_CROSSING"   -> Color.rgb(  5, 150, 105) // #059669 Emerald
                "DAMAGED_SIGNBOARD"        -> Color.rgb(202, 138,   4) // #ca8a04 Gold
                "VEHICLE_FLOW"             -> Color.rgb(124,  58, 237) // #7c3aed Purple
                "TRAFFIC_BOTTLENECK"       -> Color.rgb(220,  38,  38) // #dc2626 Deep Red
                "SCHOOL_CHILDREN_CROSSING" -> Color.rgb( 16, 185, 129) // #10b981 Mint Green
                "RASH_DRIVING"             -> Color.rgb(185,  28,  28) // #b91c1c Dark Crimson
                "HIT_AND_RUN"              -> Color.rgb(136,  19,  55) // #881337 Deep Rose
                else                       -> Color.rgb(100, 116, 139) // #64748b Slate-500
            }
            boxPaint.color = color

            // Draw bounding rectangle
            canvas.drawRoundRect(screenRect, 8f, 8f, boxPaint)

            // Draw label pill with diameter, repair price, plate text, or vehicle type
            val diameterStr = if (detection.estimatedDiameterCm != null) " • Ø ${detection.estimatedDiameterCm} cm" else ""
            val costStr = if (detection.estimatedRepairCost != null) " • ₹${detection.estimatedRepairCost}" else ""
            val plateStr = if (detection.registrationNumber != null) " • [${detection.registrationNumber}]" else ""
            val vehicleStr = if (detection.vehicleType != null) " • ${detection.vehicleType}" else ""
            val label = "${detection.type} ${(detection.confidence * 100).toInt()}%$diameterStr$costStr$plateStr$vehicleStr"
            val textWidth = textPaint.measureText(label)
            val textHeight = 46f

            val labelRect = RectF(
                screenRect.left,
                (screenRect.top - textHeight).coerceAtLeast(0f),
                screenRect.left + textWidth + 24f,
                screenRect.top.coerceAtLeast(textHeight)
            )

            canvas.drawRoundRect(labelRect, 6f, 6f, textBgPaint)
            canvas.drawText(label, labelRect.left + 12f, labelRect.bottom - 12f, textPaint)
        }
    }
}
