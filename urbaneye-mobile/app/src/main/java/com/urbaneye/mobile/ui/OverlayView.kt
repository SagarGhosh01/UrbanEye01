package com.urbaneye.mobile.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import com.urbaneye.mobile.detection.DetectionResult

class OverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // HUD Paint definitions
    private val boxPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        isAntiAlias = true
    }

    private val cornerPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
        isAntiAlias = true
    }

    private val fillGlowPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val reticlePaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }

    private val textBgPaint = Paint().apply {
        style = Paint.Style.FILL
        color = Color.argb(220, 15, 23, 42) // Dark Slate-900 glass backdrop
    }

    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 32f
        isFakeBoldText = true
        isAntiAlias = true
    }

    private val badgePaint = Paint().apply {
        color = Color.rgb(245, 158, 11) // Amber badge
        textSize = 24f
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

            // Distinct neon color coding matching UrbanEye web platform theme
            val (colorHex, severityLabel) = when (detection.type) {
                "POTHOLE"                  -> Pair(Color.rgb(249, 115,  22), "🚨 CRITICAL") // #f97316 Neon Orange
                "ROAD_CRACK",
                "ALLIGATOR_CRACK",
                "LONGITUDINAL_CRACK",
                "TRANSVERSE_CRACK"         -> Pair(Color.rgb(234, 179,   8), "⚠️ HIGH")     // #eab308 Amber Yellow
                "SURFACE_DAMAGE"           -> Pair(Color.rgb(192, 132, 252), "⚡ MEDIUM")   // #c084fc Purple Accent
                "WATERLOGGING"             -> Pair(Color.rgb( 56, 189, 248), "💧 WATERLOG")  // #38bdf8 Sky Blue
                "ROAD_EDGE_DAMAGE"         -> Pair(Color.rgb(244,  63,  94), "⚠️ EDGE DAMAGE")// #f43f5e Rose Red
                "MISSING_DIVIDER"          -> Pair(Color.rgb(  6, 182, 212), "🚧 HAZARD")    // #06b6d4 Cyan
                "RASH_DRIVING",
                "HIT_AND_RUN"              -> Pair(Color.rgb(225,  29,  72), "🚨 INCIDENT")  // #e11d48 Crimson Red
                else                       -> Pair(Color.rgb( 94, 234, 212), "ℹ️ DEFECT")    // #5eead4 Mint Teal
            }

            // 1. Light translucent glow fill inside target defect area
            fillGlowPaint.color = Color.argb(35, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            canvas.drawRoundRect(screenRect, 10f, 10f, fillGlowPaint)

            // 2. Translucent full bounding box path
            boxPaint.color = Color.argb(140, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            canvas.drawRoundRect(screenRect, 10f, 10f, boxPaint)

            // 3. Futuristic HUD corner brackets (┌ ┐ └ ┘)
            cornerPaint.color = colorHex
            val cLen = (screenRect.width() * 0.22f).coerceIn(24f, 60f)
            val cLenY = (screenRect.height() * 0.22f).coerceIn(24f, 60f)

            // Top-Left (┌)
            canvas.drawLine(screenRect.left, screenRect.top, screenRect.left + cLen, screenRect.top, cornerPaint)
            canvas.drawLine(screenRect.left, screenRect.top, screenRect.left, screenRect.top + cLenY, cornerPaint)

            // Top-Right (┐)
            canvas.drawLine(screenRect.right, screenRect.top, screenRect.right - cLen, screenRect.top, cornerPaint)
            canvas.drawLine(screenRect.right, screenRect.top, screenRect.right, screenRect.top + cLenY, cornerPaint)

            // Bottom-Left (└)
            canvas.drawLine(screenRect.left, screenRect.bottom, screenRect.left + cLen, screenRect.bottom, cornerPaint)
            canvas.drawLine(screenRect.left, screenRect.bottom, screenRect.left, screenRect.bottom - cLenY, cornerPaint)

            // Bottom-Right (┘)
            canvas.drawLine(screenRect.right, screenRect.bottom, screenRect.right - cLen, screenRect.bottom, cornerPaint)
            canvas.drawLine(screenRect.right, screenRect.bottom, screenRect.right, screenRect.bottom - cLenY, cornerPaint)

            // 4. Center Crosshair Reticle (+)
            val cx = screenRect.centerX()
            val cy = screenRect.centerY()
            reticlePaint.color = colorHex
            canvas.drawLine(cx - 12f, cy, cx + 12f, cy, reticlePaint)
            canvas.drawLine(cx, cy - 12f, cx, cy + 12f, reticlePaint)

            // 5. Label Header Pill
            val typeTitle = detection.type.replace("_", " ")
            val confPct = (detection.confidence * 100).toInt()
            val diamStr = if (detection.estimatedDiameterCm != null) " • Ø ${detection.estimatedDiameterCm} cm" else ""
            val costStr = if (detection.estimatedRepairCost != null) " • ₹${detection.estimatedRepairCost}" else ""
            val fullLabel = "$typeTitle $confPct%$diamStr$costStr"

            val textWidth = textPaint.measureText(fullLabel)
            val textHeight = 48f
            val pillMargin = 10f

            val labelRect = RectF(
                screenRect.left,
                (screenRect.top - textHeight - pillMargin).coerceAtLeast(0f),
                screenRect.left + textWidth + 28f,
                (screenRect.top - pillMargin).coerceAtLeast(textHeight)
            )

            // Draw pill background & border
            canvas.drawRoundRect(labelRect, 8f, 8f, textBgPaint)
            cornerPaint.color = Color.argb(200, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            canvas.drawRoundRect(labelRect, 8f, 8f, cornerPaint)

            // Draw primary defect title & telemetry text
            textPaint.color = Color.WHITE
            canvas.drawText(fullLabel, labelRect.left + 14f, labelRect.bottom - 14f, textPaint)
        }
    }
}
