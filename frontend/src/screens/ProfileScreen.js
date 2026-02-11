import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import styles from '../styles/Profile';
import { COLORS } from '../utils/constants';

const ProfileScreen = ({ navigation, route }) => {
    const { user } = route.params || {};

    const handleLogout = () => {
        // Clear token logic here if needed
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
        });
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text>No user data found.</Text>
                <TouchableOpacity onPress={handleLogout}><Text>Go Back</Text></TouchableOpacity>
            </View>
        );
    }

    const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1) {
            return (names[0][0] + names[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

            <View style={styles.header}>
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
                </View>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.role}>{user.role}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.detailsContainer}>
                <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{user.email}</Text>
                </View>

                <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Mobile</Text>
                    <Text style={styles.detailValue}>{user.mobileNumber || 'N/A'}</Text>
                </View>

                <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>User ID</Text>
                    <Text style={{ ...styles.detailValue, fontSize: 12, color: '#aaa' }}>{user._id}</Text>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
            >
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default ProfileScreen;
