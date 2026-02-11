import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Alert } from 'react-native';
import styles from '../styles/User';
import { COLORS } from '../utils/constants';

const UserWelcomeScreen = ({ navigation, route }) => {
    const { user } = route.params || {};

    const handleLogout = () => {
        // Clear token logic here if we were using persistent storage
        // For now, just navigate back to Welcome
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
        });
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text>No user data found. Please login again.</Text>
                <TouchableOpacity onPress={handleLogout}><Text>Go to Welcome</Text></TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <Text style={styles.greeting}>Welcome to ShareCircle 👋</Text>

            <View style={styles.userInfo}>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.role}>{user.role}</Text>
                {/* Note: Backend returns 'user' or 'admin'. 'donor'/'receiver' not supported by backend yet. */}
            </View>

            <View style={styles.actionContainer}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Profile', { user })}
                >
                    <Text style={styles.buttonText}>View Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.buttonLogout}
                    onPress={handleLogout}
                >
                    <Text style={styles.buttonTextLogout}>Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default UserWelcomeScreen;
