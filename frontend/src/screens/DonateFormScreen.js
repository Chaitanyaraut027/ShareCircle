import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { COLORS, API_URL } from '../utils/constants';

const CATEGORIES = ['Food', 'Clothes', 'Books & Stationery', 'Electronics', 'Medical Supplies', 'Toys', 'Other'];

// This screen allows a donor to list an item for donation.
const DonateFormScreen = ({ navigation }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [quantity, setQuantity] = useState('');
    
    // Address states
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [coords, setCoords] = useState(null);

    const [loading, setLoading] = useState(false);
    const [imageUri, setImageUri] = useState(null);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need camera permission to take a photo.');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleGetCurrentLocation = async () => {
        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is needed to use your current location.');
                setLoading(false);
                return;
            }

            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            if (loc && loc.coords) {
                setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addressObj = reverseGeocode[0];
                    setAddressLine1((addressObj.name || addressObj.street || '').trim());
                    setCity(addressObj.city || addressObj.subregion || '');
                    setStateName(addressObj.region || '');
                } else {
                    setAddressLine1(`Lat: ${loc.coords.latitude.toFixed(4)}`);
                    setCity(`Lng: ${loc.coords.longitude.toFixed(4)}`);
                    setStateName('');
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Could not get current location.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchLocation = async () => {
        if (!addressLine1 || !city || !stateName) {
            Alert.alert('Missing Info', 'Please fill in Line 1, City, and State.');
            return;
        }

        setLoading(true);
        try {
            const query = `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${stateName}`;
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                setCoords({
                    latitude: results[0].latitude,
                    longitude: results[0].longitude
                });
                Alert.alert('Location Updated', 'Location has been successfully updated.');
            } else {
                Alert.alert('Not Found', 'Could not find that location. Please be more specific.');
            }
        } catch (error) {
            console.error('Geocode error:', error);
            Alert.alert('Error', 'An error occurred while searching for the address.');
        } finally {
            setLoading(false);
        }
    };

    const generateAIDescription = async () => {
        if (!title || !category) {
            Alert.alert('Missing Info', 'Please provide a title and category first for AI generation.');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/donations/generate-description`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, category })
            });
            const data = await response.json();
            if (data.success) {
                setDescription(data.description);
            } else {
                Alert.alert('Error', data.message || 'AI generate failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not reach server to generate AI description.');
        }
    };

    // In a real app we'd POST this to a backend endpoint securely
    const handleDonateSubmit = async () => {
        if (!imageUri) {
            Alert.alert('Missing Image', 'Please upload or take a photo of the item.');
            return;
        }
        if (!title || !category || !quantity || !addressLine1 || !city || !stateName) {
            Alert.alert('Missing Fields', 'Please fill all required fields');
            return;
        }
        if (!coords) {
            Alert.alert('Location Not Set', 'Please use the Search button or Use Current button to set the map coordinates.');
            return;
        }

        setLoading(true);
        try {
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;

            const pickupAddress = `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${stateName}`;

            // Build the form data for multipart/form-data upload
            const formData = new FormData();
            formData.append('donorId', user?._id || '60d0fe4f5311236168a109ca');
            formData.append('title', title);
            formData.append('description', description);
            formData.append('category', category);
            formData.append('quantity', quantity);
            formData.append('pickupAddress', pickupAddress);
            formData.append('longitude', String(coords.longitude));
            formData.append('latitude', String(coords.latitude));
            
            // Append the image
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image`;
            formData.append('image', { uri: imageUri, name: filename, type });

            const response = await axios.post(`${API_URL}/donations`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = response.data;
            
            if (data.success) {
                setLoading(false);
                Alert.alert('Success', 'Item posted for donation!');
                navigation.goBack();
            } else {
                setLoading(false);
                Alert.alert('Error', data.message || 'Could not post your donation.');
            }

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

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionTitle}>What are you donating?</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Item Image *</Text>
                    {imageUri ? (
                        <View style={styles.imagePreviewContainer}>
                            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                                <Ionicons name="close-circle" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.imageButtonsContainer}>
                            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                                <Ionicons name="image-outline" size={24} color="#10B981" />
                                <Text style={styles.imageBtnText}>Upload</Text>
                            </TouchableOpacity>
                            <View style={{ width: 10 }} />
                            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
                                <Ionicons name="camera-outline" size={24} color="#10B981" />
                                <Text style={styles.imageBtnText}>Take Photo</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

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
                    {category === 'Food' && (
                        <View style={styles.foodWarning}>
                            <Ionicons name="alert-circle" size={16} color="#E67E22" />
                            <Text style={styles.foodWarningText}>Note: Food items will be automatically removed after 12 hours to ensure freshness.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity *</Text>
                    <TextInput style={styles.input} placeholder="e.g. 1 Box" value={quantity} onChangeText={setQuantity} />
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Description</Text>
                        <TouchableOpacity style={styles.aiButton} onPress={generateAIDescription}>
                            <Ionicons name="sparkles" size={16} color="#8B5CF6" />
                            <Text style={styles.aiButtonText}>AI Gen</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput 
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                        placeholder="Condition, sizes, specific details..." 
                        multiline 
                        value={description} 
                        onChangeText={setDescription} 
                    />
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Pickup Address *</Text>
                        <TouchableOpacity style={styles.locationButton} onPress={handleGetCurrentLocation}>
                            <Ionicons name="navigate-circle-outline" size={20} color="#3B82F6" />
                            <Text style={styles.locationButtonText}>Use Current</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <TextInput 
                        style={[styles.input, { marginBottom: 10 }]} 
                        placeholder="Line 1 (Address)" 
                        value={addressLine1} 
                        onChangeText={(text) => { setAddressLine1(text); setCoords(null); }} 
                    />
                    <TextInput 
                        style={[styles.input, { marginBottom: 10 }]} 
                        placeholder="Line 2 (Optional)" 
                        value={addressLine2} 
                        onChangeText={(text) => { setAddressLine2(text); setCoords(null); }} 
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <TextInput 
                            style={[styles.input, { flex: 1, marginRight: 5 }]} 
                            placeholder="City" 
                            value={city} 
                            onChangeText={(text) => { setCity(text); setCoords(null); }}
                        />
                        <TextInput 
                            style={[styles.input, { flex: 1, marginLeft: 5 }]} 
                            placeholder="State" 
                            value={stateName} 
                            onChangeText={(text) => { setStateName(text); setCoords(null); }}
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.searchLocalBtn, coords && { backgroundColor: '#E2E8F0' }]} 
                        onPress={handleSearchLocation}
                        disabled={loading}
                    >
                        <Text style={[styles.searchLocalBtnText, coords && { color: '#64748B' }]}>{coords ? 'Location Pinned ✓' : 'Search Location'}</Text>
                    </TouchableOpacity>
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
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    imageButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    imageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#10B981', borderRadius: 12, backgroundColor: '#ECFDF5' },
    imageBtnText: { color: '#10B981', fontWeight: '600', marginLeft: 8 },
    imagePreviewContainer: { position: 'relative', width: '100%', height: 200, borderRadius: 12, overflow: 'hidden' },
    imagePreview: { width: '100%', height: '100%' },
    removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 2 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    aiButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    aiButtonText: { color: '#8B5CF6', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    locationButton: { flexDirection: 'row', alignItems: 'center' },
    locationButtonText: { color: '#3B82F6', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
    searchLocalBtn: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 5 },
    searchLocalBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    foodWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4E5', padding: 10, borderRadius: 8, marginTop: 8 },
    foodWarningText: { color: '#663C00', fontSize: 12, marginLeft: 8, flex: 1, fontWeight: '500' }
});

export default DonateFormScreen;
