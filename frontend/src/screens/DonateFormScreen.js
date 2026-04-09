import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../utils/constants';

const CATEGORIES = ['Food', 'Clothes', 'Books & Stationery', 'Electronics', 'Medical Supplies', 'Toys', 'Other'];

// This screen allows a donor to list an item for donation.
const DonateFormScreen = ({ navigation }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [quantity, setQuantity] = useState('');
    const [pickupAddress, setPickupAddress] = useState('');
    const [loading, setLoading] = useState(false);

    // In a real app we'd POST this to a backend endpoint securely
    const handleDonateSubmit = async () => {
        if (!title || !category || !quantity || !pickupAddress) {
            Alert.alert('Missing Fields', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is needed to post your donation accurately on the maps.');
                setLoading(false);
                return;
            }

            let coords = { longitude: 72.8777, latitude: 19.0760 }; // Fallback coords
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
                if (loc && loc.coords) coords = loc.coords;
            } catch (err) {
                console.warn("Could not get live loc, using fallback", err);
            }

            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;

            // Mock submission. You would connect to your POST /api/donations endpoint.
            console.log('Submitting donation:', {
                 donorId: user?._id,
                 title, description, category, quantity, pickupAddress,
                 location: [coords.longitude, coords.latitude]
            });
            
            setTimeout(() => {
                setLoading(false);
                Alert.alert('Success', 'Item posted for donation!');
                navigation.goBack();
            }, 1000);

        } catch (error) {
            setLoading(false);
            console.error(error);
            Alert.alert('Error', error.message || 'Could not fetch location or submit donation.');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Donate an Item</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.sectionTitle}>What are you donating?</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput style={styles.input} placeholder="e.g. 5 Winter Jackets" value={title} onChangeText={setTitle} />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Category *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingVertical: 10 }}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity *</Text>
                    <TextInput style={styles.input} placeholder="e.g. 1 Box" value={quantity} onChangeText={setQuantity} />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput 
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                        placeholder="Condition, sizes, specific details..." 
                        multiline 
                        value={description} 
                        onChangeText={setDescription} 
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Pickup Address *</Text>
                    <TextInput style={styles.input} placeholder="Enter exact address or landmark" value={pickupAddress} onChangeText={setPickupAddress} />
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleDonateSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Post Donation</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    container: { padding: 20 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
    input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    categoryPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    categoryPillActive: { backgroundColor: '#10B981' },
    categoryText: { color: '#64748B', fontWeight: '600' },
    categoryTextActive: { color: '#FFF' },
    submitBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

export default DonateFormScreen;
