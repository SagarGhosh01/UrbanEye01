package com.urbaneye.mobile.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.urbaneye.mobile.network.EventIngestRequest
import com.urbaneye.mobile.network.NetworkClient
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class EventSyncManager(private val context: Context) {

    private val tag = "EventSyncManager"
    private val database = AppDatabase.getDatabase(context)
    private val eventDao = database.eventDao()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isoDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private var isFlushing = false

    init {
        // Start periodic sync worker loop
        scope.launch {
            while (isActive) {
                delay(5000L) // check every 5 seconds
                if (isOnline()) {
                    flushQueue()
                }
            }
        }
    }

    fun dispatchDetectionEvent(
        deviceSessionId: String,
        type: String,
        confidence: Float,
        lat: Double,
        lon: Double,
        heading: Float?,
        speed: Float?,
        imageSnippetBase64: String?,
        estimatedDiameterCm: Float? = null,
        estimatedRepairCost: Float? = null
    ) {
        scope.launch {
            val timestamp = isoDateFormat.format(Date())

            val request = EventIngestRequest(
                deviceSessionId = deviceSessionId,
                type = type,
                confidence = confidence,
                latitude = lat,
                longitude = lon,
                heading = heading,
                speed = speed,
                imageSnippet = imageSnippetBase64,
                timestamp = timestamp,
                estimatedDiameterCm = estimatedDiameterCm,
                estimatedRepairCost = estimatedRepairCost
            )

            if (isOnline()) {
                try {
                    val response = NetworkClient.apiService.ingestEvent(request)
                    if (response.isSuccessful) {
                        Log.i(tag, "✅ Edge-AI event ingested live! Event ID: ${response.body()?.eventId}")
                        return@launch
                    }
                } catch (e: Exception) {
                    Log.w(tag, "Direct upload failed (transit cellular dead zone?): ${e.message}")
                }
            }

            // Buffer locally in Room database for offline retry
            val entity = EventEntity(
                deviceSessionId = deviceSessionId,
                type = type,
                confidence = confidence,
                latitude = lat,
                longitude = lon,
                heading = heading,
                speed = speed,
                imageSnippet = imageSnippetBase64,
                timestamp = timestamp
            )
            eventDao.insertEvent(entity)
            Log.d(tag, "📦 Event queued in offline local buffer. Pending: ${eventDao.getPendingCount()}")
        }
    }

    fun dispatchIncidentEvent(
        deviceSessionId: String,
        category: String,
        confidence: Float,
        lat: Double,
        lon: Double,
        plateText: String?,
        vehicleType: String,
        speedKmh: Float,
        imageSnippetBase64: String?
    ) {
        scope.launch {
            val timestamp = isoDateFormat.format(Date())
            val request = com.urbaneye.mobile.network.IncidentIngestRequest(
                deviceSessionId = deviceSessionId,
                category = category,
                confidence = confidence,
                latitude = lat,
                longitude = lon,
                plateText = plateText,
                vehicleType = vehicleType,
                speedKmh = speedKmh,
                imageSnippet = imageSnippetBase64,
                timestamp = timestamp
            )

            if (isOnline()) {
                try {
                    val response = NetworkClient.apiService.ingestIncident(request)
                    if (response.isSuccessful) {
                        Log.i(tag, "🚨 Incident Alert ingested live! ID: ${response.body()?.incidentId}")
                    }
                } catch (e: Exception) {
                    Log.w(tag, "Incident upload failed: ${e.message}")
                }
            }
        }
    }

            // Buffer locally in Room database for offline retry
            val entity = EventEntity(
                deviceSessionId = deviceSessionId,
                type = type,
                confidence = confidence,
                latitude = lat,
                longitude = lon,
                heading = heading,
                speed = speed,
                imageSnippet = imageSnippetBase64,
                timestamp = timestamp
            )
            eventDao.insertEvent(entity)
            Log.d(tag, "📦 Event queued in offline local buffer. Pending: ${eventDao.getPendingCount()}")
        }
    }

    private suspend fun flushQueue() {
        if (isFlushing) return
        isFlushing = true

        try {
            val pending = eventDao.getPendingEvents()
            for (item in pending) {
                try {
                    val request = EventIngestRequest(
                        deviceSessionId = item.deviceSessionId,
                        type = item.type,
                        confidence = item.confidence,
                        latitude = item.latitude,
                        longitude = item.longitude,
                        heading = item.heading,
                        speed = item.speed,
                        imageSnippet = item.imageSnippet,
                        timestamp = item.timestamp
                    )

                    val res = NetworkClient.apiService.ingestEvent(request)
                    if (res.isSuccessful) {
                        eventDao.deleteEvent(item.localId)
                        Log.i(tag, "🔄 Flushed offline event #${item.localId} to cloud")
                    } else {
                        eventDao.incrementRetry(item.localId)
                    }
                } catch (e: Exception) {
                    eventDao.incrementRetry(item.localId)
                    break // network likely dropped again
                }
            }
        } finally {
            isFlushing = false
        }
    }

    private fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
