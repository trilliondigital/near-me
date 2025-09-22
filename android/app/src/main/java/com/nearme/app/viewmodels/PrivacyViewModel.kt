package com.nearme.app.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nearme.app.data.repository.PrivacyRepository
import com.nearme.app.ui.privacy.LocationPrivacyMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PrivacySettings(
    val locationPrivacyMode: LocationPrivacyMode = LocationPrivacyMode.STANDARD,
    val onDeviceProcessing: Boolean = true,
    val dataMinimization: Boolean = true,
    val analyticsOptOut: Boolean = false,
    val crashReportingOptOut: Boolean = false,
    val locationHistoryRetention: Int = 30
)

data class PrivacyUiState(
    val privacySettings: PrivacySettings = PrivacySettings(),
    val locationPermissionGranted: Boolean = false,
    val backgroundLocationEnabled: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class PrivacyViewModel @Inject constructor(
    private val privacyRepository: PrivacyRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(PrivacyUiState())
    val uiState: StateFlow<PrivacyUiState> = _uiState.asStateFlow()
    
    init {
        loadPrivacySettings()
        observeLocationPermissions()
    }
    
    private fun loadPrivacySettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            
            try {
                val settings = privacyRepository.getPrivacySettings()
                _uiState.update { 
                    it.copy(
                        privacySettings = settings,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = "Failed to load privacy settings: ${e.message}"
                    )
                }
            }
        }
    }
    
    private fun observeLocationPermissions() {
        viewModelScope.launch {
            privacyRepository.locationPermissionFlow.collect { permissions ->
                _uiState.update { 
                    it.copy(
                        locationPermissionGranted = permissions.fineLocationGranted,
                        backgroundLocationEnabled = permissions.backgroundLocationGranted
                    )
                }
            }
        }
    }
    
    fun updateLocationPrivacyMode(mode: LocationPrivacyMode) {
        viewModelScope.launch {
            try {
                val updatedSettings = _uiState.value.privacySettings.copy(
                    locationPrivacyMode = mode
                )
                
                privacyRepository.updatePrivacySettings(updatedSettings)
                _uiState.update { 
                    it.copy(
                        privacySettings = updatedSettings,
                        error = null
                    )
                }
                
                // Apply location mode changes
                privacyRepository.applyLocationPrivacyMode(mode)
                
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(error = "Failed to update location privacy mode: ${e.message}")
                }
            }
        }
    }
    
    fun updateOnDeviceProcessing(enabled: Boolean) {
        updatePrivacySetting { it.copy(onDeviceProcessing = enabled) }
    }
    
    fun updateDataMinimization(enabled: Boolean) {
        updatePrivacySetting { it.copy(dataMinimization = enabled) }
    }
    
    fun updateAnalyticsOptOut(optOut: Boolean) {
        updatePrivacySetting { it.copy(analyticsOptOut = optOut) }
    }
    
    fun updateCrashReportingOptOut(optOut: Boolean) {
        updatePrivacySetting { it.copy(crashReportingOptOut = optOut) }
    }
    
    fun updateLocationHistoryRetention(days: Int) {
        updatePrivacySetting { it.copy(locationHistoryRetention = days) }
    }
    
    private fun updatePrivacySetting(update: (PrivacySettings) -> PrivacySettings) {
        viewModelScope.launch {
            try {
                val updatedSettings = update(_uiState.value.privacySettings)
                
                privacyRepository.updatePrivacySettings(updatedSettings)
                _uiState.update { 
                    it.copy(
                        privacySettings = updatedSettings,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(error = "Failed to update privacy setting: ${e.message}")
                }
            }
        }
    }
    
    fun deleteUserData(confirmationCode: String) {
        if (confirmationCode.uppercase() != "DELETE") {
            _uiState.update { 
                it.copy(error = "Invalid confirmation code")
            }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            
            try {
                privacyRepository.deleteUserData(
                    deleteLocationHistory = true,
                    deleteTasks = true,
                    deletePlaces = true,
                    deleteNotificationHistory = true,
                    deleteAccount = true,
                    confirmationCode = confirmationCode
                )
                
                // Clear local data
                privacyRepository.clearAllLocalData()
                
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = null
                    )
                }
                
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = "Failed to delete user data: ${e.message}"
                    )
                }
            }
        }
    }
    
    fun requestDataExport(
        includeLocationHistory: Boolean = true,
        includeTasks: Boolean = true,
        includePlaces: Boolean = true,
        includeNotificationHistory: Boolean = false,
        format: String = "json"
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            
            try {
                privacyRepository.requestDataExport(
                    includeLocationHistory = includeLocationHistory,
                    includeTasks = includeTasks,
                    includePlaces = includePlaces,
                    includeNotificationHistory = includeNotificationHistory,
                    format = format
                )
                
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = null
                    )
                }
                
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = "Failed to request data export: ${e.message}"
                    )
                }
            }
        }
    }
    
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}