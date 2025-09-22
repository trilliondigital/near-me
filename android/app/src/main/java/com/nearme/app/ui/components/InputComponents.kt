package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

@Composable
fun TextInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    errorMessage: String? = null,
    isRequired: Boolean = false,
    isEnabled: Boolean = true
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            
            if (isRequired) {
                Text(
                    text = "*",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Error
                )
            }
        }
        
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = {
                Text(
                    text = placeholder,
                    color = TextSecondary
                )
            },
            enabled = isEnabled,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
            trailingIcon = if (isPassword) {
                IconButton(onClick = { /* Toggle password visibility */ }) {
                    Icon(
                        imageVector = Icons.Default.Visibility,
                        contentDescription = "Toggle password visibility",
                        tint = TextSecondary
                    )
                }
            } else null,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Primary,
                unfocusedBorderColor = Border,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                disabledTextColor = TextTertiary,
                disabledBorderColor = Border.copy(alpha = 0.5f)
            ),
            shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
            modifier = Modifier.fillMaxWidth()
        )
        
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.labelMedium,
                color = Error
            )
        }
    }
}

@Composable
fun SearchField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search...",
    onSearchClick: (() -> Unit)? = null
) {
    var isEditing by remember { mutableStateOf(false) }
    
    OutlinedTextField(
        value = value,
        onValueChange = { newValue ->
            onValueChange(newValue)
            isEditing = newValue.isNotEmpty()
        },
        placeholder = {
            Text(
                text = placeholder,
                color = TextSecondary
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = TextSecondary
            )
        },
        trailingIcon = {
            if (isEditing && value.isNotEmpty()) {
                IconButton(onClick = {
                    onValueChange("")
                    isEditing = false
                }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Clear search",
                        tint = TextSecondary
                    )
                }
            }
        },
        singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Primary,
            unfocusedBorderColor = Border,
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
fun <T> PickerField(
    label: String,
    selectedValue: T,
    onValueChange: (T) -> Unit,
    options: List<T>,
    optionLabel: (T) -> String,
    modifier: Modifier = Modifier,
    isRequired: Boolean = false,
    errorMessage: String? = null,
    isEnabled: Boolean = true
) {
    var isExpanded by remember { mutableStateOf(false) }
    
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            
            if (isRequired) {
                Text(
                    text = "*",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Error
                )
            }
        }
        
        ExposedDropdownMenuBox(
            expanded = isExpanded,
            onExpandedChange = { isExpanded = !isExpanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = optionLabel(selectedValue),
                onValueChange = {},
                readOnly = true,
                enabled = isEnabled,
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = isExpanded)
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = Border,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    disabledTextColor = TextTertiary,
                    disabledBorderColor = Border.copy(alpha = 0.5f)
                ),
                shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
            )
            
            ExposedDropdownMenu(
                expanded = isExpanded,
                onDismissRequest = { isExpanded = false }
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = optionLabel(option),
                                color = if (option == selectedValue) Primary else TextPrimary
                            )
                        },
                        onClick = {
                            onValueChange(option)
                            isExpanded = false
                        },
                        leadingIcon = if (option == selectedValue) {
                            {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Primary
                                )
                            }
                        } else null
                    )
                }
            }
        }
        
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.labelMedium,
                color = Error
            )
        }
    }
}

@Composable
fun ToggleField(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            
            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondary
                )
            }
        }
        
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = TextInverse,
                checkedTrackColor = Primary,
                uncheckedThumbColor = TextInverse,
                uncheckedTrackColor = Border
            )
        )
    }
}

@Composable
fun SliderField(
    title: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    modifier: Modifier = Modifier,
    unit: String = "",
    description: String? = null
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            
            Text(
                text = "${value.toInt()}${unit}",
                style = MaterialTheme.typography.bodyMedium,
                color = Primary,
                fontWeight = FontWeight.Medium
            )
        }
        
        if (description != null) {
            Text(
                text = description,
                style = MaterialTheme.typography.labelMedium,
                color = TextSecondary
            )
        }
        
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            colors = SliderDefaults.colors(
                thumbColor = Primary,
                activeTrackColor = Primary,
                inactiveTrackColor = Border
            )
        )
    }
}

@Preview(showBackground = true)
@Composable
fun InputComponentsPreview() {
    NearMeTheme {
        Column(
            modifier = Modifier.padding(DesignSystem.Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
        ) {
            TextInputField(
                label = "Task Title",
                value = "",
                onValueChange = {},
                placeholder = "Enter task title",
                isRequired = true
            )
            
            SearchField(
                value = "",
                onValueChange = {},
                placeholder = "Search places..."
            )
            
            PickerField(
                label = "Category",
                selectedValue = "Option 1",
                onValueChange = {},
                options = listOf("Option 1", "Option 2", "Option 3"),
                optionLabel = { it }
            )
            
            ToggleField(
                title = "Enable Notifications",
                checked = false,
                onCheckedChange = {},
                description = "Receive notifications when near your tasks"
            )
            
            SliderField(
                title = "Radius",
                value = 5f,
                onValueChange = {},
                valueRange = 0.1f..10f,
                unit = " mi",
                description = "Distance from location to trigger notification"
            )
        }
    }
}
