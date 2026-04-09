import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/Profile';
import { COLORS } from '../utils/constants';
import { getUserHistory } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfileScreen = ({ navigation, route }) => {
    const defaultUser = route.params?.user || null;
    const [user, setUser] = useState(defaultUser);
    const [history, setHistory] = useState({ donated: [], received: [] });

    useEffect(() => {
        const loadUserAndHistory = async () => {
            let currentUser = defaultUser;
            if (!currentUser) {
                const storedUser = await AsyncStorage.getItem('user');
                if (storedUser) {
                    currentUser = JSON.parse(storedUser);
                    setUser(currentUser);
                }
            }
            if (currentUser && currentUser._id) {
                const res = await getUserHistory(currentUser._id);
                if (res && res.success) {
                    setHistory(res.data);
                }
            }
        };
        loadUserAndHistory();
    }, []);

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

                {/* History Section */}
                <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>History 🌿</Text>
                    
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#10B981', marginTop: 10 }}>Donated Items</Text>
                    {history.donated.length === 0 ? (
                        <Text style={{ color: '#aaa' }}>No items donated yet.</Text>
                    ) : (
                        history.donated.map((item, idx) => (
                            <View key={idx} style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 8, marginVertical: 5 }}>
                                <Text style={{ fontWeight: '600' }}>{item.title}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B' }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                        ))
                    )}

                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#F39C12', marginTop: 15 }}>Received Items</Text>
                    {history.received.length === 0 ? (
                        <Text style={{ color: '#aaa' }}>No items received yet.</Text>
                    ) : (
                        history.received.map((item, idx) => (
                            <View key={idx} style={{ backgroundColor: '#FFFBEB', padding: 10, borderRadius: 8, marginVertical: 5 }}>
                                <Text style={{ fontWeight: '600' }}>{item.title}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B' }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                        ))
                    )}
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
