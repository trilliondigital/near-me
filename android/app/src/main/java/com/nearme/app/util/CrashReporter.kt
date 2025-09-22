package com.nearme.app.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import com.nearme.app.data.api.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Simple UncaughtException handler to persist crash info and send it on next app launch.
 */
object CrashReporter {
    private const val PREFS = "crash_reporter_prefs"
    private const val KEY_PAYLOAD = "last_crash_payload"

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        // Install handler
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val payload = mapOf(
                    "crashType" to "uncaught_exception",
                    "thread" to thread.name,
                    "message" to (throwable.message ?: "unknown"),
                    "stackTrace" to Log.getStackTraceString(throwable)
                )
                val json = gson.toJson(payload)
                prefs.edit().putString(KEY_PAYLOAD, json).apply()
            } catch (_: Exception) {
            }
            // Let system handle default crash flow
            Thread.getDefaultUncaughtExceptionHandler()?.uncaughtException(thread, throwable)
        }

        // Attempt to send any pending crash report
        sendPendingCrash(context)
    }

    private fun getPendingPayload(): String? = prefs.getString(KEY_PAYLOAD, null)

    private fun clearPending() { prefs.edit().remove(KEY_PAYLOAD).apply() }

    private fun sendPendingCrash(context: Context) {
        val payloadJson = getPendingPayload() ?: return
        val map: Map<String, Any?> = try { gson.fromJson(payloadJson, Map::class.java) as Map<String, Any?> } catch (_: Exception) { emptyMap() }

        data class CrashBody(
            val platform: String = "android",
            val appVersion: String,
            val deviceId: String = android.os.Build.MODEL ?: "android-device",
            val crashType: String = (map["crashType"] as? String) ?: "unknown",
            val stackTrace: String? = map["stackTrace"] as? String,
            val userActions: List<String>? = null
        )

        val versionName = try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (_: Exception) { "1.0.0" }

        val body = CrashBody(appVersion = versionName)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = ApiClient()
                client.post("/performance/crash-report", body)
                clearPending()
            } catch (e: Exception) {
                // keep for next launch
            }
        }
    }
}
