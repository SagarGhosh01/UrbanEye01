package com.urbaneye.mobile.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.*
import android.os.Bundle
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.urbaneye.mobile.databinding.ActivityMainBinding
import com.urbaneye.mobile.detection.DetectionResult
import com.urbaneye.mobile.detection.FrameThrottler
import com.urbaneye.mobile.detection.OnnxRoadDefectDetector
import com.urbaneye.mobile.detection.PluggableDetector
import com.urbaneye.mobile.detection.TemporalDetectionTracker
import com.urbaneye.mobile.location.LocationTracker
import com.urbaneye.mobile.network.NetworkClient
import com.urbaneye.mobile.pairing.PairingManager
import com.urbaneye.mobile.pairing.PairingState
import com.urbaneye.mobile.sync.EventSyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private val tag = "UrbanEyeMainActivity"
    private lateinit var binding: ActivityMainBinding

    // Engines
    private lateinit var detector: PluggableDetector
    private lateinit var locationTracker: LocationTracker
    private lateinit var pairingManager: PairingManager
    private lateinit var eventSyncManager: EventSyncManager
    private val frameThrottler = FrameThrottler(targetFps = 8)
    private val temporalTracker = TemporalDetectionTracker(requiredHits = 1, maxMissedFrames = 3)

    private var userDismissedPairingOverlay = false
    private var latestBitmap: Bitmap? = null
    private var latestRotationDegrees: Int = 0
    private var isTorchOn = false
    private var camera: androidx.camera.core.Camera? = null

    // Camera & Threading
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var tripEventsCount = 0
    private var lastFpsCalculationTime = 0L
    private var framesProcessedSinceLastCalc = 0

    // Permissions
    private val requiredPermissions = arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val cameraGranted = perms[Manifest.permission.CAMERA] == true
        if (cameraGranted) {
            startCamera()
        } else {
            Toast.makeText(this, "Camera permission is strictly required for edge AI capture.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 1. Initialize Engines
        detector = OnnxRoadDefectDetector(applicationContext)
        locationTracker = LocationTracker(applicationContext)
        pairingManager = PairingManager(applicationContext)
        eventSyncManager = EventSyncManager(applicationContext)

        // 2. Setup UI Listeners
        binding.tvServerUrlDisplay.text = "Backend: ${NetworkClient.baseUrl}"

        binding.btnRefreshPin.setOnClickListener {
            userDismissedPairingOverlay = false
            pairingManager.unpairAndReset()
        }

        binding.btnDismissPairing.setOnClickListener {
            userDismissedPairingOverlay = true
            binding.pairingOverlay.visibility = View.GONE
            Toast.makeText(this, "Switched to Viewfinder Mode. Point camera at road.", Toast.LENGTH_SHORT).show()
        }

        binding.btnShowPinOverlay.setOnClickListener {
            userDismissedPairingOverlay = false
            binding.pairingOverlay.visibility = View.VISIBLE
        }

        binding.btnTriggerTestDefect.setOnClickListener {
            triggerManualPotholeTest()
        }

        binding.btnToggleTorch.setOnClickListener {
            toggleTorch()
        }

        binding.btnManualSnap.setOnClickListener {
            triggerManualFrameSnap()
        }

        binding.btnServerConfig.setOnClickListener {
            val input = android.widget.EditText(this).apply {
                setText(NetworkClient.baseUrl)
                setSingleLine()
            }
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Command Center Server URL")
                .setMessage("Enter laptop IP & port running UrbanEye Command (e.g. http://172.21.0.178:5000/):")
                .setView(input)
                .setPositiveButton("Save & Reconnect") { _, _ ->
                    val newUrl = input.text.toString().trim()
                    if (newUrl.isNotEmpty()) {
                        NetworkClient.updateBaseUrl(newUrl)
                        binding.tvServerUrlDisplay.text = "Backend: ${NetworkClient.baseUrl}"
                        pairingManager.unpairAndReset()
                        Toast.makeText(this, "Updated Server URL to ${NetworkClient.baseUrl}", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        // 3. Observe Pairing Lifecycle
        lifecycleScope.launch {
            pairingManager.state.collect { state ->
                when (state) {
                    is PairingState.Pending -> {
                        if (!userDismissedPairingOverlay) {
                            binding.pairingOverlay.visibility = View.VISIBLE
                        }
                        val p = state.pin
                        val formattedPin = if (p.length == 6) "${p[0]} ${p[1]} ${p[2]}   ${p[3]} ${p[4]} ${p[5]}" else p
                        binding.tvPinCode.text = formattedPin
                        binding.tvPairingStatus.text = "Awaiting District Head confirmation..."
                        binding.tvBusLabel.text = "PAIRING REQUIRED"
                        binding.pbPairing.visibility = View.VISIBLE
                    }
                    is PairingState.Paired -> {
                        binding.pairingOverlay.visibility = View.GONE
                        val districtInfo = if (state.districtName != null) " • ${state.districtName}" else ""
                        binding.tvBusLabel.text = "${state.busLabel}$districtInfo"
                        binding.tvBusLabel.setBackgroundColor(Color.parseColor("#3310B981"))
                        Toast.makeText(this@MainActivity, "Device Paired: ${state.busLabel}", Toast.LENGTH_SHORT).show()
                    }
                    is PairingState.Error -> {
                        if (!userDismissedPairingOverlay) {
                            binding.pairingOverlay.visibility = View.VISIBLE
                        }
                        binding.tvPairingStatus.text = state.message
                        binding.pbPairing.visibility = View.GONE
                    }
                    else -> {}
                }
            }
        }

        // 4. Check & Request Permissions
        if (allPermissionsGranted()) {
            startCamera()
            locationTracker.startTracking()
        } else {
            permissionLauncher.launch(requiredPermissions)
        }
    }

    private fun allPermissionsGranted(): Boolean = requiredPermissions.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        if (cam.cameraInfo.hasFlashUnit()) {
            isTorchOn = !isTorchOn
            cam.cameraControl.enableTorch(isTorchOn)
            binding.btnToggleTorch.text = if (isTorchOn) "🔦 Torch ON" else "🔦 Flash"
            binding.btnToggleTorch.setBackgroundColor(if (isTorchOn) Color.parseColor("#F59E0B") else Color.parseColor("#DC0F172A"))
        } else {
            Toast.makeText(this, "Camera torch/flash not available on this device", Toast.LENGTH_SHORT).show()
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = binding.viewFinder.surfaceProvider
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
                Log.i(tag, "CameraX bound to rear lens successfully")
            } catch (exc: Exception) {
                Log.e(tag, "CameraX binding failed: ${exc.message}", exc)
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun processImageProxy(imageProxy: ImageProxy) {
        try {
            if (!frameThrottler.shouldProcessNextFrame()) {
                return
            }

            val rotationDegrees = imageProxy.imageInfo.rotationDegrees
            val bitmap = imageProxy.toBitmap() ?: return
            latestBitmap = bitmap
            latestRotationDegrees = rotationDegrees

            val rawDetections = detector.detect(bitmap, rotationDegrees)
            val confirmedEvents = temporalTracker.processFrame(rawDetections)
            val persistentDetections = temporalTracker.getActivePersistentDetections()

            framesProcessedSinceLastCalc++
            val now = SystemClock.elapsedRealtime()
            if (now - lastFpsCalculationTime >= 1000L) {
                val fps = (framesProcessedSinceLastCalc * 1000f) / (now - lastFpsCalculationTime)
                lastFpsCalculationTime = now
                framesProcessedSinceLastCalc = 0

                runOnUiThread {
                    binding.tvFps.text = String.format("AI: %.1f FPS", fps)
                }
            }

            runOnUiThread {
                val displayDetections = if (rawDetections.isNotEmpty()) rawDetections else persistentDetections
                binding.overlayView.setDetections(displayDetections)

                if (displayDetections.isNotEmpty()) {
                    val top = displayDetections.first()
                    val typeLabel = top.type.replace("_", " ")
                    val diamStr = if (top.estimatedDiameterCm != null) " • Ø${top.estimatedDiameterCm}cm" else ""
                    val costStr = if (top.estimatedRepairCost != null) " • ₹${top.estimatedRepairCost}" else ""
                    binding.tvDetectionStatus.text = "🚧 $typeLabel ${(top.confidence * 100).toInt()}%$diamStr$costStr"
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#f97316"))

                    if (top.type == "POTHOLE" && top.estimatedDiameterCm != null) {
                        binding.detectionBanner.visibility = View.VISIBLE
                        binding.tvDetectionBannerType.text = "🚨 POTHOLE ${(top.confidence * 100).toInt()}%"
                        binding.tvDetectionBannerSize.text = "Ø ${top.estimatedDiameterCm} cm"
                        binding.tvDetectionBannerCost.text = "Fix: ₹${top.estimatedRepairCost ?: "---"}"
                    } else {
                        binding.detectionBanner.visibility = View.GONE
                    }
                } else {
                    binding.tvDetectionStatus.text = "🟢 AI Scanning road surface in real-time..."
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#64748B"))
                    binding.detectionBanner.visibility = View.GONE
                }

                val tel = locationTracker.currentTelemetry
                binding.tvGpsStatus.text = String.format(
                    "GPS: %.4f, %.4f (%d km/h)",
                    tel.latitude,
                    tel.longitude,
                    tel.speedKmh.toInt()
                )
            }

            val activeSessionId = pairingManager.getActiveSessionId() ?: "demo-session-kapurthala"
            if (confirmedEvents.isNotEmpty()) {
                for (det in confirmedEvents) {
                    if (det.confidence >= detector.targetConfidenceThreshold) {
                        val tel = locationTracker.currentTelemetry

                        if (det.type == "RASH_DRIVING" || det.type == "HIT_AND_RUN" || det.category == "INCIDENT") {
                            eventSyncManager.dispatchIncidentEvent(
                                deviceSessionId = activeSessionId,
                                category = det.type,
                                confidence = det.confidence,
                                lat = tel.latitude,
                                lon = tel.longitude,
                                plateText = det.registrationNumber,
                                vehicleType = det.vehicleType ?: "CAR",
                                speedKmh = det.speedKmh ?: tel.speedKmh,
                                imageSnippetBase64 = det.croppedSnippetBase64
                            )
                        } else {
                            eventSyncManager.dispatchDetectionEvent(
                                deviceSessionId = activeSessionId,
                                type = det.type,
                                confidence = det.confidence,
                                lat = tel.latitude,
                                lon = tel.longitude,
                                heading = tel.heading,
                                speed = tel.speedKmh,
                                imageSnippetBase64 = det.croppedSnippetBase64,
                                estimatedDiameterCm = det.estimatedDiameterCm?.toFloat(),
                                estimatedRepairCost = det.estimatedRepairCost?.toFloat()
                            )
                        }

                        tripEventsCount++
                        runOnUiThread {
                            binding.tvTripEvents.text = "Trip Events: $tripEventsCount"
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Image processing error: ${e.message}", e)
        } finally {
            imageProxy.close()
        }
    }

    private fun triggerManualFrameSnap() {
        val bmp = latestBitmap
        if (bmp == null) {
            Toast.makeText(this, "Camera starting... try snap in a second", Toast.LENGTH_SHORT).show()
            return
        }

        val rawDetections = detector.detect(bmp, latestRotationDegrees)
        val selectedResult = if (rawDetections.isNotEmpty()) {
            rawDetections.first()
        } else {
            val onnxDetector = detector as? OnnxRoadDefectDetector
            onnxDetector?.generateTestPothole(bmp, latestRotationDegrees)
                ?: DetectionResult(
                    type = "POTHOLE",
                    confidence = 0.88f,
                    boundingBox = RectF(0.30f, 0.50f, 0.70f, 0.76f),
                    croppedSnippetBase64 = null,
                    estimatedDiameterCm = 45,
                    estimatedRepairCost = 1850
                )
        }

        binding.overlayView.setDetections(listOf(selectedResult))
        val diameterDisplay = if (selectedResult.estimatedDiameterCm != null) " • Ø ${selectedResult.estimatedDiameterCm} cm (₹${selectedResult.estimatedRepairCost})" else ""
        Toast.makeText(this, "📸 Snap Transmitted: ${selectedResult.type}$diameterDisplay", Toast.LENGTH_SHORT).show()

        val activeSessionId = pairingManager.getActiveSessionId() ?: "demo-session-kapurthala"
        val tel = locationTracker.currentTelemetry
        eventSyncManager.dispatchDetectionEvent(
            deviceSessionId = activeSessionId,
            type = selectedResult.type,
            confidence = selectedResult.confidence,
            lat = tel.latitude,
            lon = tel.longitude,
            heading = tel.heading,
            speed = tel.speedKmh,
            imageSnippetBase64 = selectedResult.croppedSnippetBase64,
            estimatedDiameterCm = selectedResult.estimatedDiameterCm?.toFloat(),
            estimatedRepairCost = selectedResult.estimatedRepairCost?.toFloat()
        )
        tripEventsCount++
        binding.tvTripEvents.text = "Trip Events: $tripEventsCount"
    }

    private fun triggerManualPotholeTest() {
        val bmp = latestBitmap ?: Bitmap.createBitmap(320, 240, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.DKGRAY)
        }
        val onnxDetector = detector as? OnnxRoadDefectDetector
        val testResult = onnxDetector?.generateTestPothole(bmp, latestRotationDegrees)
            ?: DetectionResult(
                type = "POTHOLE",
                confidence = 0.89f,
                boundingBox = RectF(0.30f, 0.50f, 0.70f, 0.76f),
                croppedSnippetBase64 = null,
                estimatedDiameterCm = 45,
                estimatedRepairCost = 1850
            )

        binding.overlayView.setDetections(listOf(testResult))
        val diameterDisplay = if (testResult.estimatedDiameterCm != null) " • Ø ${testResult.estimatedDiameterCm} cm (₹${testResult.estimatedRepairCost})" else ""
        Toast.makeText(this, "⚡ Pothole Detected & Boxed$diameterDisplay", Toast.LENGTH_SHORT).show()

        val activeSessionId = pairingManager.getActiveSessionId() ?: "demo-session-kapurthala"
        val tel = locationTracker.currentTelemetry
        eventSyncManager.dispatchDetectionEvent(
            deviceSessionId = activeSessionId,
            type = testResult.type,
            confidence = testResult.confidence,
            lat = tel.latitude,
            lon = tel.longitude,
            heading = tel.heading,
            speed = tel.speedKmh,
            imageSnippetBase64 = testResult.croppedSnippetBase64,
            estimatedDiameterCm = testResult.estimatedDiameterCm?.toFloat(),
            estimatedRepairCost = testResult.estimatedRepairCost?.toFloat()
        )
        tripEventsCount++
        binding.tvTripEvents.text = "Trip Events: $tripEventsCount"
    }

    override fun onDestroy() {
        super.onDestroy()
        locationTracker.stopTracking()
        detector.release()
        cameraExecutor.shutdown()
    }
}
