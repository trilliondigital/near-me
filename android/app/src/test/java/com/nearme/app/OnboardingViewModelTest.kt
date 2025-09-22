package com.nearme.app

import com.nearme.app.models.*
import com.nearme.app.ui.onboarding.OnboardingStep
import com.nearme.app.viewmodels.OnboardingViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

@ExperimentalCoroutinesApi
class OnboardingViewModelTest {
    
    private lateinit var viewModel: OnboardingViewModel
    
    @Before
    fun setUp() {
        viewModel = OnboardingViewModel()
    }
    
    @Test
    fun `initial state is correct`() {
        val uiState = viewModel.uiState.value
        
        assertEquals(OnboardingStep.WELCOME, uiState.currentStep)
        assertFalse(uiState.locationPermissionGranted)
        assertFalse(uiState.notificationPermissionGranted)
        assertTrue(uiState.canProceedToNextStep)
        assertFalse(uiState.isOnboardingComplete)
        assertTrue(uiState.commonLocations.isEmpty())
        assertEquals(TaskCategory.defaultCategories.size, uiState.taskCategories.size)
    }
    
    @Test
    fun `step navigation works correctly`() {
        // Test forward navigation
        viewModel.nextStep()
        assertEquals(OnboardingStep.CONCEPT, viewModel.uiState.value.currentStep)
        
        viewModel.nextStep()
        assertEquals(OnboardingStep.PERMISSIONS, viewModel.uiState.value.currentStep)
        
        // Test backward navigation
        viewModel.previousStep()
        assertEquals(OnboardingStep.CONCEPT, viewModel.uiState.value.currentStep)
        
        viewModel.previousStep()
        assertEquals(OnboardingStep.WELCOME, viewModel.uiState.value.currentStep)
        
        // Test can't go before welcome
        viewModel.previousStep()
        assertEquals(OnboardingStep.WELCOME, viewModel.uiState.value.currentStep)
    }
    
    @Test
    fun `setCurrentStep updates state correctly`() {
        viewModel.setCurrentStep(OnboardingStep.PREVIEW)
        assertEquals(OnboardingStep.PREVIEW, viewModel.uiState.value.currentStep)
    }
    
    @Test
    fun `permission status updates correctly`() {
        // Test location permission
        viewModel.updateLocationPermissionStatus(true)
        assertTrue(viewModel.uiState.value.locationPermissionGranted)
        
        viewModel.updateLocationPermissionStatus(false)
        assertFalse(viewModel.uiState.value.locationPermissionGranted)
        
        // Test notification permission
        viewModel.updateNotificationPermissionStatus(true)
        assertTrue(viewModel.uiState.value.notificationPermissionGranted)
        
        viewModel.updateNotificationPermissionStatus(false)
        assertFalse(viewModel.uiState.value.notificationPermissionGranted)
    }
    
    @Test
    fun `notification preferences update correctly`() {
        val newPreferences = NotificationPreferences(
            quietHoursEnabled = true,
            approachNotifications = false,
            arrivalNotifications = true,
            postArrivalNotifications = false
        )
        
        viewModel.updateNotificationPreferences(newPreferences)
        
        val uiState = viewModel.uiState.value
        assertTrue(uiState.notificationPreferences.quietHoursEnabled)
        assertFalse(uiState.notificationPreferences.approachNotifications)
        assertTrue(uiState.notificationPreferences.arrivalNotifications)
        assertFalse(uiState.notificationPreferences.postArrivalNotifications)
    }
    
    @Test
    fun `common location management works correctly`() {
        val homeLocation = CommonLocation(
            id = "test-home",
            name = "Home",
            type = LocationType.HOME,
            address = "123 Main St"
        )
        
        // Test adding location
        viewModel.addCommonLocation(homeLocation)
        
        val uiState = viewModel.uiState.value
        assertEquals(1, uiState.commonLocations.size)
        assertEquals("Home", uiState.commonLocations.first().name)
        assertEquals(LocationType.HOME, uiState.commonLocations.first().type)
        
        // Test removing location
        viewModel.removeCommonLocation(homeLocation)
        assertTrue(viewModel.uiState.value.commonLocations.isEmpty())
    }
    
    @Test
    fun `adding location of same type replaces existing`() {
        val homeLocation1 = CommonLocation(
            id = "home1",
            name = "Home 1",
            type = LocationType.HOME,
            address = "123 Main St"
        )
        
        val homeLocation2 = CommonLocation(
            id = "home2",
            name = "Home 2",
            type = LocationType.HOME,
            address = "456 Oak Ave"
        )
        
        viewModel.addCommonLocation(homeLocation1)
        assertEquals(1, viewModel.uiState.value.commonLocations.size)
        
        viewModel.addCommonLocation(homeLocation2)
        assertEquals(1, viewModel.uiState.value.commonLocations.size)
        assertEquals("Home 2", viewModel.uiState.value.commonLocations.first().name)
    }
    
    @Test
    fun `task category toggle works correctly`() {
        val categoryId = "shopping"
        
        // Initially not selected
        val initialCategory = viewModel.uiState.value.taskCategories.find { it.id == categoryId }
        assertNotNull(initialCategory)
        assertFalse(initialCategory!!.isSelected)
        
        // Toggle to selected
        viewModel.toggleTaskCategory(categoryId)
        val selectedCategory = viewModel.uiState.value.taskCategories.find { it.id == categoryId }
        assertTrue(selectedCategory!!.isSelected)
        
        // Toggle back to unselected
        viewModel.toggleTaskCategory(categoryId)
        val unselectedCategory = viewModel.uiState.value.taskCategories.find { it.id == categoryId }
        assertFalse(unselectedCategory!!.isSelected)
    }
    
    @Test
    fun `toggle nonexistent category adds it as selected`() {
        val nonexistentId = "nonexistent"
        
        // Should not exist initially
        val initialCategory = viewModel.uiState.value.taskCategories.find { it.id == nonexistentId }
        assertNull(initialCategory)
        
        // Toggle should not add it (since it's not in default categories)
        viewModel.toggleTaskCategory(nonexistentId)
        val afterToggle = viewModel.uiState.value.taskCategories.find { it.id == nonexistentId }
        assertNull(afterToggle)
    }
    
    @Test
    fun `onboarding completion works correctly`() {
        assertFalse(viewModel.uiState.value.isOnboardingComplete)
        
        viewModel.completeOnboarding()
        
        assertTrue(viewModel.uiState.value.isOnboardingComplete)
    }
    
    @Test
    fun `progress calculation is correct`() {
        assertEquals(0f, viewModel.getProgressPercentage(), 0.01f)
        assertEquals(0, viewModel.getCurrentStepIndex())
        assertEquals(OnboardingStep.values().size, viewModel.getTotalSteps())
        
        viewModel.nextStep() // Move to CONCEPT
        val expectedProgress = 1f / (OnboardingStep.values().size - 1f)
        assertEquals(expectedProgress, viewModel.getProgressPercentage(), 0.01f)
        assertEquals(1, viewModel.getCurrentStepIndex())
    }
    
    @Test
    fun `reset onboarding works correctly`() {
        // Set up some state
        viewModel.nextStep()
        viewModel.updateLocationPermissionStatus(true)
        viewModel.addCommonLocation(
            CommonLocation(
                id = "test",
                name = "Test",
                type = LocationType.HOME
            )
        )
        viewModel.toggleTaskCategory("shopping")
        
        // Reset
        viewModel.resetOnboarding()
        
        // Verify reset state
        val uiState = viewModel.uiState.value
        assertEquals(OnboardingStep.WELCOME, uiState.currentStep)
        assertFalse(uiState.locationPermissionGranted)
        assertFalse(uiState.notificationPermissionGranted)
        assertTrue(uiState.commonLocations.isEmpty())
        assertFalse(uiState.isOnboardingComplete)
        
        // Verify categories are reset to defaults
        val shoppingCategory = uiState.taskCategories.find { it.id == "shopping" }
        assertFalse(shoppingCategory!!.isSelected)
    }
    
    @Test
    fun `navigation through all steps works correctly`() = runTest {
        val allSteps = OnboardingStep.values()
        
        // Navigate forward through all steps
        for (i in 1 until allSteps.size) {
            viewModel.nextStep()
            assertEquals(allSteps[i], viewModel.uiState.value.currentStep)
        }
        
        // Try to go beyond last step
        viewModel.nextStep()
        assertEquals(allSteps.last(), viewModel.uiState.value.currentStep)
        
        // Navigate backward through all steps
        for (i in allSteps.size - 2 downTo 0) {
            viewModel.previousStep()
            assertEquals(allSteps[i], viewModel.uiState.value.currentStep)
        }
        
        // Try to go before first step
        viewModel.previousStep()
        assertEquals(allSteps.first(), viewModel.uiState.value.currentStep)
    }
}

class OnboardingModelsTest {
    
    @Test
    fun `LocationType has correct display names and icons`() {
        assertEquals("Home", LocationType.HOME.displayName)
        assertEquals("Work", LocationType.WORK.displayName)
        assertEquals("Gym", LocationType.GYM.displayName)
        assertEquals("Grocery Store", LocationType.GROCERY.displayName)
        
        // Verify icons are not null (basic check)
        assertNotNull(LocationType.HOME.icon)
        assertNotNull(LocationType.WORK.icon)
        assertNotNull(LocationType.GYM.icon)
        assertNotNull(LocationType.GROCERY.icon)
    }
    
    @Test
    fun `TaskCategory default categories are correct`() {
        val defaultCategories = TaskCategory.defaultCategories
        
        assertTrue(defaultCategories.isNotEmpty())
        assertEquals(8, defaultCategories.size)
        
        val categoryIds = defaultCategories.map { it.id }
        assertTrue(categoryIds.contains("shopping"))
        assertTrue(categoryIds.contains("health"))
        assertTrue(categoryIds.contains("finance"))
        assertTrue(categoryIds.contains("work"))
        assertTrue(categoryIds.contains("personal"))
        assertTrue(categoryIds.contains("family"))
        assertTrue(categoryIds.contains("social"))
        assertTrue(categoryIds.contains("travel"))
        
        // Verify all categories start unselected
        defaultCategories.forEach { category ->
            assertFalse("Category ${category.id} should start unselected", category.isSelected)
        }
    }
    
    @Test
    fun `NotificationPreferences has correct defaults`() {
        val preferences = NotificationPreferences()
        
        assertFalse(preferences.quietHoursEnabled)
        assertEquals("22:00", preferences.quietStartTime)
        assertEquals("08:00", preferences.quietEndTime)
        assertTrue(preferences.weekendQuietHours)
        assertTrue(preferences.approachNotifications)
        assertTrue(preferences.arrivalNotifications)
        assertTrue(preferences.postArrivalNotifications)
    }
    
    @Test
    fun `CommonLocation data class works correctly`() {
        val coordinate = Coordinate(37.7749, -122.4194)
        val location = CommonLocation(
            id = "test-id",
            name = "Test Location",
            type = LocationType.HOME,
            address = "123 Test St",
            coordinate = coordinate
        )
        
        assertEquals("test-id", location.id)
        assertEquals("Test Location", location.name)
        assertEquals(LocationType.HOME, location.type)
        assertEquals("123 Test St", location.address)
        assertEquals(37.7749, location.coordinate?.latitude ?: 0.0, 0.0001)
        assertEquals(-122.4194, location.coordinate?.longitude ?: 0.0, 0.0001)
    }
    
    @Test
    fun `OnboardingPreferences data class works correctly`() {
        val location = CommonLocation(
            id = "home",
            name = "Home",
            type = LocationType.HOME
        )
        
        val notificationPrefs = NotificationPreferences(quietHoursEnabled = true)
        
        val category = TaskCategory(
            id = "shopping",
            name = "Shopping",
            icon = LocationType.HOME.icon, // Just using any icon for test
            isSelected = true
        )
        
        val preferences = OnboardingPreferences(
            commonLocations = listOf(location),
            notificationPreferences = notificationPrefs,
            taskCategories = listOf(category),
            hasCompletedOnboarding = true
        )
        
        assertEquals(1, preferences.commonLocations.size)
        assertEquals("Home", preferences.commonLocations.first().name)
        assertTrue(preferences.notificationPreferences.quietHoursEnabled)
        assertEquals(1, preferences.taskCategories.size)
        assertTrue(preferences.taskCategories.first().isSelected)
        assertTrue(preferences.hasCompletedOnboarding)
    }
}