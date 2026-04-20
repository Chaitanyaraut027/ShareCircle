import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/Auth';
import { registerUser } from '../services/api';

const RegisterScreen = ({ navigation }) => {
    const [fullName, setFullName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async () => {
        if (!fullName || !mobileNumber || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (mobileNumber.length !== 10) {
            Alert.alert('Error', 'Mobile number must be exactly 10 digits');
            return;
        }

        if (!email.includes('@')) {
            Alert.alert('Error', 'Email must be valid and contain @');
            return;
        }

        setLoading(true);
        try {
            const userData = {
                fullName,
                mobileNumber,
                email,
                password,
            };

            const response = await registerUser(userData);

            if (response.success) {
                Alert.alert('Success', 'Registration successful! Please login.');
                navigation.navigate('Login');
            }
        } catch (error) {
            Alert.alert('Error', error.data?.message || error.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerSection}>
                        <View style={styles.logoContainer}>
                            <MaterialCommunityIcons name="account-heart" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.title}>Join Circle</Text>
                        <Text style={styles.subtitle}>Start your journey of giving today</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Full Name</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="user" size={20} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.inputField}
                                placeholder="John Doe"
                                placeholderTextColor="#94A3B8"
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Mobile Number</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="phone" size={20} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.inputField}
                                placeholder="10-digit number"
                                placeholderTextColor="#94A3B8"
                                value={mobileNumber}
                                onChangeText={(val) => setMobileNumber(val)}
                                keyboardType="phone-pad"
                                maxLength={10}
                            />
                        </View>
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

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <View style={styles.footerLinkRow}>
                            <Text style={styles.footerText}>Already have an account?</Text>
                            <Text style={styles.footerLinkBold}>Sign In</Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

export default RegisterScreen;
