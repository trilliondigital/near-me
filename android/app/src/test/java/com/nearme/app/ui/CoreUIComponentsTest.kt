package com.nearme.app.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nearme.app.ui.components.*
import com.nearme.app.ui.theme.NearMeTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CoreUIComponentsTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // MARK: - Button Component Tests
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

        composeTestRule
            .onNodeWithText("Test Button")
            .assertIsDisplayed()
    }

    @Test
    fun primaryButton_isClickable() {
        var clicked = false
        
        composeTestRule.setContent {
            NearMeTheme {
                PrimaryButton(
                    text = "Clickable Button",
                    onClick = { clicked = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Clickable Button")
            .performClick()

        assert(clicked)
    }

    @Test
    fun primaryButton_showsLoadingState() {
        composeTestRule.setContent {
            NearMeTheme {
                PrimaryButton(
                    text = "Loading Button",
                    onClick = {},
                    isLoading = true
                )
            }
        }

        composeTestRule
            .onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate))
            .assertIsDisplayed()
    }

    @Test
    fun primaryButton_disabledState() {
        composeTestRule.setContent {
            NearMeTheme {
                PrimaryButton(
                    text = "Disabled Button",
                    onClick = {},
                    enabled = false
                )
            }
        }

        composeTestRule
            .onNodeWithText("Disabled Button")
            .assertIsNotEnabled()
    }

    @Test
    fun secondaryButton_displaysCorrectly() {
        composeTestRule.setContent {
            NearMeTheme {
                SecondaryButton(
                    text = "Secondary Button",
                    onClick = {}
                )
            }
        }

        composeTestRule
            .onNodeWithText("Secondary Button")
            .assertIsDisplayed()
    }

    // MARK: - List Component Tests
    @Test
    fun sectionHeader_displaysTitle() {
        composeTestRule.setContent {
            NearMeTheme {
                SectionHeader(
                    title = "Test Section",
                    subtitle = "Test Subtitle"
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test Section")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Test Subtitle")
            .assertIsDisplayed()
    }

    @Test
    fun sectionHeader_actionButtonWorks() {
        var actionClicked = false
        
        composeTestRule.setContent {
            NearMeTheme {
                SectionHeader(
                    title = "Test Section",
                    actionText = "Action",
                    onActionClick = { actionClicked = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Action")
            .performClick()

        assert(actionClicked)
    }

    @Test
    fun listItem_displaysContent() {
        composeTestRule.setContent {
            NearMeTheme {
                ListItem(
                    title = "Test Item",
                    subtitle = "Test Subtitle"
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test Item")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Test Subtitle")
            .assertIsDisplayed()
    }

    @Test
    fun listItem_clickable() {
        var clicked = false
        
        composeTestRule.setContent {
            NearMeTheme {
                ListItem(
                    title = "Clickable Item",
                    onClick = { clicked = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Clickable Item")
            .performClick()

        assert(clicked)
    }

    @Test
    fun listItem_withToggleAccessory() {
        var toggleState = false
        
        composeTestRule.setContent {
            NearMeTheme {
                ListItem(
                    title = "Toggle Item",
                    accessory = ListAccessory.Toggle(
                        isChecked = toggleState,
                        onCheckedChange = { toggleState = it }
                    )
                )
            }
        }

        composeTestRule
            .onNode(hasClickAction())
            .performClick()

        assert(toggleState)
    }

    @Test
    fun expandableListSection_expandsAndCollapses() {
        composeTestRule.setContent {
            NearMeTheme {
                ExpandableListSection(
                    title = "Expandable Section"
                ) {
                    ListItem(title = "Hidden Content")
                }
            }
        }

        // Initially collapsed - content should not be visible
        composeTestRule
            .onNodeWithText("Hidden Content")
            .assertDoesNotExist()

        // Click to expand
        composeTestRule
            .onNodeWithText("Expandable Section")
            .performClick()

        // Content should now be visible
        composeTestRule
            .onNodeWithText("Hidden Content")
            .assertIsDisplayed()

        // Click to collapse
        composeTestRule
            .onNodeWithText("Expandable Section")
            .performClick()

        // Content should be hidden again
        composeTestRule
            .onNodeWithText("Hidden Content")
            .assertDoesNotExist()
    }

    @Test
    fun filterChip_displaysAndRemoves() {
        var removed = false
        
        composeTestRule.setContent {
            NearMeTheme {
                FilterChip(
                    text = "Test Filter",
                    onRemove = { removed = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test Filter")
            .assertIsDisplayed()

        // Find and click the remove button
        composeTestRule
            .onNodeWithContentDescription("Remove filter")
            .performClick()

        assert(removed)
    }

    // MARK: - Map Component Tests
    @Test
    fun locationSearchBar_displaysCorrectly() {
        composeTestRule.setContent {
            NearMeTheme {
                LocationSearchBar(
                    searchText = "",
                    onSearchTextChange = {},
                    searchResults = emptyList(),
                    onResultSelected = {}
                )
            }
        }

        composeTestRule
            .onNodeWithText("Search for a location")
            .assertIsDisplayed()
    }

    @Test
    fun locationSearchBar_showsResults() {
        val mockResults = listOf(
            SearchResult("Starbucks", "Coffee Shop • 0.2 mi", 37.7749, -122.4194),
            SearchResult("Whole Foods", "Grocery Store • 0.5 mi", 37.7849, -122.4094)
        )
        
        composeTestRule.setContent {
            NearMeTheme {
                LocationSearchBar(
                    searchText = "test",
                    onSearchTextChange = {},
                    searchResults = mockResults,
                    onResultSelected = {}
                )
            }
        }

        composeTestRule
            .onNodeWithText("Starbucks")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Whole Foods")
            .assertIsDisplayed()
    }

    @Test
    fun searchResultItem_clickable() {
        var selectedResult: SearchResult? = null
        val testResult = SearchResult("Test Location", "Test Description", 0.0, 0.0)
        
        composeTestRule.setContent {
            NearMeTheme {
                SearchResultItem(
                    result = testResult,
                    onClick = { selectedResult = testResult }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test Location")
            .performClick()

        assert(selectedResult == testResult)
    }

    @Test
    fun poiMarker_displaysCorrectly() {
        val testPOI = POI(
            id = "test",
            name = "Test POI",
            category = POICategory.GROCERY,
            latitude = 37.7749,
            longitude = -122.4194,
            address = "123 Test St"
        )
        
        composeTestRule.setContent {
            NearMeTheme {
                POIMarker(
                    poi = testPOI,
                    isSelected = true
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test POI")
            .assertIsDisplayed()
    }

    // MARK: - Navigation Component Tests
    @Test
    fun modalNavigationBar_displaysCorrectly() {
        var dismissed = false
        
        composeTestRule.setContent {
            NearMeTheme {
                ModalNavigationBar(
                    title = "Test Modal",
                    onDismiss = { dismissed = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("Test Modal")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Cancel")
            .performClick()

        assert(dismissed)
    }

    @Test
    fun navigationProgressBar_displaysCorrectly() {
        composeTestRule.setContent {
            NearMeTheme {
                NavigationProgressBar(
                    currentStep = 2,
                    totalSteps = 5
                )
            }
        }

        composeTestRule
            .onNodeWithText("Step 2 of 5")
            .assertIsDisplayed()
    }

    @Test
    fun tabBarBadge_displaysCount() {
        composeTestRule.setContent {
            NearMeTheme {
                TabBarBadge(count = 5)
            }
        }

        composeTestRule
            .onNodeWithText("5")
            .assertIsDisplayed()
    }

    @Test
    fun tabBarBadge_hidesWhenZero() {
        composeTestRule.setContent {
            NearMeTheme {
                TabBarBadge(count = 0)
            }
        }

        composeTestRule
            .onNodeWithText("0")
            .assertDoesNotExist()
    }

    // MARK: - Empty State Tests
    @Test
    fun emptyState_displaysCorrectly() {
        var actionClicked = false
        
        composeTestRule.setContent {
            NearMeTheme {
                EmptyState(
                    title = "No Items",
                    message = "Create your first item to get started",
                    icon = androidx.compose.material.icons.Icons.Default.CheckCircle,
                    actionText = "Create Item",
                    onActionClick = { actionClicked = true }
                )
            }
        }

        composeTestRule
            .onNodeWithText("No Items")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Create your first item to get started")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Create Item")
            .performClick()

        assert(actionClicked)
    }

    // MARK: - Integration Tests
    @Test
    fun multipleComponents_renderTogether() {
        composeTestRule.setContent {
            NearMeTheme {
                androidx.compose.foundation.layout.Column {
                    SectionHeader(title = "Test Section")
                    ListItem(title = "Test Item")
                    PrimaryButton(text = "Test Button", onClick = {})
                }
            }
        }

        composeTestRule
            .onNodeWithText("Test Section")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Test Item")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Test Button")
            .assertIsDisplayed()
    }

    // MARK: - Performance Tests
    @Test
    fun componentRendering_performsWell() {
        // Test that components render quickly
        val startTime = System.currentTimeMillis()
        
        composeTestRule.setContent {
            NearMeTheme {
                androidx.compose.foundation.lazy.LazyColumn {
                    items(100) { index ->
                        ListItem(
                            title = "Item $index",
                            subtitle = "Subtitle $index"
                        )
                    }
                }
            }
        }

        val endTime = System.currentTimeMillis()
        val renderTime = endTime - startTime
        
        // Assert that rendering takes less than 1 second
        assert(renderTime < 1000) { "Rendering took too long: ${renderTime}ms" }
    }

    // MARK: - Accessibility Tests
    @Test
    fun components_haveAccessibilitySupport() {
        composeTestRule.setContent {
            NearMeTheme {
                androidx.compose.foundation.layout.Column {
                    PrimaryButton(text = "Accessible Button", onClick = {})
                    ListItem(title = "Accessible Item")
                }
            }
        }

        // Test that components are accessible
        composeTestRule
            .onNodeWithText("Accessible Button")
            .assertHasClickAction()
        
        composeTestRule
            .onNodeWithText("Accessible Item")
            .assertIsDisplayed()
    }
}