package com.nearme.app.data.api

import android.util.Log
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Simple HTTP client with standardized error handling and retries.
 * Matches backend error envelope: { error: { code, message, timestamp?, requestId?, retryAfter? } }
 */
open class ApiClient(
    private val baseUrl: String = DEFAULT_BASE_URL,
    private val gson: Gson = Gson(),
    private val client: OkHttpClient = defaultOkHttpClient()
) {
    companion object {
        // 10.0.2.2 maps to host loopback from Android emulator
        private const val DEFAULT_BASE_URL = "http://10.0.2.2:3000/api"
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private fun defaultOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    data class ErrorEnvelope(val error: ErrorDetail)
    data class ErrorDetail(
        val code: String,
        val message: String,
        val timestamp: String? = null,
        val requestId: String? = null,
        val retryAfter: Int? = null
    )

    class ApiException(val status: Int, val code: String, override val message: String) : Exception(message)
    class RateLimitException(val retryAfterSeconds: Int?) : Exception("Rate limited")

    suspend fun get(path: String, headers: Map<String, String> = emptyMap()): String =
        request("GET", path, null, headers)

    suspend fun post(path: String, body: Any, headers: Map<String, String> = emptyMap()): String =
        request("POST", path, body, headers)

    suspend fun put(path: String, body: Any, headers: Map<String, String> = emptyMap()): String =
        request("PUT", path, body, headers)

    suspend fun delete(path: String, headers: Map<String, String> = emptyMap()): String =
        request("DELETE", path, null, headers)

    private suspend fun request(
        method: String,
        path: String,
        body: Any?,
        headers: Map<String, String>
    ): String = withContext(Dispatchers.IO) {
        val url = baseUrl.trimEnd('/') + path
        val requestBody: RequestBody? = when (method) {
            "POST", "PUT" -> gson.toJson(body ?: emptyMap<String, Any>()).toRequestBody(JSON)
            else -> null
        }

        val builder = Request.Builder()
            .url(url)
            .method(method, requestBody)
            .addHeader("Accept", "application/json")
            .addHeader("Content-Type", "application/json")

        headers.forEach { (k, v) -> builder.addHeader(k, v) }

        val maxAttempts = 3
        var attempt = 0
        var lastError: Exception? = null

        while (attempt < maxAttempts) {
            try {
                client.newCall(builder.build()).execute().use { resp ->
                    if (resp.isSuccessful) {
                        return@withContext resp.body?.string() ?: ""
                    }
                    handleHttpError(resp)
                }
            } catch (e: RateLimitException) {
                lastError = e
                attempt += 1
                if (attempt >= maxAttempts) throw e
                val backoff = (e.retryAfterSeconds?.coerceAtLeast(1)?.toLong() ?: expBackoff(attempt))
                safeSleep(backoff)
            } catch (e: IOException) {
                // Transient network error
                lastError = e
                attempt += 1
                if (attempt >= maxAttempts) throw e
                safeSleep(expBackoff(attempt))
            } catch (e: ApiException) {
                // Non-retryable by default for 4xx (except 429 handled above)
                throw e
            }
        }
        throw lastError ?: IOException("Unknown network error")
    }

    private fun handleHttpError(resp: Response): Nothing {
        val status = resp.code
        val bodyStr = try { resp.body?.string() } catch (_: Exception) { null }
        val envelope = try { gson.fromJson(bodyStr, ErrorEnvelope::class.java) } catch (_: Exception) { null }

        if (status == 429) {
            val retryAfterHeader = resp.header("Retry-After")
            val retryAfter = retryAfterHeader?.toIntOrNull() ?: envelope?.error?.retryAfter
            throw RateLimitException(retryAfter)
        }

        val code = envelope?.error?.code ?: when (status) {
            400 -> "BAD_REQUEST"
            401 -> "UNAUTHORIZED"
            403 -> "FORBIDDEN"
            404 -> "NOT_FOUND"
            in 500..599 -> "SERVER_ERROR"
            else -> "HTTP_ERROR"
        }
        val message = envelope?.error?.message ?: "HTTP $status"
        throw ApiException(status, code, message)
    }

    private fun expBackoff(attempt: Int): Long {
        // attempt is 1-based here
        val base = Math.pow(2.0, (attempt - 1).toDouble()) * 500.0 // 0.5s, 1s, 2s
        val jitter = (Math.random() * 100.0)
        return (base + jitter).toLong() // milliseconds
    }

    private fun safeSleep(ms: Long) {
        try {
            Thread.sleep(ms)
        } catch (_: InterruptedException) {
            // ignore
        }
    }
}
