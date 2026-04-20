import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Linking, Image, Dimensions, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import LeafletMap from '../components/LeafletMap';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';

const CATEGORY_ICONS = {
  'Food': { icon: 'hamburger', color: '#F39C12' },
  'Clothes': { icon: 'child', color: '#2196F3' },
  'Books & Stationery': { icon: 'book', color: '#F39C12' },
  'Electronics': { icon: 'laptop', color: '#E74C3C' },
  'Medical Supplies': { icon: 'medkit', color: '#4CAF50' },
  'Other': { icon: 'box', color: '#4CAF50' }
};

const getCategoryIconAndColor = (category) => {
    return CATEGORY_ICONS[category] || CATEGORY_ICONS['Other'];
};

const formatPhoneNumber = (phone, isWhatsApp = false) => {
    if (!phone) return '';
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) {
        if (isWhatsApp) return `91${digits}`;
        return `+91${digits}`;
    }
    if (isWhatsApp) return digits;
    return phone.startsWith('+') ? phone.replace(/[^0-9+]/g, '') : `+${digits}`;
};

const haversineDistance = (coords1, coords2) => {
    if (!coords1 || !coords2) return '0.0';
    
    const getLat = (c) => c.latitude !== undefined ? c.latitude : (c.coordinates ? c.coordinates[1] : c[1]);
    const getLon = (c) => c.longitude !== undefined ? c.longitude : (c.coordinates ? c.coordinates[0] : c[0]);
    
    const lat1 = getLat(coords1);
    const lon1 = getLon(coords1);
    const lat2 = getLat(coords2);
    const lon2 = getLon(coords2);

    if (lat1 === undefined || lat2 === undefined) return '0.0';

    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
};

const FindNearbyDonationsScreen = ({ route, navigation }) => {
    const type = 'donations';
    const [searchQuery, setSearchQuery] = useState('');
    const [radius, setRadius] = useState(5);
    const [donations, setDonations] = useState([]);
    const [location, setLocation] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [routeDistance, setRouteDistance] = useState(null);
    const [mapType, setMapType] = useState('standard');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    const categories = ['All', 'Food', 'Clothes', 'Books', 'Furniture', 'Electronics', 'Other'];

    const fetchDonations = useCallback(async (query, r, loc, uid = userId) => {
        if (!loc) return;
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_URL}/dashboard/nearby`, {
                params: {
                    lat: loc.latitude,
                    lng: loc.longitude,
                    radius: r,
                    query: query,
                    type: type,
                    excludeUserId: uid
                }
            });
            if (data.success) {
                // Sort by time: Older donations on top
                const sortedData = [...data.data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                setDonations(sortedData);
            }
        } catch (error) {
            console.error("Failed to fetch nearby donations", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        (async () => {
            let myLoc = null;
            let currentUserId = null;

            try {
                const userData = await AsyncStorage.getItem('user');
                if (userData) {
                    const currentUser = JSON.parse(userData);
                    currentUserId = currentUser._id;
                    setUserId(currentUserId);
                    if (currentUser?.location?.coordinates && currentUser.location.coordinates.length === 2) {
                        myLoc = {
                            latitude: currentUser.location.coordinates[1],
                            longitude: currentUser.location.coordinates[0]
                        };
                    }
                }
            } catch (e) {
                console.error('AsyncStorage read error:', e);
            }

            if (!myLoc) {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    let loc = await Location.getCurrentPositionAsync({});
                    myLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                }
            }

            if (myLoc) {
                setLocation(myLoc);
                fetchDonations(searchQuery, radius, myLoc, currentUserId);
            } else {
                alert('Could not determine location. Please update your profile.');
            }
        })();
    }, []);

    useEffect(() => {
        if (!location) return;
        const delayDebounceFn = setTimeout(() => {
            fetchDonations(searchQuery, radius, location);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, location, radius]);

    useEffect(() => {
        if (selectedMarker && location && selectedMarker.location?.coordinates) {
          const getRoute = async () => {
             const start = location;
             const end = { latitude: selectedMarker.location.coordinates[1], longitude: selectedMarker.location.coordinates[0] };
             try {
                 const response = await fetch(`http://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`);
                 const data = await response.json();
                 
                 if (data.routes && data.routes.length > 0) {
                     const coords = data.routes[0].geometry.coordinates.map(c => ({
                         latitude: c[1],
                         longitude: c[0]
                     }));
                     setRouteCoords(coords);
                     setRouteDistance((data.routes[0].distance / 1000).toFixed(1) + ' KM');
                 } else {
                     setRouteCoords([start, end]);
                     setRouteDistance(haversineDistance(start, end) + ' KM');
                 }
             } catch(e) {
                 console.error("Routing error:", e);
                 setRouteCoords([start, end]);
                 setRouteDistance(haversineDistance(start, end) + ' KM');
             }
          };
          getRoute();
        } else {
          setRouteCoords([]);
          setRouteDistance(null);
        }
      }, [selectedMarker, location]);

    const handleShowDonations = () => {
        if (location) {
            fetchDonations(searchQuery, radius, location);
        }
    };

    const openWhatsApp = async (phone, productTitle) => {
        if(!phone) return;
        let p = phone.replace(/[^0-9]/g, '');
        
        const userData = await AsyncStorage.getItem('user');
        const currentUser = userData ? JSON.parse(userData) : null;
        const userName = currentUser?.fullName || 'a ShareCircle user';
        
        const message = `*ShareCircle *\n\nHello, I hope you are doing well \n\nI am *${userName}*, and I am looking for *${productTitle}*. If you happen to have one available and are willing to donate or share, it would truly mean a lot to me.\n\nThank you so much for your kindness and support ❤️`;
        const encodedMsg = encodeURIComponent(message);
        
        Linking.openURL(`https://wa.me/${p}?text=${encodedMsg}`).catch(e => alert("Could not open WhatsApp"));
    };

    const callPhone = (phone) => {
        if(!phone) return;
        Linking.openURL(`tel:${phone}`);
    };

    const renderItem = ({ item }) => {
        let dist = 'Nearby';
        if (location && item.location && item.location.coordinates) {
            dist = haversineDistance(location, { latitude: item.location.coordinates[1], longitude: item.location.coordinates[0] }) + ' km';
        }
        
        const { icon, color } = getCategoryIconAndColor(item.category);

        const person = item.donor;
        const imageUrl = item.image || item.imageUrl || 'https://via.placeholder.com/150';
        return (
            <View style={styles.donationCard}>
                <TouchableOpacity 
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => navigation.navigate('DonationDetail', { item, userLocation: location })}
                >
                    <Image source={{ uri: imageUrl }} style={{ width: 60, height: 60, borderRadius: 10, marginRight: 12, backgroundColor: '#E2E8F0' }} />
                    <View style={styles.cardContent}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.donorInfo} numberOfLines={1}>{person?.fullName || 'Unknown User'} • {dist}</Text>
                        {person?.mobileNumber && (
                            <Text style={styles.phoneText}>
                                <MaterialCommunityIcons name="phone" size={12} color="#64748B" /> {person.mobileNumber}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                    <TouchableOpacity 
                        style={styles.actionBtn} 
                        onPress={() => {
                            const num = formatPhoneNumber(person?.mobileNumber, false);
                            callPhone(num);
                        }}
                    >
                        <MaterialCommunityIcons name="phone" size={18} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.actionBtnWhatsApp} 
                        onPress={() => {
                            const num = formatPhoneNumber(person?.mobileNumber, true);
                            openWhatsApp(num, item.title);
                        }}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={18} color="#10B981" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Find Nearby Donations</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder={`Search ${type}...`}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <Ionicons name="mic" size={20} color="#94A3B8" />
                </View>

                <View style={styles.radiusContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.radiusText}>Radius</Text>
                        <Text style={styles.radiusValueText}>{radius} km</Text>
                    </View>
                    <Slider
                        style={{width: '100%', height: 30}}
                        minimumValue={1}
                        maximumValue={50}
                        step={1}
                        value={radius}
                        onValueChange={setRadius}
                        minimumTrackTintColor="#10B981"
                        maximumTrackTintColor="#E2E8F0"
                        thumbTintColor="#10B981"
                    />
                </View>
                
                <TouchableOpacity style={styles.showbtn} onPress={handleShowDonations}>
                    <Text style={styles.showbtnText}>Show Donations</Text>
                </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <View style={{ backgroundColor: '#FFF', paddingBottom: 10 }}>
                <FlatList 
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={categories}
                    keyExtractor={(item) => item}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 5 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[
                                styles.categoryBadge, 
                                selectedCategory === item && styles.categoryBadgeActive
                            ]}
                            onPress={() => setSelectedCategory(item)}
                        >
                            <Text style={[
                                styles.categoryBadgeText, 
                                selectedCategory === item && styles.categoryBadgeTextActive
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>
            <View style={isFullScreen ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#FAFAFA' } : styles.mapContainer}>
                {location ? (
                    <>
                        <LeafletMap
                            style={styles.map}
                            latitude={location.latitude}
                            longitude={location.longitude}
                            zoom={Math.round(14 - Math.log2(radius))}
                            markers={(selectedCategory === 'All' ? donations : donations.filter(d => d.category === selectedCategory))}
                            radiusKm={radius}
                            satellite={mapType === 'satellite'}
                            onMarkerPress={(id) => {
                              const found = donations.find(it => String(it._id) === String(id));
                              if (found) setSelectedMarker(found);
                            }}
                        />

                        <View style={mStyles.mapControls}>
                            <TouchableOpacity 
                                style={mStyles.controlBtn} 
                                onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
                            >
                                <MaterialCommunityIcons name={mapType === 'standard' ? "layers-outline" : "map-outline"} size={22} color="#1E293B" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={mStyles.controlBtn} 
                                onPress={() => setIsFullScreen(!isFullScreen)}
                            >
                                <Ionicons name={isFullScreen ? "contract" : "expand"} size={22} color="#1E293B" />
                            </TouchableOpacity>
                        </View>

                        {isFullScreen && (
                            <TouchableOpacity 
                                style={mStyles.backBtn}
                                onPress={() => setIsFullScreen(false)}
                            >
                                <Ionicons name="arrow-back" size={24} color="#1E293B" />
                            </TouchableOpacity>
                        )}

                        {selectedMarker && (
                            <View style={styles.selectedOverlay}>
                                <TouchableOpacity style={styles.closeOverlay} onPress={() => setSelectedMarker(null)}>
                                    <Ionicons name="close-circle" size={28} color="#E74C3C" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={styles.overlayInner}
                                    onPress={() => navigation.navigate('DonationDetail', { item: selectedMarker, userLocation: location })}
                                >
                                    <Image source={{ uri: selectedMarker.image || selectedMarker.imageUrl || 'https://via.placeholder.com/150' }} style={styles.overlayImage} />
                                    
                                    <View style={styles.overlayInfo}>
                                        <Text style={styles.overlayUser} numberOfLines={1}>
                                            {selectedMarker.donor?.fullName || 'Anonymous'}
                                        </Text>
                                        <Text style={styles.overlayTitle} numberOfLines={1}>{selectedMarker.title}</Text>
                                        <Text style={styles.overlayDist}>
                                            Distance: {routeDistance || haversineDistance(location, selectedMarker.location) + ' km'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                
                                <View style={styles.overlayActions}>
                                    <TouchableOpacity 
                                        style={styles.overlayActionBtn}
                                        onPress={() => {
                                            if (selectedMarker.location && selectedMarker.location.coordinates) {
                                                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.location.coordinates[1]},${selectedMarker.location.coordinates[0]}`);
                                            }
                                        }}
                                    >
                                        <Ionicons name="navigate" color="#FFF" size={16} />
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={[styles.overlayActionBtn, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }]}
                                        onPress={() => {
                                            const p = selectedMarker.donor?.mobileNumber || '';
                                            const num = formatPhoneNumber(p, false);
                                            callPhone(num);
                                        }}
                                    >
                                        <Ionicons name="call" color="#2F7B5E" size={16} />
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={[styles.overlayActionBtn, { backgroundColor: '#30D158' }]}
                                        onPress={() => {
                                            const p = selectedMarker.donor?.mobileNumber || '';
                                            const num = formatPhoneNumber(p, true);
                                            openWhatsApp(num, selectedMarker.title);
                                        }}
                                    >
                                        <MaterialCommunityIcons name="whatsapp" color="#FFF" size={18} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.loadingMap}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={{marginTop: 10}}>Finding your location...</Text>
                    </View>
                )}
            </View>

            <View style={{ flex: 1 }}>
                <FlatList 
                    data={selectedCategory === 'All' ? donations : donations.filter(d => d.category === selectedCategory)}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing}
                            onRefresh={() => fetchDonations(searchQuery, radius, location)}
                            colors={['#10B981']}
                        />
                    }
                    ListEmptyComponent={
                        loading && location ? <ActivityIndicator color="#10B981" style={{marginTop: 20}} /> : 
                        <Text style={styles.emptyText}>{searchQuery ? `${type} not found` : `no ${type} found`}</Text>
                    }
                />
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.requestBtn} onPress={() => navigation.navigate('DonateForm')}>
                    <Text style={styles.requestBtnText}>Donate Items</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    categoryBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    categoryBadgeActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
    categoryBadgeText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    categoryBadgeTextActive: { color: '#FFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
    searchSection: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 12, height: 40, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#334155' },
    radiusContainer: { marginBottom: 10 },
    radiusText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    radiusValueText: { fontSize: 13, fontWeight: '700', color: '#10B981' },
    showbtn: { backgroundColor: '#10B981', borderRadius: 20, height: 38, justifyContent: 'center', alignItems: 'center' },
    showbtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    mapContainer: { height: 260, backgroundColor: '#E2E8F0', overflow: 'hidden' },
    map: { width: '100%', height: '100%' },
    loadingMap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    userDotOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(52, 152, 219, 0.3)', justifyContent: 'center', alignItems: 'center' },
    userDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3498DB', borderWidth: 2, borderColor: '#FFF' },
    markerCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
    distanceBadge: { backgroundColor: '#1E293B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4},
    distanceBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    selectedOverlay: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: '#FFF', borderRadius: 20, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, flexDirection: 'row', alignItems: 'center' },
    closeOverlay: { position: 'absolute', top: -8, right: -8, zIndex: 20, backgroundColor: '#FFF', borderRadius: 14 },
    overlayInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    overlayImage: { width: 70, height: 70, borderRadius: 12, marginRight: 12, backgroundColor: '#E2E8F0' },
    overlayInfo: { flex: 1 },
    overlayUser: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
    overlayTitle: { fontSize: 13, color: '#334155', fontWeight: '600', marginBottom: 2 },
    overlayDist: { fontSize: 11, color: '#64748B' },
    overlayActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    overlayActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4B8BF5', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
    listContent: { padding: 15, paddingBottom: 100 },
    donationCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardContent: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
    donorInfo: { fontSize: 12, color: '#64748B', marginBottom: 4 },
    phoneText: { fontSize: 11, color: '#94A3B8', backgroundColor: '#F8FAFC', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    actions: { flexDirection: 'row', marginLeft: 8 },
    actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    actionBtnWhatsApp: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 15, color: '#94A3B8' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    requestBtn: { backgroundColor: '#10B981', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    requestBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

const mStyles = StyleSheet.create({
    userMarkerContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    userMarkerPulse: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(52, 152, 219, 0.3)', transform: [{ scale: 1.2 }] },
    userMarkerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3498DB', borderWidth: 2, borderColor: '#FFF', shadowColor: '#3498DB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 5 },
    donationMarker: { alignItems: 'center' },
    donationMarkerContent: { backgroundColor: '#F39C12', padding: 8, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8, borderWidth: 2, borderColor: '#FFF' },
    markerArrow: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFF', transform: [{ rotate: '180deg' }], marginTop: -2 },
    mapControls: { position: 'absolute', right: 15, top: 15, zIndex: 10 },
    controlBtn: { backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    backBtn: { position: 'absolute', left: 15, top: 40, zIndex: 10, backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
});

export default FindNearbyDonationsScreen;
