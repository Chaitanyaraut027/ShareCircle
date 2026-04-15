import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/Auth';
import { loginUser, updateUserLocation } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // location modal states
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationUpdating, setLocationUpdating] = useState(false);
    const [storedUser, setStoredUser] = useState(null);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            const response = await loginUser(email, password);

            if (response && response.token) {
                // Save token and user to AsyncStorage
                await AsyncStorage.setItem('token', response.token);
                await AsyncStorage.setItem('user', JSON.stringify(response.data));
                
                // Instead of Alert.alert, trigger the custom Modal
                setStoredUser(response.data);
                setShowLocationModal(true);
            } else {
                Alert.alert('Error', 'Login failed. Please try again.');
            }
        } catch (error) {
            Alert.alert('Error', error.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipLocation = () => {
        setShowLocationModal(false);
        if (storedUser) {
            navigation.replace('MainTabs', { user: storedUser });
        }
    };

    const handleUpdateLocation = async () => {
        if (!storedUser) return;
        try {
            setLocationUpdating(true);
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Falling back to default location.');
                handleSkipLocation();
                return;
            }
            
            let loc = await Location.getCurrentPositionAsync({});
            let lat = loc.coords.latitude;
            let lon = loc.coords.longitude;
            let addressStr = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
            try {
                const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
                if (rev && rev.length > 0) {
                    const { name, street, district, city, subregion, region, country } = rev[0];
                    addressStr = [name, street, district, city, subregion, region, country]
                        .filter((v, i, s) => v && s.indexOf(v) === i).join(', ');
                }
            } catch (revErr) {
                console.warn('Expo reverse geocode failed:', revErr);
            }

            const res = await updateUserLocation(storedUser._id, lat, lon, addressStr);
            
            let updatedUser = storedUser;
            if (res && res.success && res.user) {
                updatedUser = res.user;
                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            }
            
            setShowLocationModal(false);
            navigation.replace('MainTabs', { user: updatedUser });
        } catch (err) {
            console.error(err);
            handleSkipLocation();
        } finally {
            setLocationUpdating(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Welcome Back</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                    <Text style={styles.linkText}>Don't have an account? Register</Text>
                </TouchableOpacity>
            </ScrollView>
            <Modal visible={showLocationModal} animationType="slide" transparent>
                <View style={modalStyles.modalOverlay}>
                    <View style={modalStyles.modalContainer}>
                        <Text style={modalStyles.modalTitle}>Update Location</Text>
                        <Text style={modalStyles.modalDesc}>
                            Do you want to update your location to find nearby donations and requests instantly on the map?
                        </Text>
                        
                        {locationUpdating ? (
                            <View style={modalStyles.loadingContainer}>
                                <ActivityIndicator size="large" color="#10B981" />
                                <Text style={modalStyles.loadingText}>Fetching location...</Text>
                            </View>
                        ) : (
                            <View style={modalStyles.btnRow}>
                                <TouchableOpacity style={modalStyles.skipBtn} onPress={handleSkipLocation}>
                                    <Text style={modalStyles.skipBtnText}>Skip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={modalStyles.updateBtn} onPress={handleUpdateLocation}>
                                    <Text style={modalStyles.updateBtnText}>Update Location</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const modalStyles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: {height: 2, width: 0}, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'center' },
    modalDesc: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    btnRow: { flexDirection: 'row', justifyContent: 'space-between' },
    skipBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 8, marginRight: 10, alignItems: 'center' },
    skipBtnText: { color: '#64748B', fontWeight: 'bold', fontSize: 16 },
    updateBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#10B981', borderRadius: 8, marginLeft: 10, alignItems: 'center' },
    updateBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    loadingContainer: { alignItems: 'center', paddingVertical: 15 },
    loadingText: { marginTop: 10, color: '#10B981', fontWeight: 'bold' }
});

export default LoginScreen;
