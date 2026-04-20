import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, StyleSheet, Modal, TextInput, ActivityIndicator, Alert, Image, Dimensions, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, API_URL } from '../utils/constants';
import { updateUserLocation, updateProfilePicture, loginUser } from '../services/api'; // Assuming we might need to refresh user data
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import CustomToast from '../components/CustomToast';
import FreeMap from '../components/FreeMap';


const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation, route }) => {
    const defaultUser = route.params?.user || null;
    const [user, setUser] = useState(defaultUser);
    const [showEditModal, setShowEditModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [fullPicVisible, setFullPicVisible] = useState(false);
    
    // Form States
    const [fullName, setFullName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [street, setStreet] = useState('');
    const [landmark, setLandmark] = useState('');
    const [pincode, setPincode] = useState('');
    const [coords, setCoords] = useState(null);
    const [showMap, setShowMap] = useState(false);
    const [mapType, setMapType] = useState('standard');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isAdjustMode, setIsAdjustMode] = useState(false);
    
    const mapRef = useRef(null);
    const fullMapRef = useRef(null);

    // Toast setup
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setToastVisible(true);
    };

    
    useEffect(() => {
        const loadUser = async () => {
            let currentUser = defaultUser;
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
                try {
                    currentUser = JSON.parse(storedUser);
                    setUser(currentUser);
                    
                    // Pre-fill form
                    setFullName(currentUser.fullName || '');
                    setMobileNumber(currentUser.mobileNumber || '');
                    if (currentUser.address) {
                        setStreet(currentUser.address.street || '');
                        setLandmark(currentUser.address.fullAddress || '');
                        const extractedZip = currentUser.address.fullAddress?.match(/\b\d{6}\b/)?.[0] || '';
                        setPincode(extractedZip);
                        if (currentUser.location?.coordinates) {
                            const newCoords = {
                                latitude: currentUser.location.coordinates[1],
                                longitude: currentUser.location.coordinates[0]
                            };
                            setCoords(newCoords);
                        }
                    }
                } catch (e) {
                    console.error("Profile parsing error", e);
                    await AsyncStorage.clear();
                    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                }
            }
        };
        loadUser();
    }, []);

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
        if (!result.canceled) handleUploadImage(result.assets[0].uri);
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required.');
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) handleUploadImage(result.assets[0].uri);
    };

    const handleUploadImage = async (uri) => {
        setUploadLoading(true);
        try {
            const res = await updateProfilePicture(user._id, uri);
            if (res && res.success && res.user) {
                await AsyncStorage.setItem('user', JSON.stringify(res.user));
                setUser({ ...res.user });
                showToast('Profile picture updated! 🌿');
            }
        } catch (error) {
            showToast('Failed to upload image.', 'error');
        } finally {

            setUploadLoading(false);
        }
    };

    const handleGetLiveLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('Permission denied', 'error');
                return;
            }
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            setCoords({ latitude, longitude });
            
            const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverse && reverse.length > 0) {
                const addr = reverse[0];
                setStreet(addr.street || addr.district || '');
                setLandmark(`${addr.name || ''} ${addr.subregion || ''}`.trim());
                if (addr.postalCode) setPincode(addr.postalCode);
                showToast('Live location fetched! 📍');
            }
            setIsFullScreen(true);
        } catch (error) {
            showToast('Could not fetch location', 'error');
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;
            
            if (!landmark || !street || pincode.length !== 6) return;
            
            setIsGeocoding(true);
            try {
                const query = `${landmark}, ${street}, ${pincode}, India`;
                const results = await Location.geocodeAsync(query);
                if (results && results.length > 0) {
                    const { latitude, longitude } = results[0];
                    const newCoords = { latitude, longitude };
                    setCoords(newCoords);
                    setShowMap(false);
                    setIsFullScreen(true);
                    setIsAdjustMode(false);
                }
            } catch (error) {
                console.error("Geocoding error:", error);
            } finally {
                setIsGeocoding(false);
            }
        }, 1500);

        return () => clearTimeout(delayDebounceFn);
    }, [landmark, street, pincode, showEditModal]);

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

    async function handleAddressFocus() {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
        } catch (err) {
            console.warn("Permission request error", err);
        }
    }

    const confirmMapLocation = () => {
        setIsFullScreen(false);
        showToast('Address point confirmed! 📍');
    };

    const handleSaveChanges = async () => {
        if (!fullName || !mobileNumber) {
            Alert.alert('Required Fields', 'Full Name and Phone Number are required.');
            return;
        }
        setLoading(true);
        try {
            let lat = coords?.latitude || user.location?.coordinates?.[1] || 0;
            let lon = coords?.longitude || user.location?.coordinates?.[0] || 0;

            if (!coords && landmark && landmark !== user.address?.fullAddress) {
                try {
                    const geo = await Location.geocodeAsync(landmark);
                    if (geo.length > 0) {
                        lat = geo[0].latitude;
                        lon = geo[0].longitude;
                    }
                } catch (e) {
                    console.warn("Geocoding failed", e);
                }
            }
            
            const response = await axios.put(`${API_URL}/auth/update-profile`, {
                userId: user._id,
                fullName,
                mobileNumber,
                street,
                landmark,
                latitude: lat,
                longitude: lon
            });

            if (response.data.success) {
                await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
                setUser(response.data.user);
                showToast('Profile updated successfully! ✅');
                setShowEditModal(false);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update profile.', 'error');
        } finally {

            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to exit?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: async () => {
                await AsyncStorage.clear();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            }}
        ]);
    };

    const renderInfoCard = (label, value, icon, color) => (
        <View style={styles.infoCard}>
            <View style={[styles.infoIconContainer, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value || 'Not Set'}</Text>
            </View>
        </View>
    );

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={{ marginTop: 10, color: '#64748B' }}>Loading Profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />


            {/* Custom Top Bar matching screenshot */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.openDrawer?.() || navigation.goBack()}>
                    <Feather name="menu" size={26} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.title}>Profile</Text>
                <View style={styles.topBarRight}>
                    <TouchableOpacity style={styles.notifBtn}>
                        <Ionicons name="notifications-outline" size={26} color="#1E293B" />
                    </TouchableOpacity>
                    <View style={styles.miniAvatar}>
                        <Text style={styles.miniAvatarText}>
                            {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                        </Text>
                    </View>
                </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modern Header */}
                <View style={styles.header}>
                    <View style={styles.profileCircleContainer}>
                        <TouchableOpacity 
                            onPress={() => user.profilePic && setFullPicVisible(true)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.avatarWrapper}>
                                {user.profilePic ? (
                                    <Image source={{ uri: user.profilePic }} style={styles.avatarImg} />
                                ) : (
                                    <View style={styles.initialsCircle}>
                                        <Text style={styles.initialsText}>
                                            {user.fullName ? user.fullName.split(' ').map(n=>n[0]).join('').toUpperCase() : 'U'}
                                        </Text>
                                    </View>
                                )}
                                <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage}>
                                    <Ionicons name="camera" size={18} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                        
                        <Text style={styles.userName}>{user.fullName}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>{user.role?.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Main Content */}
                <View style={styles.content}>
                    <Text style={styles.sectionTitle}>Account Information</Text>
                    
                    {renderInfoCard('Phone Number', user.mobileNumber, 'call-outline', '#10B981')}
                    {renderInfoCard('Email Address', user.email, 'mail-outline', '#3B82F6')}
                    {renderInfoCard('Location', user.address?.fullAddress || 'Not set', 'location-outline', '#EF4444')}

                    <TouchableOpacity 
                        style={styles.editBtn}
                        onPress={() => setShowEditModal(true)}
                    >
                        <Feather name="edit-3" size={20} color="#FFF" />
                        <Text style={styles.editBtnText}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.logoutBtn}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                        <Text style={styles.logoutBtnText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
                
                <View style={{height: 100}} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Edit Profile</Text>
                                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                    <Ionicons name="close-circle" size={32} color="#CBD5E1" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 30}} keyboardShouldPersistTaps="handled">
                                {/* Full Name */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        placeholder="Enter your full name"
                                    />
                                </View>

                                {/* Phone Number */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Phone Number</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={mobileNumber}
                                        onChangeText={setMobileNumber}
                                        placeholder="Enter phone number"
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                {/* Location Source Card */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Update Current Location</Text>
                                    <TouchableOpacity style={styles.liveSourceCard} onPress={handleGetLiveLocation}>
                                        <View style={styles.liveIconContainer}>
                                            <MaterialCommunityIcons name="target" size={26} color="#10B981" />
                                        </View>
                                        <View style={styles.liveTextContainer}>
                                            <Text style={styles.liveMainText}>Get My Precise Location</Text>
                                            <Text style={styles.liveSubText}>Uses GPS for accuracy</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>

                                {/* Street */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Street / Locality / Area *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={street}
                                        onChangeText={setStreet}
                                        placeholder="e.g. MG Road, Locality Name"
                                    />
                                </View>

                                {/* House No */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>House No / Building / Floor *</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={landmark}
                                        onChangeText={setLandmark}
                                        placeholder="e.g. Flat 402, Shivam Apts"
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                {/* Pincode */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.inputLabel}>Pincode / Zip Code *</Text>
                                        {isGeocoding && <ActivityIndicator size="small" color="#10B981" />}
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={pincode}
                                        onChangeText={setPincode}
                                        placeholder="6-digit pincode"
                                        keyboardType="numeric"
                                        maxLength={6}
                                    />
                                    <Text style={styles.helperText}>Map will open automatically after filling all 3 fields 🗺️</Text>
                                </View>

                                {loading ? (
                                    <ActivityIndicator size="large" color="#10B981" style={{marginTop: 20}} />
                                ) : (
                                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges}>
                                        <Text style={styles.saveBtnText}>Save Changes</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </TouchableWithoutFeedback>

                {/* Fullscreen Map Modal */}
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
                        <FreeMap
                            style={styles.fullMap}
                            region={coords ? { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 } : null}
                            onRegionChangeComplete={(newReg) => {
                                if (isAdjustMode) {
                                    setCoords({ latitude: newReg.latitude, longitude: newReg.longitude });
                                }
                            }}
                            selectedLocation={coords}
                        />
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
            </Modal>

            {/* Image Full View */}
            <Modal visible={fullPicVisible} transparent={true}>
                <View style={styles.fullImageOverlay}>
                    <TouchableOpacity style={styles.closeFullImage} onPress={() => setFullPicVisible(false)}>
                        <Ionicons name="close" size={32} color="#FFF" />
                    </TouchableOpacity>
                    <Image source={{ uri: user.profilePic }} style={styles.fullImage} resizeMode="contain" />
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFF',
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        marginLeft: -40, // To center title when left icon is present
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    notifBtn: {
        marginRight: 15,
    },
    miniAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniAvatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748B',
    },
    header: {
        backgroundColor: '#FFF',
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 5,
    },
    profileCircleContainer: {
        alignItems: 'center',
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    initialsCircle: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialsText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFF',
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10B981',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    userName: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 15,
    },
    roleBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 6,
    },
    roleText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
    },
    content: {
        padding: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 20,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    infoIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
    },
    editBtn: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 20,
        marginTop: 20,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    editBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginLeft: 10,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 15,
    },
    logoutBtnText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 25,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
    },
    inputGroup: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '500',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    getLiveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    getLiveText: {
        color: '#10B981',
        fontSize: 13,
        fontWeight: '800',
        marginLeft: 4,
    },
    saveBtn: {
        backgroundColor: '#10B981',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 10,
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
    fullImageOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeFullImage: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
    
    // New Profile Location Styles
    liveSourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#F0FDF4', elevation: 3, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
    liveIconContainer: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
    liveTextContainer: { flex: 1, marginLeft: 15 },
    liveMainText: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
    liveSubText: { fontSize: 12, color: '#64748B', marginTop: 2 },

    mapActionsContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    adjustInstructionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#DDD6FE' },
    adjustInstructionText: { color: '#7C3AED', fontSize: 12, fontWeight: '700', marginLeft: 8 },
    mapActionsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    mapActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 28, paddingHorizontal: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    adjustBtn: { backgroundColor: '#FFF', flex: 0.42, borderWidth: 1, borderColor: '#E2E8F0' },
    activeAdjustBtn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    confirmBtn: { backgroundColor: '#10B981', flex: 0.54 },
    mapActionText: { fontSize: 14, fontWeight: '800', marginLeft: 8 },

    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapWrapper: { marginTop: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
    mapToolbar: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    mapToolBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    mapToolText: { fontSize: 12, fontWeight: '700', color: '#64748B', marginLeft: 5 },
    mapContainer: { height: 180 },
    miniMap: { flex: 1 },
    fullMapHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#1E293B' },
    fullMapTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    confirmLocationBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
    confirmLocationText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    closeFullMap: { padding: 5 },
    fullMapTypeBtn: { padding: 5 },
    helperText: { color: '#64748B', fontSize: 11, fontStyle: 'italic', marginTop: 6, textAlign: 'right', marginBottom: 10 },
});

export default ProfileScreen;
