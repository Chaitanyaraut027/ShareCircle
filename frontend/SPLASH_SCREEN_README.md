# ShareCircle Splash Screen Implementation

This document explains the implementation of the ShareCircle Splash Screen.

## Files Created/Modified

1.  **`src/screens/SplashScreen.js` (New)**
    -   **Purpose**: This is the custom splash screen component that users see after the native splash screen.
    -   **Functionality**:
        -   Displays the ShareCircle logo, app name, and tagline.
        -   Uses a fade-in animation for a smooth entry.
        -   Waits for 2 seconds (simulating asset loading or just branding time).
        -   Navigates to the `Welcome` screen automatically.
        -   Uses `expo-splash-screen` to control the native splash screen visibility, preventing a white flash during the transition.

2.  **`app.json` (Modified)**
    -   **Change**: Updated the `splash` configuration.
    -   **Purpose**: Sets the native launch screen (what you see immediately when tapping the app icon) to consistent branding (`./assets/splash.png`) and background color (`#F5F7FA`).

3.  **`src/navigation/AppNavigator.js` (Modified)**
    -   **Change**: Added `SplashScreen` to the stack and set it as the `initialRouteName`.
    -   **Purpose**: Ensures the app starts on the Splash Screen before moving to the authentication flow.

## How it Works Step-by-Step

1.  **App Launch**: User taps the app icon. The **native splash screen** (configured in `app.json`) appears immediately.
2.  **JS Load**: React Native loads the JavaScript bundle in the background.
3.  **Component Mount**: `AppNavigator` mounts, rendering `SplashScreen.js` as the first screen.
4.  **Transition**: `SplashScreen.js` calls `SplashScreen.preventAutoHideAsync()` (implicitly handled by Expo usually, but good to be explicit if needed) to keep the native image visible until our React component is ready. Then it fades in the content.
5.  **Navigation**: After a 2-second timer, the app navigates to the `Welcome` screen, which presents the Login/Register options.

## Setup Instructions

1.  Ensure `expo-splash-screen` is installed:
    ```bash
    npm install expo-splash-screen
    ```
2.  Place your actual logo file at `./assets/splash.png`.
3.  Run the app:
    ```bash
    npm run android
    ```
