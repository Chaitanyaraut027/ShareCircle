
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent native splash screen from autohiding
SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

const SplashScreenComponent = ({ navigation }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const prepare = async () => {
            try {
                // Pre-load logic (if any)
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate loading or simply wait
            } catch (e) {
                console.warn(e);
            } finally {
                await SplashScreen.hideAsync();
                navigation.replace('Onboarding'); // Navigate to Onboarding sliders
            }
        };

        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
        }).start();

        prepare();
    }, [navigation, fadeAnim]);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
                {/* Logo */}
                <Image
                    source={require('../../assets/splash.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                {/* App Name */}
                <Text style={styles.title}>ShareCircle</Text>

                {/* Tagline */}
                <Text style={styles.tagline}>Share More. Care More.</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        alignItems: 'center',
        padding: 20,
    },
    logo: {
        width: width * 0.5,
        height: width * 0.5,
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FF8C42',
        marginBottom: 10,
    },
    tagline: {
        fontSize: 18,
        color: '#2E86DE',
        fontStyle: 'italic',
    },
});

export default SplashScreenComponent;
