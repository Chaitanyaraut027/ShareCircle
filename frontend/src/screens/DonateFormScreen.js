import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image, Dimensions, StatusBar, TouchableWithoutFeedback, Keyboard, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import LeafletMap from '../components/LeafletMap'; // kept for any future use
import { useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { COLORS, API_URL } from '../utils/constants';
import CustomToast from '../components/CustomToast';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { name: 'Food', icon: 'fast-food-outline', color: '#EF4444' },
    { name: 'Clothes', icon: 'shirt-outline', color: '#3B82F6' },
    { name: 'Books', icon: 'book-outline', color: '#8B5CF6' },
    { name: 'Electronics', icon: 'tv-outline', color: '#10B981' },
    { name: 'Medical', icon: 'medical-outline', color: '#F59E0B' },
    { name: 'Toys', icon: 'extension-puzzle-outline', color: '#EC4899' },
    { name: 'Other', icon: 'grid-outline', color: '#6B7280' }
];

const DonateFormScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [quantity, setQuantity] = useState('');
    
    // Address states
    const [homeNo, setHomeNo] = useState('');       // Home/Flat/Building
    const [street, setStreet] = useState('');       // Street/Locality/Area
    const [fullAddress, setFullAddress] = useState(''); // Full address / Landmark
    const [coords, setCoords] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [locationPinned, setLocationPinned] = useState(false);
    const [autoFilled, setAutoFilled] = useState(false); // true when current/saved used

    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [imageUri, setImageUri] = useState(null);
    const [otherCategory, setOtherCategory] = useState('');
    const [errors, setErrors] = useState({});

    // Fetch user on focus
    useFocusEffect(
        useCallback(() => {
            const fetchUser = async () => {
                try {
                    const userData = await AsyncStorage.getItem('user');
                    if (userData) {
                        setUser(JSON.parse(userData));
                    } else {
                        showToast('Session expired. Please login again.', 'error');
                        navigation.replace('Login');
                    }
                } catch (e) {
                    console.error('Error fetching user:', e);
                }
            };
            fetchUser();
        }, [])
    );
    
    // Toast setup
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setToastVisible(true);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            showToast('Photo added! 📸');
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
            showToast('Photo captured! 📸');
        }
    };

    const handleCategorySelect = (cat) => {
        setCategory(cat);
        if (cat === 'Food') {
            showToast('Note: Food items expire in 12 hours for safety. ⏳', 'info');
        } else if (cat === 'Other') {
            showToast('Please specify the category below. ✍️', 'info');
        } else {
            showToast(`${cat} category selected!`);
        }
    };


    // Silent background geocoding — triggers when all 3 manual fields are non-empty
    useEffect(() => {
        if (autoFilled) return; // coords already set via GPS/saved — no need to geocode
        if (!homeNo || !street || !fullAddress) { setLocationPinned(false); return; }

        const timer = setTimeout(async () => {
            setIsGeocoding(true);
            setLocationPinned(false);
            try {
                const query = [homeNo, street, fullAddress, 'India'].filter(Boolean).join(', ');
                const results = await Location.geocodeAsync(query);
                if (results && results.length > 0) {
                    setCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
                    setLocationPinned(true);
                    if (errors.coords) setErrors(prev => ({ ...prev, coords: false }));
                }
            } catch (err) {
                console.log('Geocoding error:', err);
            } finally {
                setIsGeocoding(false);
            }
        }, 1200);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homeNo, street, fullAddress, autoFilled]);

    // handleMarkerDragEnd removed — map picker no longer shown

    const handleGetCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { showToast('Permission denied', 'error'); return; }

            setIsGeocoding(true);
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = location.coords;
            const newCoords = { latitude, longitude };
            setCoords(newCoords);
            setLocationPinned(true);

            const reverse = await Location.reverseGeocodeAsync(newCoords);
            if (reverse && reverse.length > 0) {
                const addr = reverse[0];
                // Pre-fill what we can — user can still edit if needed
                const building = addr.name || addr.streetNumber || '';
                const streetName = [addr.street, addr.district].filter(Boolean).join(', ');
                const landmark = [addr.subregion || addr.city, addr.region].filter(Boolean).join(', ');
                setHomeNo(building);
                setStreet(streetName);
                setFullAddress(landmark);
            }
            setAutoFilled(true);
            setLocationPinned(true);
            showToast('Current location set! 📍');
        } catch (error) {
            showToast('Could not fetch location', 'error');
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleUseSavedAddress = () => {
        if (!user) { showToast('Loading user profile...', 'info'); return; }
        if (user.address) {
            setHomeNo(user.address.homeNo || '');
            setStreet(user.address.street || '');
            // Build fullAddress from available fields
            const fa = user.address.fullAddress || user.address.landmark || '';
            setFullAddress(fa);
            if (user.location?.coordinates) {
                setCoords({ latitude: user.location.coordinates[1], longitude: user.location.coordinates[0] });
                setAutoFilled(true);
                setLocationPinned(true);
            }
            showToast('Profile address loaded! 🏠');
        } else {
            showToast('No saved address found. Update your profile first.', 'info');
        }
    };

    const generateAIDescription = async () => {
        if (!title || !category) {
            showToast('Enter title and select category.', 'info');
            return;
        }
        setAiLoading(true);
        showToast('AI is thinking... ✨', 'info');
        try {
            const response = await axios.post(`${API_URL}/donations/generate-description`, { 
                title, 
                category: category === 'Other' ? otherCategory : category 
            }, { timeout: 30000 });
            
            if (response.data.success) {
                setDescription(response.data.description);
                showToast('Description generated! 🪄');
            }
        } catch (error) {
            showToast('AI temporarily unavailable.', 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const handleDonateSubmit = async () => {
        const newErrors = {};
        if (!imageUri) newErrors.image = true;
        if (!title) newErrors.title = true;
        if (!category) newErrors.category = true;
        if (category === 'Other' && !otherCategory) newErrors.otherCategory = true;
        if (!quantity) newErrors.quantity = true;
        if (!homeNo) newErrors.homeNo = true;
        if (!street) newErrors.street = true;
        // fullAddress is required ONLY for manual entry; auto-fill sets coords directly
        if (!autoFilled && !fullAddress) newErrors.fullAddress = true;

        // If no coords yet, try to geocode now
        let finalCoords = coords;
        if (!finalCoords && homeNo && street) {
            try {
                const q = [homeNo, street, fullAddress, 'India'].filter(Boolean).join(', ');
                const res = await Location.geocodeAsync(q);
                if (res && res.length > 0) {
                    finalCoords = { latitude: res[0].latitude, longitude: res[0].longitude };
                    setCoords(finalCoords);
                }
            } catch (_) {}
        }
        if (!finalCoords) newErrors.coords = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showToast('Please fill all required fields.', 'error');
            return;
        }

        setErrors({});

        if (!user || !user._id) {
            showToast('User session error. Please re-login.', 'error');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('category', category === 'Other' ? otherCategory : category);
            formData.append('quantity', quantity);
            formData.append('homeNo', homeNo);
            formData.append('street', street);
            // Send the raw fullAddress value to the backend, let backend concatenate it cleanly
            formData.append('fullAddress', fullAddress || '');
            formData.append('latitude', finalCoords.latitude.toString());
            formData.append('longitude', finalCoords.longitude.toString());
            formData.append('donorId', user._id);
            
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image`;
            formData.append('image', { uri: imageUri, name: filename, type });

            const response = await axios.post(`${API_URL}/donations`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data.success) {
                showToast('Donation Posted! 🎁');
                setTimeout(() => {
                    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                }, 1500);
            } else {
                showToast('Submission failed.', 'error');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            const msg = error.response?.data?.message || error.message || 'Connection error.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
            
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                                <Ionicons name="chevron-back" size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Donate Item</Text>
                            <View style={{ width: 44 }} />
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
                            keyboardShouldPersistTaps="handled"
                            bounces={true}
                            overScrollMode="always"
                        >
                            <View style={[styles.section, { alignItems: 'center' }, errors.image && styles.errorBorderImage]}>
                            {imageUri ? (
                                <View style={styles.imagePreviewWrapper}>
                                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => setImageUri(null)}>
                                        <Ionicons name="close" size={20} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <MaterialCommunityIcons name="image-plus" size={40} color={errors.image ? "#EF4444" : "#CBD5E1"} />
                                    <Text style={[styles.placeholderText, errors.image && { color: '#EF4444' }]}>Add a clear photo of the item *</Text>
                                    <View style={styles.imageOptions}>
                                        <TouchableOpacity style={[styles.imageOptionBtn, errors.image && { borderColor: '#EF4444' }]} onPress={pickImage}>
                                            <Ionicons name="image-outline" size={20} color={errors.image ? "#EF4444" : "#10B981"} />
                                            <Text style={[styles.imageOptionText, errors.image && { color: '#EF4444' }]}>Gallery</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.imageOptionBtn, errors.image && { borderColor: '#EF4444' }]} onPress={takePhoto}>
                                            <Ionicons name="camera-outline" size={20} color={errors.image ? "#EF4444" : "#10B981"} />
                                            <Text style={[styles.imageOptionText, errors.image && { color: '#EF4444' }]}>Camera</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>What are you offering? *</Text>
                                <TextInput 
                                    style={[styles.input, errors.title && styles.errorInput]} 
                                    placeholder="e.g. Fresh Home-made Meals" 
                                    placeholderTextColor="#94A3B8"
                                    value={title} 
                                    onChangeText={(text) => { setTitle(text); if(errors.title) setErrors({...errors, title: false}); }} 
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Select Category *</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                                    {CATEGORIES.map((cat) => (
                                        <TouchableOpacity 
                                            key={cat.name} 
                                            style={[
                                                styles.categoryCard, 
                                                category === cat.name ? { backgroundColor: cat.color + '15', borderColor: cat.color } : errors.category && { borderColor: '#EF4444' }
                                            ]}
                                            onPress={() => { handleCategorySelect(cat.name); if(errors.category) setErrors({...errors, category: false}); }}
                                        >
                                            <Ionicons name={cat.icon} size={20} color={category === cat.name ? cat.color : errors.category ? '#EF4444' : '#64748B'} />
                                            <Text style={[styles.categoryCardText, category === cat.name ? { color: cat.color } : errors.category && { color: '#EF4444' }]}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                
                                {category === 'Other' && (
                                    <View style={{ marginTop: 15 }}>
                                        <Text style={styles.subLabel}>Specify Category Name *</Text>
                                        <TextInput 
                                            style={[styles.input, { padding: 14, fontSize: 14 }, errors.otherCategory && styles.errorInput]} 
                                            placeholder="Enter category (e.g. Furniture, Musical)" 
                                            placeholderTextColor="#94A3B8"
                                            value={otherCategory} 
                                            onChangeText={(text) => { setOtherCategory(text); if(errors.otherCategory) setErrors({...errors, otherCategory: false}); }} 
                                        />
                                    </View>
                                )}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Quantity / Pieces *</Text>
                                <TextInput 
                                    style={[styles.input, errors.quantity && styles.errorInput]} 
                                    placeholder="e.g. 10 Packets" 
                                    placeholderTextColor="#94A3B8"
                                    value={quantity} 
                                    onChangeText={(text) => { setQuantity(text); if(errors.quantity) setErrors({...errors, quantity: false}); }} 
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>Brief Description</Text>
                                    <TouchableOpacity style={styles.aiBtn} onPress={generateAIDescription} disabled={aiLoading}>
                                        {aiLoading ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Feather name="zap" size={14} color="#8B5CF6" />}
                                        <Text style={styles.aiBtnText}>AI Suggest</Text>
                                    </TouchableOpacity>
                                </View>
                                <TextInput 
                                    style={[styles.input, styles.textArea]} 
                                    placeholder="Tell us more about the item's condition or any notes..." 
                                    placeholderTextColor="#94A3B8"
                                    multiline 
                                    value={description} 
                                    onChangeText={setDescription} 
                                />
                            </View>

                            <View style={[styles.addressSection, errors.coords && { borderColor: '#EF4444', borderWidth: 2 }]}>
                                    <Text style={[styles.sectionTitle, errors.coords && { color: '#EF4444' }]}>
                                        Pickup Location
                                    </Text>
                                    <Text style={styles.addressHint}>
                                        Enter address below — location is pinned automatically on the map.
                                    </Text>
                                    
                                    {/* Quick-fill row */}
                                    <View style={styles.locationSourceRow}>
                                        <TouchableOpacity style={styles.sourceCard} onPress={handleGetCurrentLocation} disabled={isGeocoding}>
                                            <View style={[styles.sourceIcon, { backgroundColor: '#F0FDF4' }]}>
                                                <MaterialCommunityIcons name="target" size={24} color="#10B981" />
                                            </View>
                                            <Text style={styles.sourceText}>Current Location</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity style={styles.sourceCard} onPress={handleUseSavedAddress}>
                                            <View style={[styles.sourceIcon, { backgroundColor: '#EFF6FF' }]}>
                                                <MaterialCommunityIcons name="home-variant" size={24} color="#3B82F6" />
                                            </View>
                                            <Text style={styles.sourceText}>Saved Address</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Field 1 — Home / Building */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Home / Flat / Building *</Text>
                                        <TextInput
                                            style={[styles.input, errors.homeNo && styles.errorInput]}
                                            placeholder="KITS Boys Hostel"
                                            placeholderTextColor="#94A3B8"
                                            value={homeNo}
                                            onChangeText={(t) => { setHomeNo(t); if (errors.homeNo) setErrors(e => ({ ...e, homeNo: false })); }}
                                        />
                                    </View>

                                    {/* Field 2 — Street / Locality */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Street / Locality / Area *</Text>
                                        <TextInput
                                            style={[styles.input, errors.street && styles.errorInput]}
                                            placeholder="KITS College of Engineering"
                                            placeholderTextColor="#94A3B8"
                                            value={street}
                                            onChangeText={(t) => { setStreet(t); if (errors.street) setErrors(e => ({ ...e, street: false })); }}
                                        />
                                    </View>

                                    {/* Field 3 — Full Address / Landmark */}
                                    <View style={styles.inputGroup}>
                                        <View style={styles.labelRow}>
                                            <Text style={styles.label}>Full Address / Landmark *</Text>
                                            {isGeocoding && <ActivityIndicator size="small" color="#10B981" />}
                                            {locationPinned && !isGeocoding && (
                                                <View style={styles.pinnedBadge}>
                                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                    <Text style={styles.pinnedText}>Location pinned</Text>
                                                </View>
                                            )}
                                        </View>
                                        <TextInput
                                            style={[styles.input, errors.fullAddress && styles.errorInput]}
                                            placeholder="Near Water Tank, Gokul Shirgaon, Kolhapur"
                                            placeholderTextColor="#94A3B8"
                                            value={fullAddress}
                                            onChangeText={(t) => {
                                                setFullAddress(t);
                                                setAutoFilled(false); // manual edit clears auto mode
                                                if (errors.fullAddress) setErrors(e => ({ ...e, fullAddress: false }));
                                            }}
                                        />

                                    </View>
                                </View>

                            <TouchableOpacity 
                                style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
                                onPress={handleDonateSubmit} 
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Confirm Donation</Text>}
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ height: 100 }} />
                    </ScrollView>

                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, backgroundColor: '#FFF' },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    scrollContent: { paddingTop: 20 },
    section: { marginBottom: 25, paddingHorizontal: 20 },
    imagePreviewWrapper: { width: '100%', height: 220, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
    imagePreview: { width: '100%', height: '100%' },
    removeImgBtn: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    imagePlaceholder: { width: '100%', height: 180, borderRadius: 25, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#F1F5F9', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', padding: 20 },
    placeholderText: { fontSize: 14, color: '#94A3B8', fontWeight: '600', marginTop: 10, marginBottom: 20 },
    imageOptions: { flexDirection: 'row' },
    imageOptionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginHorizontal: 5, borderWidth: 1, borderColor: '#10B98133' },
    imageOptionText: { fontSize: 13, fontWeight: '700', color: '#10B981', marginLeft: 6 },
    formContainer: { paddingHorizontal: 20 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 15, fontWeight: '800', color: '#334155', marginBottom: 10 },
    input: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, fontSize: 16, color: '#1E293B', fontWeight: '600', borderWidth: 1, borderColor: '#F1F5F9' },
    categoryScroll: { paddingVertical: 5 },
    categoryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    categoryCardText: { marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#64748B' },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    aiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    aiBtnText: { fontSize: 11, fontWeight: '800', color: '#8B5CF6', marginLeft: 4 },
    textArea: { height: 120, textAlignVertical: 'top' },
    liveBtnText: { fontSize: 13, fontWeight: '800', color: '#10B981', marginLeft: 4 },
    helperText: { color: '#64748B', fontSize: 11, fontStyle: 'italic', marginTop: 6, textAlign: 'right' },
    addressSection: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 25, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    saveAddrBtn: { backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#DCFCE7' },
    saveAddrBtnText: { color: '#10B981', fontSize: 12, fontWeight: '800' },
    submitBtn: { backgroundColor: '#10B981', paddingVertical: 20, borderRadius: 20, alignItems: 'center', marginTop: 10, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
    submitBtnDisabled: { backgroundColor: '#94A3B8' },
    submitBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    
    // New Location Styles
    locationSourceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    sourceCard: { flex: 0.48, backgroundColor: '#FFF', padding: 15, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
    sourceIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    sourceText: { fontSize: 12, fontWeight: '800', color: '#475569' },
    
    mapActionsContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    adjustInstructionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#DDD6FE' },
    adjustInstructionText: { color: '#7C3AED', fontSize: 12, fontWeight: '700', marginLeft: 8 },
    mapActionsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    mapActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 28, paddingHorizontal: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    adjustBtn: { backgroundColor: '#FFF', flex: 0.42, borderWidth: 1, borderColor: '#E2E8F0' },
    activeAdjustBtn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    confirmBtn: { backgroundColor: '#10B981', flex: 0.54 },
    mapActionText: { fontSize: 14, fontWeight: '800', marginLeft: 8 },

    mapWrapper: { marginTop: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
    mapToolbar: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    mapToolBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    mapToolText: { fontSize: 12, fontWeight: '700', color: '#64748B', marginLeft: 5 },
    mapContainer: { height: 200 },
    miniMap: { flex: 1 },
    mapInstruction: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
    mapInstructionText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
    fullMapHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#1E293B' },
    fullMapTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    confirmLocationBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
    confirmLocationText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    closeFullMap: { padding: 5 },
    fullMapTypeBtn: { padding: 5 },
    
    // Error Styles
    errorInput: { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FFF5F5' },
    errorBorderImage: { borderColor: '#EF4444', borderWidth: 2, padding: 5, borderRadius: 30 },
    pinnedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    pinnedText: { fontSize: 11, fontWeight: '700', color: '#10B981', marginLeft: 4 },
    addressHint: { fontSize: 12, color: '#94A3B8', marginBottom: 16, fontStyle: 'italic' },
    sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
    textAreaSmall: { minHeight: 60, textAlignVertical: 'top' },
    subLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8 },
});

export default DonateFormScreen;
