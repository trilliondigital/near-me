package com.nearme.app.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nearme.app.models.*
import com.nearme.app.ui.onboarding.OnboardingStep
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OnboardingUiState(
    val currentStep: OnboardingStep = OnboardingStep.WELCOME,
    val locationPermissionGranted: Boolean = false,
    val notificationPermissionGranted: Boolean = false,
    val notificationPreferences: NotificationPreferences = NotificationPreferences(),
    val commonLocations: List<CommonLocation> = emptyList(),
    val taskCategories: List<TaskCategory> = TaskCategory.defaultCategories,
    val canProceedToNextStep: Boolean = true,
    val isOnboardingComplete: Boolean = false
)

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    // TODO: Inject repositories when available
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()
    
    fun setCurrentStep(step: OnboardingStep) {
        _uiState.value = _uiState.value.copy(
            currentStep = step,
            canProceedToNextStep = canProceedToStep(step)
        )
    }
    
    fun nextStep() {
        val currentStep = _uiState.value.currentStep
        val nextStepOrdinal = currentStep.ordinal + 1
        
        if (nextStepOrdinal < OnboardingStep.values().size) {
            val nextStep = OnboardingStep.values()[nextStepOrdinal]
            setCurrentStep(nextStep)
        }
    }
    
    fun previousStep() {
        val currentStep = _uiState.value.currentStep
        val previousStepOrdinal = currentStep.ordinal - 1
        
        if (previousStepOrdinal >= 0) {
            val previousStep = OnboardingStep.values()[previousStepOrdinal]
            setCurrentStep(previousStep)
        }
    }
    
    fun updateLocationPermissionStatus(granted: Boolean) {
        _uiState.value = _uiState.value.copy(
            locationPermissionGranted = granted,
            canProceedToNextStep = canProceedToStep(_uiState.value.currentStep)
        )
    }
    
    fun updateNotificationPermissionStatus(granted: Boolean) {
        _uiState.value = _uiState.value.copy(
            notificationPermissionGranted = granted,
            canProceedToNextStep = canProceedToStep(_uiState.value.currentStep)
        )
    }
    
    fun updateNotificationPreferences(preferences: NotificationPreferences) {
        _uiState.value = _uiState.value.copy(
            notificationPreferences = preferences
        )
        
        // TODO: Save preferences to repository
        viewModelScope.launch {
            // saveNotificationPreferences(preferences)
        }
    }
    
    fun addCommonLocation(location: CommonLocation) {
        val currentLocations = _uiState.value.commonLocations.toMutableList()
        
        // Remove existing location of the same type if it exists
        currentLocations.removeAll { it.type == location.type }
        currentLocations.add(location)
        
        _uiState.value = _uiState.value.copy(
            commonLocations = currentLocations
        )
        
        // TODO: Save location to repository
        viewModelScope.launch {
            // saveCommonLocation(location)
        }
    }
    
    fun removeCommonLocation(location: CommonLocation) {
        val currentLocations = _uiState.value.commonLocations.toMutableList()
        currentLocations.remove(location)
        
        _uiState.value = _uiState.value.copy(
            commonLocations = currentLocations
        )
        
        // TODO: Remove location from repository
        viewModelScope.launch {
            // removeCommonLocation(location.id)
        }
    }
    
    fun toggleTaskCategory(categoryId: String) {
        val currentCategories = _uiState.value.taskCategories.toMutableList()
        val categoryIndex = currentCategories.indexOfFirst { it.id == categoryId }
        
        if (categoryIndex != -1) {
            val category = currentCategories[categoryIndex]
            currentCategories[categoryIndex] = category.copy(isSelected = !category.isSelected)
        } else {
            // Add new category if not found
            val defaultCategory = TaskCategory.defaultCategories.find { it.id == categoryId }
            if (defaultCategory != null) {
                currentCategories.add(defaultCategory.copy(isSelected = true))
            }
        }
        
        _uiState.value = _uiState.value.copy(
            taskCategories = currentCategories
        )
        
        // TODO: Save categories to repository
        viewModelScope.launch {
            // saveTaskCategories(currentCategories)
        }
    }
    
    fun completeOnboarding() {
        _uiState.value = _uiState.value.copy(
            isOnboardingComplete = true
        )
        
        // TODO: Save onboarding completion status
        viewModelScope.launch {
            // markOnboardingComplete()
        }
    }
    
    fun resetOnboarding() {
        _uiState.value = OnboardingUiState()
        
        // TODO: Clear onboarding data from repository
        viewModelScope.launch {
            // clearOnboardingData()
        }
    }
    
    private fun canProceedToStep(step: OnboardingStep): Boolean {
        return when (step) {
            OnboardingStep.WELCOME,
            OnboardingStep.CONCEPT -> true
            
            OnboardingStep.PERMISSIONS -> {
                // Can proceed if permissions are granted or user chooses to skip
                true
            }
            
            OnboardingStep.PREFERENCES,
            OnboardingStep.LOCATIONS,
            OnboardingStep.CATEGORIES,
            OnboardingStep.PREVIEW,
            OnboardingStep.COMPLETE -> true
        }
    }
    
    // Progress calculation
    fun getProgressPercentage(): Float {
        return _uiState.value.currentStep.ordinal.toFloat() / (OnboardingStep.values().size - 1).toFloat()
    }
    
    fun getCurrentStepIndex(): Int {
        return _uiState.value.currentStep.ordinal
    }
    
    fun getTotalSteps(): Int {
        return OnboardingStep.values().size
    }
}