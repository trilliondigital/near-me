package com.nearme.app.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nearme.app.ui.components.*
import com.nearme.app.ui.theme.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ComponentTests {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun primaryButton_displaysCorrectText() {
        composeTestRule.setContent {
            NearMeTheme {
                PrimaryButton(
                    text = "Test Button",
                    onClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Button").assertIsDisplayed()
    }

    @Test
    fun primaryButton_whenLoading_showsProgressIndicator() {
        composeTestRule.setContent {
            NearMeTheme {
                PrimaryButton(
                    text = "Loading Button",
                    onClick = {},
                    isLoading = true
                )
            }
        }

        composeTestRule.onNodeWithText("Loading Button").assertDoesNotExist()
        composeTestRule.onNode(hasTestTag("CircularProgressIndicator")).assertExists()
    }

    @Test
    fun secondaryButton_displaysCorrectText() {
        composeTestRule.setContent {
            NearMeTheme {
                SecondaryButton(
                    text = "Test Button",
                    onClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Button").assertIsDisplayed()
    }

    @Test
    fun taskCard_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                TaskCard(
                    title = "Test Task",
                    description = "Test Description",
                    location = "Test Location",
                    status = TaskStatus.Active,
                    onClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Task").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Description").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Location").assertIsDisplayed()
    }

    @Test
    fun placeCard_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                PlaceCard(
                    name = "Test Place",
                    address = "Test Address",
                    category = "Test Category",
                    distance = "1.0 mi",
                    onClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Place").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Address").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Category").assertIsDisplayed()
        composeTestRule.onNodeWithText("1.0 mi").assertIsDisplayed()
    }

    @Test
    fun notificationCard_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                NotificationCard(
                    title = "Test Notification",
                    message = "Test Message",
                    timestamp = "5 minutes ago",
                    isRead = false,
                    actions = emptyList(),
                    onClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Notification").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Message").assertIsDisplayed()
        composeTestRule.onNodeWithText("5 minutes ago").assertIsDisplayed()
    }

    @Test
    fun emptyStateCard_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                EmptyStateCard(
                    icon = "list",
                    title = "No Items",
                    message = "No items to display",
                    actionTitle = "Add Item",
                    onActionClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText("No Items").assertIsDisplayed()
        composeTestRule.onNodeWithText("No items to display").assertIsDisplayed()
        composeTestRule.onNodeWithText("Add Item").assertIsDisplayed()
    }

    @Test
    fun textInputField_displaysCorrectLabel() {
        composeTestRule.setContent {
            NearMeTheme {
                TextInputField(
                    label = "Test Field",
                    value = "",
                    onValueChange = {}
                )
            }
        }

        composeTestRule.onNodeWithText("Test Field").assertIsDisplayed()
    }

    @Test
    fun searchField_displaysCorrectPlaceholder() {
        composeTestRule.setContent {
            NearMeTheme {
                SearchField(
                    value = "",
                    onValueChange = {},
                    placeholder = "Search..."
                )
            }
        }

        composeTestRule.onNodeWithText("Search...").assertIsDisplayed()
    }

    @Test
    fun toggleField_displaysCorrectTitle() {
        composeTestRule.setContent {
            NearMeTheme {
                ToggleField(
                    title = "Test Toggle",
                    checked = false,
                    onCheckedChange = {},
                    description = "Test description"
                )
            }
        }

        composeTestRule.onNodeWithText("Test Toggle").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test description").assertIsDisplayed()
    }

    @Test
    fun sliderField_displaysCorrectTitle() {
        composeTestRule.setContent {
            NearMeTheme {
                SliderField(
                    title = "Test Slider",
                    value = 5f,
                    onValueChange = {},
                    valueRange = 0f..10f,
                    unit = " units"
                )
            }
        }

        composeTestRule.onNodeWithText("Test Slider").assertIsDisplayed()
        composeTestRule.onNodeWithText("5 units").assertIsDisplayed()
    }
}

@RunWith(AndroidJUnit4::class)
class DesignSystemTests {

    @Test
    fun designSystemColors_areDefined() {
        // Test that all colors are defined
        assert(Primary != null)
        assert(Secondary != null)
        assert(Accent != null)
        assert(Success != null)
        assert(Warning != null)
        assert(Error != null)
        assert(Background != null)
        assert(Surface != null)
        assert(Card != null)
        assert(TextPrimary != null)
        assert(TextSecondary != null)
        assert(TextTertiary != null)
        assert(TextInverse != null)
    }

    @Test
    fun designSystemSpacing_hasCorrectValues() {
        // Test that all spacing values are correct
        assert(DesignSystem.Spacing.xs.value == 4f)
        assert(DesignSystem.Spacing.sm.value == 8f)
        assert(DesignSystem.Spacing.md.value == 16f)
        assert(DesignSystem.Spacing.lg.value == 24f)
        assert(DesignSystem.Spacing.xl.value == 32f)
        assert(DesignSystem.Spacing.xxl.value == 48f)
        assert(DesignSystem.Spacing.xxxl.value == 64f)
    }

    @Test
    fun designSystemCornerRadius_hasCorrectValues() {
        // Test that all corner radius values are correct
        assert(DesignSystem.CornerRadius.xs.value == 4f)
        assert(DesignSystem.CornerRadius.sm.value == 8f)
        assert(DesignSystem.CornerRadius.md.value == 12f)
        assert(DesignSystem.CornerRadius.lg.value == 16f)
        assert(DesignSystem.CornerRadius.xl.value == 20f)
        assert(DesignSystem.CornerRadius.xxl.value == 24f)
        assert(DesignSystem.CornerRadius.round.value == 50f)
    }

    @Test
    fun designSystemElevation_hasCorrectValues() {
        // Test that all elevation values are correct
        assert(DesignSystem.Elevation.none.value == 0f)
        assert(DesignSystem.Elevation.small.value == 2f)
        assert(DesignSystem.Elevation.medium.value == 4f)
        assert(DesignSystem.Elevation.large.value == 8f)
        assert(DesignSystem.Elevation.xl.value == 16f)
    }

    @Test
    fun designSystemButtonHeight_hasCorrectValues() {
        // Test that all button height values are correct
        assert(DesignSystem.ButtonHeight.small.value == 36f)
        assert(DesignSystem.ButtonHeight.medium.value == 44f)
        assert(DesignSystem.ButtonHeight.large.value == 52f)
    }

    @Test
    fun designSystemIconSize_hasCorrectValues() {
        // Test that all icon size values are correct
        assert(DesignSystem.IconSize.small.value == 16f)
        assert(DesignSystem.IconSize.medium.value == 20f)
        assert(DesignSystem.IconSize.large.value == 24f)
        assert(DesignSystem.IconSize.xl.value == 32f)
        assert(DesignSystem.IconSize.xxl.value == 48f)
    }
}

@RunWith(AndroidJUnit4::class)
class NavigationTests {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun mainNavigation_displaysBottomNavigation() {
        composeTestRule.setContent {
            NearMeTheme {
                MainNavigation()
            }
        }

        // Test that bottom navigation is displayed
        composeTestRule.onNodeWithText("Tasks").assertIsDisplayed()
        composeTestRule.onNodeWithText("Places").assertIsDisplayed()
        composeTestRule.onNodeWithText("Notifications").assertIsDisplayed()
        composeTestRule.onNodeWithText("Settings").assertIsDisplayed()
    }

    @Test
    fun tasksScreen_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                TasksScreen()
            }
        }

        // Test that tasks screen displays correctly
        composeTestRule.onNodeWithText("Tasks").assertIsDisplayed()
        composeTestRule.onNodeWithText("Search tasks...").assertIsDisplayed()
    }

    @Test
    fun placesScreen_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                PlacesScreen()
            }
        }

        // Test that places screen displays correctly
        composeTestRule.onNodeWithText("Places").assertIsDisplayed()
        composeTestRule.onNodeWithText("Search places...").assertIsDisplayed()
    }

    @Test
    fun notificationsScreen_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                NotificationsScreen()
            }
        }

        // Test that notifications screen displays correctly
        composeTestRule.onNodeWithText("Notifications").assertIsDisplayed()
    }

    @Test
    fun settingsScreen_displaysCorrectContent() {
        composeTestRule.setContent {
            NearMeTheme {
                SettingsScreen()
            }
        }

        // Test that settings screen displays correctly
        composeTestRule.onNodeWithText("Settings").assertIsDisplayed()
        composeTestRule.onNodeWithText("Location").assertIsDisplayed()
        composeTestRule.onNodeWithText("Notifications").assertIsDisplayed()
        composeTestRule.onNodeWithText("Tasks").assertIsDisplayed()
        composeTestRule.onNodeWithText("Privacy").assertIsDisplayed()
        composeTestRule.onNodeWithText("About").assertIsDisplayed()
    }
}
