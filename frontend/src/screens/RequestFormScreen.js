import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORIES = ['Food', 'Clothes', 'Books & Stationery', 'Electronics', 'Medical Supplies', 'Other'];

// This screen allows a receiver to post a request for help.
const RequestFormScreen = ({ navigation }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRequestSubmit = async () => {
        if (!title || !category || !description) {
            Alert.alert('Missing Fields', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is needed to post your request accurately on the maps.');
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

            // Mock submission. Connect to your POST /api/requests endpoint.
            console.log('Submitting request:', {
                 requesterId: user?._id,
                 title, description, category,
                 location: [coords.longitude, coords.latitude]
            });
            
            setTimeout(() => {
                setLoading(false);
                Alert.alert('Success', 'Your request has been posted!');
                navigation.goBack();
            }, 1000);

        } catch (error) {
            setLoading(false);
            console.error(error);
            Alert.alert('Error', error.message || 'Could not gather location to post request.');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Request Help</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.sectionTitle}>What do you need?</Text>
                <Text style={styles.subtitle}>Nearby donors will see this request and can offer assistance.</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput style={styles.input} placeholder="e.g. Need old textbooks for 5th grade" value={title} onChangeText={setTitle} />
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
                    <Text style={styles.label}>Description & Why you need it *</Text>
                    <TextInput 
                        style={[styles.input, { height: 120, textAlignVertical: 'top' }]} 
                        placeholder="Provide details to help donors understand your needs..." 
                        multiline 
                        value={description} 
                        onChangeText={setDescription} 
                    />
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleRequestSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Post Request</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    container: { padding: 20 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 5 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
    input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    categoryPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    categoryPillActive: { backgroundColor: '#F39C12' }, // Request uses warm orange
    categoryText: { color: '#64748B', fontWeight: '600' },
    categoryTextActive: { color: '#FFF' },
    submitBtn: { backgroundColor: '#F39C12', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#F39C12', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

export default RequestFormScreen;
