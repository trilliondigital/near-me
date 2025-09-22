package com.nearme.app.ui.onboarding

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.nearme.app.MainActivity
import com.nearme.app.ui.theme.NearMeTheme
import com.nearme.app.viewmodels.OnboardingViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class OnboardingActivity : ComponentActivity() {
    
    private val viewModel: OnboardingViewModel by viewModels()
    
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        viewModel.updateLocationPermissionStatus(fineLocationGranted || coarseLocationGranted)
    }
    
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        viewModel.updateNotificationPermissionStatus(isGranted)
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            NearMeTheme {
                OnboardingScreen(
                    viewModel = viewModel,
                    onLocationPermissionRequest = ::requestLocationPermission,
                    onNotificationPermissionRequest = ::requestNotificationPermission,
                    onOnboardingComplete = ::completeOnboarding
                )
            }
        }
    }
    
    private fun requestLocationPermission() {
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }
    
    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            viewModel.updateNotificationPermissionStatus(true)
        }
    }
    
    private fun completeOnboarding() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
    
    override fun onResume() {
        super.onResume()
        checkPermissionStatus()
    }
    
    private fun checkPermissionStatus() {
        val locationGranted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || 
        ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val notificationGranted = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        
        viewModel.updateLocationPermissionStatus(locationGranted)
        viewModel.updateNotificationPermissionStatus(notificationGranted)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onLocationPermissionRequest: () -> Unit,
    onNotificationPermissionRequest: () -> Unit,
    onOnboardingComplete: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val pagerState = rememberPagerState(pageCount = { OnboardingStep.values().size })
    
    LaunchedEffect(uiState.currentStep) {
        pagerState.animateScrollToPage(uiState.currentStep.ordinal)
    }
    
    LaunchedEffect(pagerState.currentPage) {
        if (pagerState.currentPage != uiState.currentStep.ordinal) {
            viewModel.setCurrentStep(OnboardingStep.values()[pagerState.currentPage])
        }
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
    ) {
        // Progress Bar
        OnboardingProgressBar(
            currentStep = uiState.currentStep.ordinal,
            totalSteps = OnboardingStep.values().size,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
        )
        
        // Content
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f)
        ) { page ->
            when (OnboardingStep.values()[page]) {
                OnboardingStep.WELCOME -> WelcomeScreen()
                OnboardingStep.CONCEPT -> ConceptScreen()
                OnboardingStep.PERMISSIONS -> PermissionsScreen(
                    locationPermissionGranted = uiState.locationPermissionGranted,
                    notificationPermissionGranted = uiState.notificationPermissionGranted,
                    onLocationPermissionRequest = onLocationPermissionRequest,
                    onNotificationPermissionRequest = onNotificationPermissionRequest
                )
                OnboardingStep.PREFERENCES -> PreferencesScreen(
                    preferences = uiState.notificationPreferences,
                    onPreferencesUpdate = viewModel::updateNotificationPreferences
                )
                OnboardingStep.LOCATIONS -> LocationsScreen(
                    locations = uiState.commonLocations,
                    onLocationAdd = viewModel::addCommonLocation,
                    onLocationRemove = viewModel::removeCommonLocation
                )
                OnboardingStep.CATEGORIES -> CategoriesScreen(
                    categories = uiState.taskCategories,
                    onCategoryToggle = viewModel::toggleTaskCategory
                )
                OnboardingStep.PREVIEW -> PreviewScreen()
                OnboardingStep.COMPLETE -> CompleteScreen(
                    onComplete = onOnboardingComplete
                )
            }
        }
        
        // Navigation Buttons
        OnboardingNavigationButtons(
            currentStep = uiState.currentStep,
            canProceed = uiState.canProceedToNextStep,
            onPrevious = viewModel::previousStep,
            onNext = {
                if (uiState.currentStep == OnboardingStep.COMPLETE) {
                    viewModel.completeOnboarding()
                    onOnboardingComplete()
                } else {
                    viewModel.nextStep()
                }
            },
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
        )
    }
}

@Composable
fun OnboardingProgressBar(
    currentStep: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Step ${currentStep + 1} of $totalSteps",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        
        LinearProgressIndicator(
            progress = (currentStep + 1).toFloat() / totalSteps.toFloat(),
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }
}

@Composable
fun OnboardingNavigationButtons(
    currentStep: OnboardingStep,
    canProceed: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (currentStep != OnboardingStep.WELCOME) {
            OutlinedButton(
                onClick = onPrevious,
                modifier = Modifier.weight(1f)
            ) {
                Text("Back")
            }
        }
        
        Button(
            onClick = onNext,
            enabled = canProceed,
            modifier = Modifier.weight(1f)
        ) {
            Text(
                when (currentStep) {
                    OnboardingStep.COMPLETE -> "Get Started"
                    OnboardingStep.PREVIEW -> "Continue"
                    else -> "Next"
                }
            )
        }
    }
}

enum class OnboardingStep {
    WELCOME,
    CONCEPT,
    PERMISSIONS,
    PREFERENCES,
    LOCATIONS,
    CATEGORIES,
    PREVIEW,
    COMPLETE
}