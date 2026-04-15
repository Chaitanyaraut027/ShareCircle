import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, StyleSheet, Modal, TextInput, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/Profile';
import { COLORS } from '../utils/constants';
import { getUserHistory, updateUserLocation, updateProfilePicture } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation, route }) => {
    const defaultUser = route.params?.user || null;
    const [user, setUser] = useState(defaultUser);
    const [history, setHistory] = useState({ donated: [], received: [] });
    const [showLocModal, setShowLocModal] = useState(false);
    const [locLoading, setLocLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [fullPicVisible, setFullPicVisible] = useState(false);
    
    // Address Form States
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [city, setCity] = useState('');
    const [state, setStateName] = useState('');
    
    // Map State
    const [selectedLocation, setSelectedLocation] = useState(null);

    const handlePickImage = async () => {
        Alert.alert(
            "Profile Picture",
            "Choose an option",
            [
                { text: "Take Photo", onPress: takePhoto },
                { text: "Choose from Gallery", onPress: pickFromGallery },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const pickFromGallery = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            handleUploadImage(result.assets[0].uri);
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
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            handleUploadImage(result.assets[0].uri);
        }
    };

    const handleUploadImage = async (uri) => {
        setUploadLoading(true);
        try {
            const res = await updateProfilePicture(user._id, uri);
            if (res && res.success && res.user) {
                await AsyncStorage.setItem('user', JSON.stringify(res.user));
                setUser({ ...res.user });
                Alert.alert('Success', 'Profile picture updated! 🌿');
            } else {
                Alert.alert('Failed', 'Could not upload profile picture.');
            }
        } catch (error) {
            console.error('Upload error', error);
            Alert.alert('Error', 'Failed to submit profile picture.');
        } finally {
            setUploadLoading(false);
        }
    };

    const handleSearchLocation = async () => {
        if (!addressLine1 || !city || !state) {
            Alert.alert('Missing Info', 'Please fill in Line 1, City, and State.');
            return;
        }

        setLocLoading(true);
        try {
            // Request permissions before geocoding
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow location access to search for an address.');
                setLocLoading(false);
                return;
            }

            const query = `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${state}`;
            
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                setSelectedLocation({
                    lat: results[0].latitude,
                    lon: results[0].longitude,
                    address: query
                });
            } else {
                Alert.alert('Not Found', 'Could not find that location. Please check your spelling or be more specific.');
            }
        } catch (error) {
            console.error('Geocode error:', error);
            Alert.alert('Error', 'An error occurred while geocoding the address.');
        } finally {
            setLocLoading(false);
        }
    };

    const handleSaveLocation = async () => {
        if (!selectedLocation) {
            Alert.alert('No Location', 'Please search for an address first.');
            return;
        }

        setLocLoading(true);
        try {
            if (!user?._id) {
                Alert.alert('Error', 'No user found. Please log in again.');
                return;
            }

            const { lat, lon, address } = selectedLocation;
            const res = await updateUserLocation(user._id, lat, lon, address);

            if (res.success && res.user) {
                await AsyncStorage.setItem('user', JSON.stringify(res.user));
                setUser({ ...res.user });
                Alert.alert('Location Updated!', address);
                setShowLocModal(false);
                setAddressLine1('');
                setAddressLine2('');
                setCity('');
                setStateName('');
                setSelectedLocation(null);
            } else {
                Alert.alert('Failed', res.message || 'Could not update location on server.');
            }
        } catch (error) {
            console.error('Update location error:', error);
            Alert.alert('Error', 'An error occurred while saving the location.');
        } finally {
            setLocLoading(false);
        }
    };

    const handleCurrentLocation = async () => {
        setLocLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow location access.');
                setLocLoading(false);
                return;
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = loc.coords.latitude;
            const lon = loc.coords.longitude;

            let addressStr = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
            try {
                const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
                if (rev && rev.length > 0) {
                    const { name, street, district, city, subregion, region, country } = rev[0];
                    addressStr = [name, street, district, city, subregion, region, country]
                        .filter((v, i, s) => v && s.indexOf(v) === i).join(', ');
                }
            } catch (revErr) {
                console.warn('Expo reverse geocode failed:', revErr.message);
            }

            setSelectedLocation({
                lat: lat,
                lon: lon,
                address: addressStr
            });

        } catch (error) {
            console.error('Location Error:', error);
            Alert.alert('Error', 'Failed to get current location. Ensure location services are enabled.');
        } finally {
            setLocLoading(false);
        }
    };

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
                <TouchableOpacity onPress={() => { if(user.profilePic) setFullPicVisible(true); }}>
                    <View style={[styles.avatarPlaceholder, {overflow: 'hidden', backgroundColor: '#FFF', position: 'relative'}]}>
                        {user.profilePic ? (
                            <Image source={{ uri: user.profilePic }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                        ) : (
                            <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
                        )}
                        <TouchableOpacity style={{position: 'absolute', bottom: -5, right: -5, backgroundColor: '#FFF', borderRadius: 15, padding: 4, elevation: 2}} onPress={handlePickImage} disabled={uploadLoading}>
                            <Ionicons name="camera" size={16} color="#4B8BF5" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.role}>{user.role?.toUpperCase()}</Text>
                {uploadLoading && <ActivityIndicator style={{marginTop: 10}} color="#FFF" />}
                
                <TouchableOpacity onPress={handlePickImage} disabled={uploadLoading} style={{backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 15, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3}}>
                    <Ionicons name="camera" size={18} color="#2F7B5E" style={{marginRight: 6}} />
                    <Text style={{color: '#2F7B5E', fontWeight: 'bold'}}>Upload Profile Picture</Text>
                </TouchableOpacity>
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

                {/* Location Section */}
                <View style={[styles.detailItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={styles.detailLabel}>Current Location</Text>
                    <Text style={[styles.detailValue, { marginTop: 4, marginBottom: 12, color: user.address?.fullAddress ? '#333' : '#aaa' }]}>
                        {user.address?.fullAddress ? user.address.fullAddress : 'Location not set'}
                    </Text>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }}
                        onPress={() => setShowLocModal(true)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Update Location</Text>
                    </TouchableOpacity>
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
                <TouchableOpacity
                    style={[styles.logoutButton, { marginTop: 30, marginBottom: 120 }]}
                    onPress={handleLogout}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Update Location Modal */}
            <Modal visible={showLocModal} animationType="slide" transparent>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContainer}>
                        <Text style={localStyles.modalTitle}>Set Your Location</Text>
                        
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <TextInput 
                                style={[localStyles.inputContainer, { paddingHorizontal: 15, fontSize: 14 }]}
                                placeholder="Line 1 (Address)"
                                value={addressLine1}
                                onChangeText={setAddressLine1}
                            />
                            <TextInput 
                                style={[localStyles.inputContainer, { paddingHorizontal: 15, fontSize: 14 }]}
                                placeholder="Line 2 (Optional)"
                                value={addressLine2}
                                onChangeText={setAddressLine2}
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <TextInput 
                                    style={[localStyles.inputContainer, { paddingHorizontal: 15, fontSize: 14, flex: 1, marginRight: 5 }]}
                                    placeholder="City"
                                    value={city}
                                    onChangeText={setCity}
                                />
                                <TextInput 
                                    style={[localStyles.inputContainer, { paddingHorizontal: 15, fontSize: 14, flex: 1, marginLeft: 5 }]}
                                    placeholder="State"
                                    value={state}
                                    onChangeText={setStateName}
                                />
                            </View>

                            {selectedLocation && (
                                <View style={{ height: 180, borderRadius: 10, overflow: 'hidden', marginBottom: 15 }}>
                                    <MapView
                                        style={{ flex: 1 }}
                                        region={{
                                            latitude: selectedLocation.lat,
                                            longitude: selectedLocation.lon,
                                            latitudeDelta: 0.01,
                                            longitudeDelta: 0.01,
                                        }}
                                    >
                                        <Marker coordinate={{ latitude: selectedLocation.lat, longitude: selectedLocation.lon }} pinColor="#10B981" />
                                    </MapView>
                                </View>
                            )}

                            {locLoading ? (
                                <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 10 }} />
                            ) : (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <TouchableOpacity style={[localStyles.searchBtn, { flex: 1, marginRight: 5 }]} onPress={handleSearchLocation}>
                                        <Text style={localStyles.searchBtnText}>Search</Text>
                                    </TouchableOpacity>
                                    {selectedLocation && (
                                        <TouchableOpacity style={[localStyles.searchBtn, { flex: 1, marginLeft: 5, backgroundColor: '#3498DB' }]} onPress={handleSaveLocation}>
                                            <Text style={localStyles.searchBtnText}>Save</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            <View style={localStyles.dividerRow}>
                                <View style={localStyles.dividerLine} />
                                <Text style={localStyles.dividerText}>OR</Text>
                                <View style={localStyles.dividerLine} />
                            </View>

                            <TouchableOpacity 
                                style={localStyles.gpsBtn} 
                                onPress={handleCurrentLocation}
                                disabled={locLoading}
                            >
                                <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={localStyles.gpsBtnText}>Use My Current Location</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={localStyles.closeBtn} onPress={() => {
                                setShowLocModal(false);
                                setSelectedLocation(null);
                            }}>
                                <Text style={localStyles.closeBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Full Image Modal */}
            <Modal visible={fullPicVisible} transparent={true} animationType="fade">
                <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center'}}>
                    <TouchableOpacity style={{position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10}} onPress={() => setFullPicVisible(false)}>
                        <Ionicons name="close" size={32} color="#FFF" />
                    </TouchableOpacity>
                    {user.profilePic && (
                        <Image source={{ uri: user.profilePic }} style={{ width: '100%', height: width, resizeMode: 'contain' }} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: {height: 2, width: 0}, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, height: 45, marginBottom: 15 },
    input: { flex: 1, marginLeft: 10, fontSize: 14, color: '#333' },
    searchBtn: { backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    searchBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
    dividerText: { marginHorizontal: 10, color: '#94A3B8', fontWeight: 'bold', fontSize: 12 },
    gpsBtn: { flexDirection: 'row', backgroundColor: '#F39C12', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    gpsBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    closeBtn: { alignItems: 'center', paddingVertical: 10 },
    closeBtnText: { color: '#64748B', fontWeight: '600' }
});

export default ProfileScreen;
