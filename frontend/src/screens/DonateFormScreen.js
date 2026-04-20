import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image, Dimensions, StatusBar, TouchableWithoutFeedback, Keyboard, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, UrlTile } from 'react-native-maps';
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
    const [street, setStreet] = useState('');
    const [landmark, setLandmark] = useState('');
    const [pincode, setPincode] = useState('');
    const [coords, setCoords] = useState(null);
    const [showMap, setShowMap] = useState(false);
    const [mapType, setMapType] = useState('standard');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isAdjustMode, setIsAdjustMode] = useState(false); // New state for adjust mode instructions
    
    const mapRef = useRef(null);
    const fullMapRef = useRef(null);

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


    // Debounced geocoding for donation - Trigger when ALL THREE are ready
    useEffect(() => {
        if (!landmark || !street || pincode.length !== 6) return;
        
        const delayDebounceFn = setTimeout(async () => {
            setIsGeocoding(true);
            try {
                const query = `${landmark}, ${street}, ${pincode}, India`;
                const results = await Location.geocodeAsync(query);
                if (results && results.length > 0) {
                    const { latitude, longitude } = results[0];
                    const newCoords = { latitude, longitude };
                    setCoords(newCoords);
                    setIsFullScreen(true);
                    setIsAdjustMode(false); 
                    
                    setTimeout(() => {
                        fullMapRef.current?.animateToRegion({
                            ...newCoords,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        }, 1000);
                    }, 500);
                }
            } catch (error) {
                console.error("Geocoding error:", error);
            } finally {
                setIsGeocoding(false);
            }
        }, 1500);

        return () => clearTimeout(delayDebounceFn);
    }, [landmark, street, pincode]);

    const handleMarkerDragEnd = async (e) => {
        const newCoords = e.nativeEvent.coordinate;
        setCoords(newCoords);
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync(newCoords);
            if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const detailedAddr = [addr.name, addr.street, addr.district, addr.city].filter(Boolean).join(', ');
                if (detailedAddr) {
                    setStreet(addr.street || addr.district || '');
                    setLandmark(detailedAddr);
                }
                if (addr.postalCode) setPincode(addr.postalCode);
                showToast('Location updated! 📍');
            }
        } catch (error) {
            console.error("Reverse geocoding error:", error);
        }
    };

    const handleGetCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('Permission denied', 'error');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            const newCoords = { latitude, longitude };
            setCoords(newCoords);

            const reverse = await Location.reverseGeocodeAsync(newCoords);
            if (reverse && reverse.length > 0) {
                const addr = reverse[0];
                setStreet(addr.street || addr.district || '');
                setLandmark(`${addr.name || ''} ${addr.subregion || ''}`.trim());
                if (addr.postalCode) setPincode(addr.postalCode);
            }
            setIsFullScreen(true);
        } catch (error) {
            showToast('Could not fetch location', 'error');
        }
    };

    const handleUseSavedAddress = () => {
        if (!user) {
            showToast('Loading user profile...', 'info');
            return;
        }
        if (user.address) {
            setStreet(user.address.street || '');
            setLandmark(user.address.fullAddress || '');
            const extractedZip = user.address.fullAddress?.match(/\b\d{6}\b/)?.[0] || '';
            if (extractedZip) setPincode(extractedZip);
            
            if (user.location?.coordinates) {
                setCoords({
                    latitude: user.location.coordinates[1],
                    longitude: user.location.coordinates[0]
                });
                setIsFullScreen(true);
            }
            showToast('Profile address loaded! 🏠');
        } else {
            showToast('No saved address found', 'info');
        }
    };

    const confirmMapLocation = () => {
        setIsFullScreen(false);
        showToast('Location confirmed successfully! 📍');
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
        if (!street) newErrors.street = true;
        if (!landmark) newErrors.landmark = true;
        if (!pincode || pincode.length !== 6) newErrors.pincode = true;
        if (!coords) newErrors.coords = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showToast('Please fill all required fields highlighted in red.', 'error');
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
            formData.append('homeNo', landmark);
            formData.append('street', street);
            formData.append('fullAddress', `${landmark}, ${street}, ${pincode}`);
            formData.append('latitude', coords.latitude.toString());
            formData.append('longitude', coords.longitude.toString());
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
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                                    <Text style={[styles.sectionTitle, errors.coords && { color: '#EF4444' }]}>Pickup Location {errors.coords && '(Please Confirm Point on Map)'}</Text>
                                    
                                    <View style={styles.locationSourceRow}>
                                        <TouchableOpacity style={styles.sourceCard} onPress={handleGetCurrentLocation}>
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
    
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Street / Locality / Area *</Text>
                                        <TextInput 
                                            style={[styles.input, errors.street && styles.errorInput]} 
                                            placeholder="e.g. MG Road, Hiranandani"
                                            placeholderTextColor="#94A3B8"
                                            value={street} 
                                            onChangeText={(text) => { setStreet(text); if(errors.street) setErrors({...errors, street: false}); }}
                                        />
                                    </View>
    
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>House No / Building / Floor *</Text>
                                        <TextInput 
                                            style={[styles.input, styles.textAreaSmall, errors.landmark && styles.errorInput]} 
                                            placeholder="e.g. Flat 402, Shivam Apts"
                                            placeholderTextColor="#94A3B8"
                                            multiline
                                            value={landmark} 
                                            onChangeText={(text) => { setLandmark(text); if(errors.landmark) setErrors({...errors, landmark: false}); }}
                                        />
                                    </View>
    
                                    <View style={styles.inputGroup}>
                                        <View style={styles.labelRow}>
                                            <Text style={styles.label}>Pincode / Zip Code *</Text>
                                            {isGeocoding && <ActivityIndicator size="small" color="#10B981" />}
                                        </View>
                                        <TextInput 
                                            style={[styles.input, (errors.pincode) && styles.errorInput]} 
                                            placeholder="Enter 6-digit pincode"
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="numeric"
                                            maxLength={6}
                                            value={pincode} 
                                            onChangeText={(text) => { setPincode(text); if(errors.pincode) setErrors({...errors, pincode: false}); }}
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

                    <Modal visible={isFullScreen} animationType="fade">
                        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                            <View style={styles.fullMapHeader}>
                                <TouchableOpacity style={styles.closeFullMap} onPress={() => setIsFullScreen(false)}>
                                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.fullMapTitle}>Adjust Location</Text>
                                <TouchableOpacity 
                                    style={styles.fullMapTypeBtn}
                                    onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
                                >
                                    <Ionicons name="layers" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                            <MapView
                                ref={fullMapRef}
                                style={{ flex: 1 }}
                                initialRegion={coords ? { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 } : null}
                                mapType="none"
                            >
                                <UrlTile
                                    urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                                    maximumZ={19}
                                    flipY={false}
                                />
                                {coords && (
                                    <Marker
                                        coordinate={coords}
                                        draggable
                                        onDragEnd={handleMarkerDragEnd}
                                    />
                                )}
                            </MapView>
                            <View style={styles.mapActionsContainer}>
                                {isAdjustMode && (
                                    <View style={styles.adjustInstructionCard}>
                                        <Ionicons name="hand-right" size={20} color="#8B5CF6" />
                                        <Text style={styles.adjustInstructionText}>Drag the pin to fix the exact address point 📍</Text>
                                    </View>
                                )}
                                
                                <View style={styles.mapActionsRow}>
                                    <TouchableOpacity 
                                        style={[styles.mapActionBtn, styles.adjustBtn, isAdjustMode && styles.activeAdjustBtn]} 
                                        onPress={() => setIsAdjustMode(!isAdjustMode)}
                                    >
                                        <Ionicons name={isAdjustMode ? "checkmark" : "move"} size={22} color={isAdjustMode ? "#FFF" : "#64748B"} />
                                        <Text style={[styles.mapActionText, isAdjustMode && { color: '#FFF' }]}>{isAdjustMode ? 'Set Point' : 'Adjust Map'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.mapActionBtn, styles.confirmBtn]} onPress={confirmMapLocation}>
                                        <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                                        <Text style={[styles.mapActionText, { color: '#FFF' }]}>Confirm Address</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </SafeAreaView>
                    </Modal>
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
    sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
    textAreaSmall: { minHeight: 60, textAlignVertical: 'top' },
    subLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8 },
});

export default DonateFormScreen;
