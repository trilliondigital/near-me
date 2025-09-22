package com.nearme.app.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nearme.app.models.*
import com.nearme.app.network.ApiService
import com.nearme.app.network.ApiResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    
    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()
    
    private val _taskLimitStatus = MutableStateFlow<TaskLimitStatus?>(null)
    val taskLimitStatus: StateFlow<TaskLimitStatus?> = _taskLimitStatus.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    init {
        loadCachedUser()
    }
    
    // MARK: - User Management
    
    fun fetchCurrentUser() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                val response = apiService.getCurrentUser()
                if (response.success) {
                    _currentUser.value = response.data
                    cacheUser(response.data)
                    updateTaskLimitStatus()
                } else {
                    _error.value = response.message ?: "Unknown error"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun updateUser(request: UpdateUserRequest) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                val response = apiService.updateUser(request)
                if (response.success) {
                    _currentUser.value = response.data
                    cacheUser(response.data)
                    updateTaskLimitStatus()
                } else {
                    _error.value = response.message ?: "Unknown error"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun checkTaskLimit() {
        viewModelScope.launch {
            try {
                val response = apiService.getTaskLimit()
                if (response.success) {
                    _taskLimitStatus.value = response.data
                } else {
                    _error.value = response.message ?: "Failed to check task limit"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }
    
    fun startTrial() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                val response = apiService.startTrial()
                if (response.success) {
                    _currentUser.value = response.data
                    cacheUser(response.data)
                    updateTaskLimitStatus()
                } else {
                    _error.value = response.message ?: "Failed to start trial"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    // MARK: - Premium Features
    
    fun hasFeature(feature: PremiumFeature): Boolean {
        val user = _currentUser.value ?: return false
        
        return when (feature) {
            PremiumFeature.UNLIMITED_TASKS -> user.isPremium
            PremiumFeature.CUSTOM_NOTIFICATION_SOUNDS -> user.isPremium
            PremiumFeature.DETAILED_NOTIFICATIONS -> user.isPremium
            PremiumFeature.ADVANCED_GEOFENCING -> user.isPremium
            PremiumFeature.PRIORITY_SUPPORT -> user.isPremium
            PremiumFeature.EXPORT_DATA -> user.isPremium
        }
    }
    
    fun getPremiumFeatures(): List<PremiumFeature> {
        return PremiumFeature.values().toList()
    }
    
    fun canCreateTask(): Boolean {
        val taskLimit = _taskLimitStatus.value ?: return false
        return !taskLimit.isAtLimit
    }
    
    // MARK: - Private Methods
    
    private fun updateTaskLimitStatus() {
        checkTaskLimit()
    }
    
    private fun cacheUser(user: User) {
        // TODO: Implement user caching with SharedPreferences or DataStore
    }
    
    private fun loadCachedUser() {
        // TODO: Load cached user from SharedPreferences or DataStore
        // For now, fetch from server
        fetchCurrentUser()
    }
    
    fun clearError() {
        _error.value = null
    }
    
    fun clearCache() {
        _currentUser.value = null
        _taskLimitStatus.value = null
    }
}

// MARK: - API Service Extensions
interface UserApiService {
    suspend fun getCurrentUser(): ApiResponse<User>
    suspend fun updateUser(request: UpdateUserRequest): ApiResponse<User>
    suspend fun getTaskLimit(): ApiResponse<TaskLimitStatus>
    suspend fun startTrial(): ApiResponse<User>
}