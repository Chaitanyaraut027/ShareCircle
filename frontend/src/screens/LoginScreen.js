import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/Auth';
import { loginUser, updateUserLocation } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import CustomToast from '../components/CustomToast';


const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // location modal states
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationUpdating, setLocationUpdating] = useState(false);
    const [storedUser, setStoredUser] = useState(null);
    
    // Toast setup
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setToastVisible(true);
    };


    const handleLogin = async () => {
        if (!email || !password) {
            showToast('Enter email and password.', 'error');
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
                showToast('Login failed. Check details.', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Login failed.', 'error');
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
            <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerSection}>
                        <View style={styles.logoContainer}>
                            <MaterialCommunityIcons name="heart-multiple" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue sharing kindness</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="mail" size={20} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.inputField}
                                placeholder="name@example.com"
                                placeholderTextColor="#94A3B8"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="lock" size={20} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.inputField}
                                placeholder="••••••••"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => Alert.alert('Information', 'Please contact support at support@sharecircle.com to reset your password.')}>
                        <Text style={styles.forgotPassword}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <View style={styles.footerLinkRow}>
                            <Text style={styles.footerText}>New to ShareCircle?</Text>
                            <Text style={styles.footerLinkBold}>Create Account</Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>
            </TouchableWithoutFeedback>

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
