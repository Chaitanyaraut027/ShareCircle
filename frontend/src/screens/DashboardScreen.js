import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import LeafletMap from '../components/LeafletMap';
import Slider from '@react-native-community/slider';
import { getNearbyItems, getUserHistory, getNotificationCount } from '../services/api';
import { COLORS, API_URL } from '../utils/constants';
import { registerForPushNotificationsAsync, savePushToken, initNotifications } from '../services/notificationService';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
  TextInput,
  Alert,
  RefreshControl
} from 'react-native';
import CustomToast from '../components/CustomToast';

import { 
  MaterialCommunityIcons, 
  Feather, 
  Ionicons 
} from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const getMidPoint = (loc1, loc2) => {
    return {
        latitude: (loc1.latitude + loc2.latitude) / 2,
        longitude: (loc1.longitude + loc2.longitude) / 2
    };
};

const calculateDistance = (loc1, targetLoc) => {
    if (!loc1 || !targetLoc || !targetLoc.coordinates) return 'N/A';
    const [tLon, tLat] = targetLoc.coordinates;
    const { latitude: lat1, longitude: lon1 } = loc1;
    const R = 6371; // km
    const dLat = (tLat - lat1) * Math.PI / 180;
    const dLon = (tLon - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1) + ' KM';
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

const DashboardScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [nearbyItems, setNearbyItems] = useState([]);
  const [radiusInput, setRadiusInput] = useState('50');
  const [activeRadius, setActiveRadius] = useState(50);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);
  const [historyStats, setHistoryStats] = useState({ donations: 0, points: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mapType, setMapType] = useState('standard');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Food', 'Clothes', 'Books & Stationery', 'Electronics', 'Medical Supplies', 'Other'];

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
    if (selectedMarker && location && selectedMarker.location?.coordinates) {
      const getRoute = async () => {
         const start = location;
         const end = { latitude: selectedMarker.location.coordinates[1], longitude: selectedMarker.location.coordinates[0] };
         try {
             const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`);
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
                 setRouteDistance(calculateDistance(start, selectedMarker.location));
             }
         } catch(e) {
             console.error("Routing error:", e);
             setRouteCoords([start, end]);
             setRouteDistance(calculateDistance(start, selectedMarker.location));
         }
      };
      getRoute();
    } else {
      setRouteCoords([]);
      setRouteDistance(null);
    }
  }, [selectedMarker, location]);

  useEffect(() => {
     let r = parseInt(radiusInput);
     if (isNaN(r) || r < 1) r = 1;
     const timeout = setTimeout(() => {
        setActiveRadius(r);
     }, 800);
     return () => clearTimeout(timeout);
  }, [radiusInput]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const userData = await AsyncStorage.getItem('user');
          let currentUser = null;
          
          if (userData) {
            try {
                currentUser = JSON.parse(userData);
                setUser(currentUser);
            } catch (e) {
                console.error("User parsing error", e);
                await AsyncStorage.clear();
                navigation.replace('Welcome');
                return;
            }
            try {
               const hRes = await getUserHistory(currentUser._id);
               if (hRes && hRes.success && hRes.data?.donated) {
                   const count = hRes.data.donated.length;
                   setHistoryStats({ donations: count, points: count * 25 });
               } else {
                   setHistoryStats({ donations: currentUser.donationCount || 0, points: (currentUser.donationCount || 0) * 25 });
               }
            } catch(e) {
               setHistoryStats({ donations: currentUser.donationCount || 0, points: (currentUser.donationCount || 0) * 25 });
            }
          }

          let activeLocation = location;

          if (currentUser?.location?.coordinates && currentUser.location.coordinates.length === 2) {
            activeLocation = {
              latitude: currentUser.location.coordinates[1],
              longitude: currentUser.location.coordinates[0],
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            };
            setLocation(activeLocation);
          } else if (!activeLocation) {
            // Fallback to GPS
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              let loc = await Location.getCurrentPositionAsync({});
              activeLocation = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              };
              setLocation(activeLocation);
            }
          }

          // Fetch Nearby
          if (activeLocation) {
              const res = await getNearbyItems(activeLocation.longitude, activeLocation.latitude, 'donations', activeRadius, currentUser?._id);
              if (res && res.success) {
                  // Sort by time: Older donations on top
                  const sortedData = [...res.data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                  setNearbyItems(sortedData);
              }
          }

          // Fetch Notification Count
          if (currentUser?._id) {
              const nData = await getNotificationCount(currentUser._id);
              if (nData && nData.success) {
                  setUnreadCount(nData.count);
              }
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };

      fetchData();
    }, [activeRadius]) // removed location dependency so it evaluates freshly every focus
  );

  useEffect(() => {
    const setupNotifications = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return;
      const currentUser = JSON.parse(userStr);
      
      const token = await registerForPushNotificationsAsync();
      if (token && currentUser?._id) {
        await savePushToken(currentUser._id, token);
      }
    };

    setupNotifications();
    const cleanup = initNotifications(navigation);
    return cleanup;
  }, []);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getSubGreeting = () => {
    if (!user) return "Change lives by donating 🌿";
    const donations = historyStats.donations || 0;
    if (donations > 0) return `You have changed ${donations * 5} lives this month 🌿`;
    return "Change lives by donating 🌿";
  };

  return (
    <View style={styles.container}>
      <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
      <View style={{height: Platform.OS === 'ios' ? 50 : 30}} />

      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity 
            style={styles.sidebarBackdrop} 
            activeOpacity={1} 
            onPress={() => setIsSidebarOpen(false)} 
          />
          <View style={styles.sidebarContent}>
            <View style={styles.sidebarHeader}>
              <View style={styles.logoContainer}>
                <View style={styles.logoRing} />
                <Text style={styles.logoText}>Menu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarItems}>
              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('DonateForm'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#FEF3F2'}]}>
                  <MaterialCommunityIcons name="heart-plus" color="#E74C3C" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Donate</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('NearMe', { type: 'donations' }); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#F0F9F4'}]}>
                  <Feather name="search" color="#2F7B5E" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Find Donations</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('Requests'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#EEF2FF'}]}>
                  <Ionicons name="clipboard" color="#4F46E5" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Requests</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('History'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#F5F3FF'}]}>
                  <MaterialCommunityIcons name="history" color="#7C3AED" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('Requests'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#FFF7ED'}]}>
                  <Ionicons name="notifications" color="#F39C12" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Notifications</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('Leaderboard'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#FFFBEB'}]}>
                  <MaterialCommunityIcons name="trophy" color="#F59E0B" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Rankings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('Profile'); }}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#F8FAFC'}]}>
                  <Feather name="user" color="#64748B" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Profile</Text>
              </TouchableOpacity>

              {user?.role === 'admin' && (
                <TouchableOpacity style={styles.sidebarItem} onPress={() => { setIsSidebarOpen(false); navigation.navigate('AdminDashboard'); }}>
                  <View style={[styles.sidebarIconBox, {backgroundColor: '#F0FDFA'}]}>
                    <MaterialCommunityIcons name="shield-crown" color="#0D9488" size={22} />
                  </View>
                  <Text style={styles.sidebarLabel}>Admin Panel</Text>
                </TouchableOpacity>
              )}

              <View style={styles.sidebarDivider} />
              
              <TouchableOpacity style={styles.sidebarItem} onPress={() => setIsSidebarOpen(false)}>
                <View style={[styles.sidebarIconBox, {backgroundColor: '#F1F5F9'}]}>
                  <Feather name="settings" color="#1E293B" size={22} />
                </View>
                <Text style={styles.sidebarLabel}>Services</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarFooter}>
              <Text style={styles.versionText}>ShareCircle v1.0.4</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
            <RefreshControl 
                refreshing={false} // You can connect a refreshing state if needed
                onRefresh={() => {
                    // Trigger data refresh logic
                    navigation.replace('MainTabs'); 
                }} 
                colors={['#2F7B5E']}
                tintColor="#2F7B5E"
            />
        }
      >
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuIconBtn} onPress={() => setIsSidebarOpen(true)}>
            <Feather name="menu" color="#1E293B" size={26} />
          </TouchableOpacity>

          <View style={styles.logoContainerCenter}>
            <View style={styles.logoRing} />
            <Text style={styles.logoText}>ShareCircle</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Requests')}>
              <Ionicons name="notifications-outline" color="#1E293B" size={26} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greetingText}>{getTimeGreeting()}, <Text style={styles.userName}>{user?.fullName ? user.fullName.split(' ')[0] : 'User'}</Text></Text>
          <Text style={styles.subGreetingText}>{getSubGreeting()}</Text>
        </View>

        {/* Primary Action Card */}
        <TouchableOpacity style={styles.primaryActionCard} onPress={() => navigation.navigate('DonateForm')}>
          <View style={styles.cardInfo}>
            <View style={styles.iconTitleRow}>
              <View style={styles.heartIconCircle}>
                <MaterialCommunityIcons name="heart" color="#FFF" size={16} />
              </View>
              <Text style={styles.cardTitle}>Donate Items</Text>
            </View>
            <Text style={styles.cardSubtitle}>Help someone nearby{'\n'}in minutes</Text>
            <TouchableOpacity style={styles.donateButton} onPress={() => navigation.navigate('DonateForm')}>
              <Text style={styles.donateButtonText}>Donate Now</Text>
              <Feather name="arrow-right" color="#FFF" size={16} style={{marginLeft: 8}} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardImageContainer}>
             <View style={styles.cardDecorativeCircle} />
             <Image 
               source={require('../../assets/donation_hero_clean.png')} 
               style={styles.cardIllustrationLarge}
             />
          </View>
        </TouchableOpacity>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('NearMe', { type: 'donations' })}>
          <View style={styles.searchIconContainer}>
            <Feather name="search" color="#2F7B5E" size={24} />
          </View>
          <View style={styles.searchTextContainer}>
            <Text style={styles.searchTextTitle}>Looking for items?</Text>
            <Text style={styles.searchTextSubtitle}>Find Nearby Donations</Text>
          </View>
          <View style={styles.arrowIconContainer}>
            <Feather name="chevron-right" color="#2F7B5E" size={16} />
          </View>
        </TouchableOpacity>

        {/* Adjusting Slider */}
        <View style={{flexDirection: 'row', alignItems:'center', marginBottom: 20}}>
           <Text style={{fontSize: 12, color: '#94A3B8', marginRight: 5}}>0km</Text>
           <Slider
             style={{flex: 1, height: 35}}
             minimumValue={0}
             maximumValue={100}
             step={1}
             value={parseInt(radiusInput) || 50}
             onValueChange={(val) => setRadiusInput(val.toString())}
             minimumTrackTintColor="#2F7B5E"
             maximumTrackTintColor="#D1EAE0"
             thumbTintColor="#F39C12"
           />
           <Text style={{fontSize: 12, color: '#94A3B8', marginLeft: 5}}>100km</Text>
        </View>

                <View style={isFullScreen ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#FFF' } : { height: 320, borderRadius: 24, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 }}>
              {location ? (
                <View style={{ flex: 1 }}>
                  <LeafletMap
                    latitude={location.latitude}
                    longitude={location.longitude}
                    zoom={
                      activeRadius <= 2  ? 14 :
                      activeRadius <= 5  ? 13 :
                      activeRadius <= 10 ? 12 :
                      activeRadius <= 20 ? 11 :
                      activeRadius <= 40 ? 10 :
                      activeRadius <= 80 ? 9  : 8
                    }
                    markers={(selectedCategory === 'All' ? nearbyItems : nearbyItems.filter(d => d.category === selectedCategory))}
                    radiusKm={activeRadius}
                    satellite={mapType === 'satellite'}
                    onMarkerPress={(id) => {
                      const found = nearbyItems.find(it => String(it._id) === String(id));
                      if (found) setSelectedMarker(found);
                    }}
                    style={styles.map}
                  />

                  {/* Floating Map Controls */}
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
                </View>
              ) : (
                 <View style={{flex:1, width: '100%', backgroundColor: '#E2F0E8', justifyContent:'center', alignItems:'center'}}>
                   <Ionicons name="location" color="#2F7B5E" size={32} />
                 </View>
              )}

              {/* Selected Marker Overlay details mimicking the list view */}
              {selectedMarker && (
                  <View style={{ position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: '#FFF', borderRadius: 20, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, flexDirection: 'row' }}>
                      <TouchableOpacity style={{position:'absolute', top: -8, right: -8, zIndex: 20, backgroundColor: '#FFF', borderRadius: 14}} onPress={() => setSelectedMarker(null)}>
                          <Ionicons name="close-circle" size={28} color="#E74C3C" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => navigation.navigate('DonationDetail', { item: selectedMarker, userLocation: location })}
                      >
                          <Image source={{ uri: selectedMarker.image || selectedMarker.imageUrl || 'https://via.placeholder.com/150' }} style={{ width: 85, height: 85, borderRadius: 14, marginRight: 14, backgroundColor: '#E2E8F0' }} />
                          
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 }} numberOfLines={1}>
                                  {selectedMarker.donor?.fullName || 'Anonymous'}
                              </Text>
                              <Text style={{ fontSize: 14, color: '#334155', fontWeight: '600', marginBottom: 4 }}>{selectedMarker.title}</Text>
                              <Text style={{ fontSize: 12, color: '#64748B' }}>
                                  Dist: {routeDistance || calculateDistance(location, selectedMarker.location)}
                              </Text>
                          </View>
                      </TouchableOpacity>
                      
                      <View style={{ marginLeft: 10, alignItems: 'flex-end', justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity 
                                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#4B8BF5', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}
                                  onPress={() => {
                                      if (selectedMarker.location && selectedMarker.location.coordinates) {
                                          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.location.coordinates[1]},${selectedMarker.location.coordinates[0]}`);
                                      }
                                  }}
                              >
                                  <Ionicons name="navigate" color="#FFF" size={16} />
                              </TouchableOpacity>
                              
                              <TouchableOpacity 
                                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 }}
                                  onPress={() => {
                                      const p = selectedMarker.donor?.mobileNumber || '';
                                      if(p) {
                                          let num = formatPhoneNumber(p, false);
                                          Linking.openURL(`tel:${num}`).catch(e => alert("Could not open dialer"));
                                      } else { alert("No mobile number available"); }
                                  }}
                              >
                                  <Ionicons name="call" color="#2F7B5E" size={16} />
                              </TouchableOpacity>
                              
                              <TouchableOpacity 
                                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#30D158', justifyContent: 'center', alignItems: 'center' }}
                                  onPress={async () => {
                                      const p = selectedMarker.donor?.mobileNumber || '';
                                      if(p) {
                                          let num = formatPhoneNumber(p, true);
                                          const userName = user?.fullName || 'a ShareCircle user';
                                          const message = `*ShareCircle *\n\nHello, I hope you are doing well \n\nI am *${userName}*, and I am looking for *${selectedMarker.title}*. If you happen to have one available and are willing to donate or share, it would truly mean a lot to me.\n\nThank you so much for your kindness and support ❤️`;
                                          const encodedMsg = encodeURIComponent(message);
                                          Linking.openURL(`https://wa.me/${num}?text=${encodedMsg}`).catch(e => alert("Could not open WhatsApp"));
                                      } else { alert("No mobile number available"); }
                                  }}
                              >
                                  <MaterialCommunityIcons name="whatsapp" color="#FFF" size={18} />
                              </TouchableOpacity>
                          </View>
                      </View>
                  </View>
              )}
        </View>

        {/* Nearby Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Donated Items Nearby</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2F0E8', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
             <Feather name="refresh-cw" color="#2F7B5E" size={14} style={{ marginRight: 6 }} />
             <TextInput
               style={{ fontSize: 14, fontWeight: '700', color: '#2F7B5E', minWidth: 16, textAlign: 'center', padding: 0 }}
               value={radiusInput}
               onChangeText={setRadiusInput}
               keyboardType="numeric"
               maxLength={3}
             />
             <Text style={{ fontSize: 14, color: '#2F7B5E', fontWeight: '700' }}> km</Text>
             <Feather name="chevron-right" color="#2F7B5E" size={14} style={{ marginLeft: 2 }} />
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 5 }}>
                {categories.map((cat) => (
                    <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[
                            styles.categoryBadge,
                            selectedCategory === cat && styles.categoryBadgeActive
                        ]}
                    >
                        <Text style={[
                            styles.categoryBadgeText,
                            selectedCategory === cat && styles.categoryBadgeTextActive
                        ]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Items List */}
        {(selectedCategory === 'All' ? nearbyItems : nearbyItems.filter(d => d.category === selectedCategory)).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFF', borderRadius: 24 }}>
                <Text style={{ color: '#64748B', fontSize: 16 }}>No items found nearby 📍</Text>
            </View>
        ) : (
            (selectedCategory === 'All' ? nearbyItems : nearbyItems.filter(d => d.category === selectedCategory)).map((item, index) => {
                const creator = item.donor;
                const minutesAgo = Math.max(0, Math.floor((new Date() - new Date(item.createdAt)) / 60000));
                let timeStr = `${minutesAgo} mins ago`;
                if (minutesAgo > 60) timeStr = `${Math.floor(minutesAgo/60)} hrs ago`;
                if (minutesAgo > 1440) timeStr = `${Math.floor(minutesAgo/1440)} days ago`;

                const phone = creator?.mobileNumber || '';

                return (
                    <View key={item._id} style={{ flexDirection: 'row', padding: 14, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                        <TouchableOpacity 
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => navigation.navigate('DonationDetail', { item, userLocation: location })}
                        >
                            <Image source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150' }} style={{ width: 85, height: 85, borderRadius: 14, marginRight: 14, backgroundColor: '#E2E8F0' }} />
                            
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 }} numberOfLines={1}>{creator?.fullName || 'Anonymous'}</Text>
                                <Text style={{ fontSize: 14, color: '#334155', fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B' }}>Uploaded <Feather name="refresh-cw" size={10} /> {timeStr}</Text>
                            </View>
                        </TouchableOpacity>
                        
                        <View style={{ marginLeft: 10, alignItems: 'flex-end', justifyContent: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <TouchableOpacity 
                                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#4B8BF5', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}
                                    onPress={() => {
                                        if (item.location && item.location.coordinates) {
                                            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.location.coordinates[1]},${item.location.coordinates[0]}`);
                                        }
                                    }}
                                >
                                    <Ionicons name="navigate" color="#FFF" size={16} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 }}
                                    onPress={() => {
                                        if(phone) {
                                            let num = formatPhoneNumber(phone, false);
                                            Linking.openURL(`tel:${num}`).catch(e => alert("Could not open dialer"));
                                        } else { alert("No mobile number available"); }
                                    }}
                                >
                                    <Ionicons name="call" color="#2F7B5E" size={16} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#30D158', justifyContent: 'center', alignItems: 'center' }}
                                    onPress={async () => {
                                        if(phone) {
                                            let p = formatPhoneNumber(phone, true);
                                            const userName = user?.fullName || 'a ShareCircle user';
                                            const message = `*ShareCircle *\n\nHello, I hope you are doing well \n\nI am *${userName}*, and I am looking for *${item.title}*. If you happen to have one available and are willing to donate or share, it would truly mean a lot to me.\n\nThank you so much for your kindness and support ❤️`;
                                            const encodedMsg = encodeURIComponent(message);
                                            Linking.openURL(`https://wa.me/${p}?text=${encodedMsg}`).catch(e => alert("Could not open WhatsApp"));
                                        } else { alert("No mobile number available"); }
                                    }}
                                >
                                    <MaterialCommunityIcons name="whatsapp" color="#FFF" size={18} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity 
                                style={{ backgroundColor: '#2F7B5E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center', width: '100%' }}
                                onPress={async () => {
                                    try {
                                        const res = await fetch(`${API_URL}/donations/${item._id}/request`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ requesterId: user?._id, message: `I would like to request ${item.title}` })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            showToast("Request sent! Check the Requests tab. ✅");
                                        } else {
                                            showToast(data.message, "info");
                                        }
                                    } catch (error) {
                                        showToast("Could not send request.", "error");
                                    }
                                }}
                            >

                                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Request</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })
        )}

        {/* Your Impact Section */}
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <View>
              <Text style={styles.impactTitle}>Your Impact</Text>
              <Text style={styles.impactMotto}>Making a difference together 🌿</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>LEVEL 1</Text>
              <View style={styles.levelDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </View>
          </View>
          
          <View style={styles.statsGrid}>
             <View style={styles.impactStatBlock}>
                <View style={styles.impactStatValRow}>
                  <MaterialCommunityIcons name="gift" color="#54B489" size={24} style={{marginRight: 6}} />
                  <Text style={styles.statValue}>{historyStats.donations}</Text>
                </View>
                <Text style={styles.statLabel}>Donations</Text>
             </View>
             
             <View style={styles.verticalDivider} />

             <View style={styles.impactStatBlock}>
                <View style={styles.impactStatValRow}>
                  <MaterialCommunityIcons name="heart" color="#4B8BF5" size={22} style={{marginRight: 6}} />
                  <Text style={styles.statValue}>{historyStats.donations * 5}</Text>
                </View>
                <Text style={styles.statLabel}>Lives</Text>
             </View>

             <View style={styles.verticalDivider} />

             <View style={styles.impactStatBlock}>
                <View style={styles.impactStatValRow}>
                  <MaterialCommunityIcons name="star" color="#F5B041" size={24} style={{marginRight: 6}} />
                  <Text style={styles.statValue}>{historyStats.points}</Text>
                </View>
                <Text style={styles.statLabel}>Points</Text>
             </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    height: 60,
  },
  menuIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    zIndex: -1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebarContent: {
    width: width * 0.75,
    height: '100%',
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  sidebarItems: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  sidebarIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sidebarLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  sidebarFooter: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  logoRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#2F7B5E',
    borderTopColor: '#F39C12',
    marginRight: 8,
    transform: [{ rotate: '-45deg' }],
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F2C20',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F4',
    borderRadius: 20,
    padding: 3,
    marginRight: 12,
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleButtonActive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A9B94',
  },
  roleTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E74C3C',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 22,
    color: '#475569',
    fontWeight: '400',
  },
  userName: {
    fontWeight: '800',
    color: '#1E293B',
  },
  subGreetingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  primaryActionCard: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
  },
  cardInfo: {
    flex: 1.4,
    zIndex: 10,
  },
  heartIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 20,
    fontWeight: '500',
  },
  donateButton: {
    backgroundColor: '#F39C12',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  donateButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  cardImageContainer: {
    flex: 1,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cardDecorativeCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F0FDF4',
    right: -40,
    bottom: -40,
    zIndex: 0,
  },
  cardIllustrationLarge: {
    width: 130,
    height: 130,
    zIndex: 1,
    resizeMode: 'contain',
    transform: [{ rotate: '-5deg' }],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 12,
    paddingRight: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  searchIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  searchTextContainer: {
    flex: 1,
  },
  searchTextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  searchTextSubtitle: {
    fontSize: 13,
    color: '#2F7B5E',
    fontWeight: '500',
  },
  arrowIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  viewAllText: {
    color: '#2F7B5E',
    fontWeight: '700',
    fontSize: 14,
  },
  requestCardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  mapPlaceholder: {
    height: 130,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestDetails: {
    padding: 20,
  },
  requestUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 16,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  requestUserInfo: {
    flex: 1,
  },
  requestUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  requestTimeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  distanceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  titleIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  requestCategory: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circularCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  circularNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4B8BF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#4B8BF5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  circularWhatsappBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#30D158',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#30D158',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  fullWidthActionBtn: {
    backgroundColor: '#E2F0E8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  fullWidthActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2F7B5E',
  },
  impactCard: {
    backgroundColor: '#F4F9F6',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  impactMotto: {
    fontSize: 13,
    color: '#2F7B5E',
    fontWeight: '600',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1EAE0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2F7B5E',
    marginRight: 8,
  },
  levelDots: {
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A0D0B6',
    marginLeft: 4,
  },
  dotActive: {
    backgroundColor: '#2F7B5E',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactStatBlock: {
    flex: 1,
    alignItems: 'center',
  },
  impactStatValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  verticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#D1EAE0',
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeActive: {
    backgroundColor: '#2F7B5E',
    borderColor: '#2F7B5E',
  },
  categoryBadgeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  categoryBadgeTextActive: {
    color: '#FFF',
  },
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

export default DashboardScreen;
