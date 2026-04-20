import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainTabNavigator from './MainTabNavigator';
import DonateFormScreen from '../screens/DonateFormScreen';
import DonationDetailScreen from '../screens/DonationDetailScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import RequestsScreen from '../screens/RequestsScreen';
import FindNearbyDonationsScreen from '../screens/FindNearbyDonationsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';


const Stack = createStackNavigator();

const AppNavigator = () => {
    return (
        <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="DonateForm" component={DonateFormScreen} />
            <Stack.Screen name="DonationDetail" component={DonationDetailScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Requests" component={RequestsScreen} />
            <Stack.Screen name="NearMe" component={FindNearbyDonationsScreen} />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    headerShown: true,
                    title: 'My Profile',
                    headerBackTitleVisible: false,
                }}
            />
            <Stack.Screen name="History" component={HistoryScreen} />

        </Stack.Navigator>
    );
};

export default AppNavigator;
