package com.nearme.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    size: ButtonSize = ButtonSize.Medium
) {
    Button(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier.height(size.height),
        colors = ButtonDefaults.buttonColors(
            containerColor = Primary,
            contentColor = TextInverse,
            disabledContainerColor = TextTertiary,
            disabledContentColor = TextInverse
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = DesignSystem.Elevation.small
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = TextInverse,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                style = when (size) {
                    ButtonSize.Small -> MaterialTheme.typography.labelLarge
                    ButtonSize.Medium -> MaterialTheme.typography.bodyLarge
                    ButtonSize.Large -> MaterialTheme.typography.titleMedium
                },
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    size: ButtonSize = ButtonSize.Medium
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier.height(size.height),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = Primary,
            disabledContentColor = TextTertiary
        ),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(Primary)
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
        elevation = ButtonDefaults.outlinedButtonElevation(
            defaultElevation = DesignSystem.Elevation.small
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = Primary,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                style = when (size) {
                    ButtonSize.Small -> MaterialTheme.typography.labelLarge
                    ButtonSize.Medium -> MaterialTheme.typography.bodyLarge
                    ButtonSize.Large -> MaterialTheme.typography.titleMedium
                },
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun IconButton(
    icon: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = DesignSystem.IconSize.xl,
    backgroundColor: Color = Surface,
    contentColor: Color = TextPrimary
) {
    Button(
        onClick = onClick,
        modifier = modifier.size(size),
        colors = ButtonDefaults.buttonColors(
            containerColor = backgroundColor,
            contentColor = contentColor
        ),
        shape = androidx.compose.foundation.shape.CircleShape,
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = DesignSystem.Elevation.small
        )
    ) {
        androidx.compose.material3.Icon(
            imageVector = androidx.compose.material.icons.Icons.Default.Add,
            contentDescription = null,
            modifier = Modifier.size(DesignSystem.IconSize.medium)
        )
    }
}

@Composable
fun FloatingActionButton(
    icon: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 56.dp,
    backgroundColor: Color = Primary
) {
    FloatingActionButton(
        onClick = onClick,
        modifier = modifier.size(size),
        containerColor = backgroundColor,
        contentColor = TextInverse,
        elevation = FloatingActionButtonDefaults.elevation(
            defaultElevation = DesignSystem.Elevation.large
        )
    ) {
        androidx.compose.material3.Icon(
            imageVector = androidx.compose.material.icons.Icons.Default.Add,
            contentDescription = null,
            modifier = Modifier.size(DesignSystem.IconSize.large)
        )
    }
}

enum class ButtonSize(val height: androidx.compose.ui.unit.Dp) {
    Small(DesignSystem.ButtonHeight.small),
    Medium(DesignSystem.ButtonHeight.medium),
    Large(DesignSystem.ButtonHeight.large)
}

@Preview(showBackground = true)
@Composable
fun ButtonComponentsPreview() {
    NearMeTheme {
        Column(
            modifier = Modifier.padding(DesignSystem.Spacing.md),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            PrimaryButton(
                text = "Primary Button",
                onClick = {}
            )
            
            PrimaryButton(
                text = "Loading Button",
                onClick = {},
                isLoading = true
            )
            
            PrimaryButton(
                text = "Disabled Button",
                onClick = {},
                enabled = false
            )
            
            SecondaryButton(
                text = "Secondary Button",
                onClick = {}
            )
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                IconButton(
                    icon = "plus",
                    onClick = {}
                )
                
                IconButton(
                    icon = "heart",
                    onClick = {},
                    backgroundColor = Error
                )
                
                IconButton(
                    icon = "star",
                    onClick = {},
                    backgroundColor = Warning
                )
            }
            
            FloatingActionButton(
                icon = "plus",
                onClick = {}
            )
        }
    }
}
