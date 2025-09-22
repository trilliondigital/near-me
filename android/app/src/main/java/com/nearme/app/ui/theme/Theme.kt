package com.nearme.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryLight,
    onPrimary = TextInverse,
    primaryContainer = PrimaryDark,
    onPrimaryContainer = TextInverse,
    secondary = SecondaryLight,
    onSecondary = TextInverse,
    secondaryContainer = SecondaryDark,
    onSecondaryContainer = TextInverse,
    tertiary = AccentLight,
    onTertiary = TextInverse,
    tertiaryContainer = AccentDark,
    onTertiaryContainer = TextInverse,
    error = Error,
    onError = TextInverse,
    errorContainer = Error.copy(alpha = 0.1f),
    onErrorContainer = Error,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkCard,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    outlineVariant = DarkBorder.copy(alpha = 0.5f),
    scrim = Color.Black.copy(alpha = 0.5f)
)

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = TextInverse,
    primaryContainer = PrimaryLight,
    onPrimaryContainer = TextInverse,
    secondary = Secondary,
    onSecondary = TextInverse,
    secondaryContainer = SecondaryLight,
    onSecondaryContainer = TextInverse,
    tertiary = Accent,
    onTertiary = TextInverse,
    tertiaryContainer = AccentLight,
    onTertiaryContainer = TextInverse,
    error = Error,
    onError = TextInverse,
    errorContainer = Error.copy(alpha = 0.1f),
    onErrorContainer = Error,
    background = Background,
    onBackground = TextPrimary,
    surface = Surface,
    onSurface = TextPrimary,
    surfaceVariant = Card,
    onSurfaceVariant = TextSecondary,
    outline = Border,
    outlineVariant = BorderLight,
    scrim = Color.Black.copy(alpha = 0.5f)
)

@Composable
fun NearMeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}