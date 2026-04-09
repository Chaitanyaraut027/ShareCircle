import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { getNearbyItems } from '../services/api';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  Feather, 
  Ionicons 
} from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [role, setRole] = useState('Donor'); // 'Donor' or 'Receiver'
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nearbyItems, setNearbyItems] = useState([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();

    const fetchUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Error fetching user from AsyncStorage:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchNearby = async () => {
        if (location) {
            const type = role === 'Donor' ? 'requests' : 'donations';
            const res = await getNearbyItems(location.longitude, location.latitude, type);
            if (res && res.success) {
                setNearbyItems(res.data);
            }
        }
    };
    fetchNearby();
  }, [location, role]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Image 
              source={{ uri: 'https://placeholder.com/logo' }} // Use actual logo if available
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerRight}>
            <View style={styles.roleToggle}>
              <TouchableOpacity 
                style={[styles.roleButton, role === 'Donor' && styles.roleButtonActive]}
                onPress={() => setRole('Donor')}
              >
                <Text style={[styles.roleText, role === 'Donor' && styles.roleTextActive]}>Donor</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleButton, role === 'Receiver' && styles.roleButtonActive]}
                onPress={() => setRole('Receiver')}
              >
                <Text style={[styles.roleText, role === 'Receiver' && styles.roleTextActive]}>Receiver</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
                  {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={styles.notificationBadge}><Text style={styles.badgeText}>1</Text></View>
            </View>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greetingText}>Good Evening, <Text style={styles.userName}>{user?.fullName ? user.fullName.split(' ')[0] : 'User'}</Text></Text>
        </View>

        {/* Primary Action Card */}
        {role === 'Donor' ? (
          <TouchableOpacity style={styles.primaryActionCard} onPress={() => navigation.navigate('DonateForm')}>
            <View style={styles.cardInfo}>
              <View style={styles.iconTitleRow}>
                <MaterialCommunityIcons name="heart" color="#E74C3C" size={20} />
                <Text style={styles.cardTitle}>Donate Items</Text>
              </View>
              <Text style={styles.cardSubtitle}>Help someone nearby{'\n'}in minutes</Text>
              <View style={styles.donateButton}>
                <Text style={styles.donateButtonText}>Donate Now</Text>
              </View>
            </View>
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/10052/10052912.png' }} // Generic donation box illustration
              style={styles.cardIllustration}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryActionCard} onPress={() => navigation.navigate('RequestForm')}>
            <View style={styles.cardInfo}>
              <View style={styles.iconTitleRow}>
                <MaterialCommunityIcons name="hand-heart" color="#10B981" size={20} />
                <Text style={styles.cardTitle}>Request Help</Text>
              </View>
              <Text style={styles.cardSubtitle}>Ask your community{'\n'}for support</Text>
              <View style={[styles.donateButton, { backgroundColor: '#10B981' }]}>
                <Text style={styles.donateButtonText}>Request Now</Text>
              </View>
            </View>
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/610/610313.png' }} // Generic help illustration
              style={styles.cardIllustration}
            />
          </TouchableOpacity>
        )}

        {/* Search Bar / Nearby Requests Entry */}
        <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('RequestForm')}>
          <View style={styles.searchIconContainer}>
            <Feather name="search" color="#10B981" size={24} />
          </View>
          <View style={styles.searchTextContainer}>
            <Text style={styles.searchTextTitle}>Looking for help?</Text>
            <Text style={styles.searchTextSubtitle}>Find Nearby Donations</Text>
          </View>
          <Feather name="chevron-right" color="#CBD5E1" size={20} />
        </TouchableOpacity>

        {/* Nearby Urgent Requests or Available Donations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{role === 'Donor' ? 'Nearby Urgent Requests' : 'Available Donations Nearby'}</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Map Placeholder with Request Card */}
        <View style={styles.requestCardContainer}>
          {/* Render markers for each dynamic item */}
          <View style={styles.mapPlaceholder}>
              {location ? (
                <MapView
                  style={{ width: '100%', height: '100%' }}
                  initialRegion={location}
                >
                  <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} pinColor="blue" title="You" />
                  {nearbyItems.map(item => (
                      item.location && item.location.coordinates && (
                          <Marker 
                             key={item._id} 
                             coordinate={{ latitude: item.location.coordinates[1], longitude: item.location.coordinates[0] }} 
                             title={item.title} 
                             pinColor={role === 'Donor' ? 'red' : 'green'} 
                          />
                      )
                  ))}
                </MapView>
              ) : (
                <View style={styles.mapMarker}>
                  <Ionicons name="location" color="#FFF" size={20} />
                </View>
              )}
          </View>
          
          {/* Dynamic Item List */}
          {nearbyItems.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#64748B' }}>No nearby {role === 'Donor' ? 'requests' : 'donations'} found.</Text>
            </View>
          ) : (
            nearbyItems.map(item => {
              // Extract the user that posted it
              const creator = role === 'Donor' ? item.requester : item.donor;
              return (
              <View key={item._id} style={styles.requestDetails}>
                <View style={styles.requestUserRow}>
                  <Image source={{ uri: creator?.profilePic || 'https://i.pravatar.cc/150?u=fallback' }} style={styles.requestAvatar} />
                  <View style={styles.requestUserInfo}>
                    <Text style={styles.requestUserName}>{creator?.fullName || 'Anonymous'}</Text>
                    <Text style={styles.requestTimeText}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>Near you</Text>
                  </View>
                </View>

                <Text style={styles.requestTitle}>{item.title}</Text>
                <Text style={styles.requestCategory}>{item.category}</Text>

                <View style={styles.actionRow}>
                   <View style={[styles.urgentBadge, role === 'Receiver' && { backgroundColor: '#10B981' }]}>
                     <Text style={styles.urgentText}>{role === 'Donor' ? 'URGENT' : 'AVAILABLE'}</Text>
                   </View>
                   {/* In a complete app, these would open WhatsApp or dialer */}
                   <TouchableOpacity style={styles.circularActionBtn}>
                     <Feather name="phone" color="#10B981" size={18} />
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.circularActionBtn} onPress={() => alert('WhatsApp Mock: Notifying user...')}>
                     <MaterialCommunityIcons name="whatsapp" color="#10B981" size={18} />
                   </TouchableOpacity>
                </View>
              </View>
            )})
          )}
        </View>

        {/* Your Impact Section */}
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <Text style={styles.impactTitle}>Your Impact</Text>
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
          <Text style={styles.impactMotto}>Making a difference 🌿</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: '#F0FDF4' }]}>
                 <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' }} style={styles.statIcon} />
              </View>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Donations</Text>
            </View>
            
            <View style={styles.statItemDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: '#FEF2F2' }]}>
                 <MaterialCommunityIcons name="heart" color="#EF4444" size={20} />
              </View>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>Lives</Text>
            </View>

            <View style={styles.statItemDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: '#FFFBEB' }]}>
                 <MaterialCommunityIcons name="trophy" color="#F59E0B" size={20} />
              </View>
              <Text style={styles.statValue}>75</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
    marginRight: 10,
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  roleButtonActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roleTextActive: {
    color: '#334155',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 20,
    color: '#475569',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  subGreetingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  primaryActionCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 20,
  },
  cardInfo: {
    flex: 1,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  donateButton: {
    backgroundColor: '#F39C12', // Warm orange like in image
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  donateButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cardIllustration: {
    width: 120,
    height: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 12,
    paddingRight: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  searchTextContainer: {
    flex: 1,
  },
  searchTextTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchTextSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  viewAllText: {
    color: '#10B981',
    fontWeight: '600',
  },
  requestCardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  mapPlaceholder: {
    height: 120,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestDetails: {
    padding: 20,
  },
  requestUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  requestUserInfo: {
    flex: 1,
  },
  requestUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  requestTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  distanceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  requestCategory: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  urgentBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 'auto',
  },
  urgentText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  circularActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  impactCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    marginRight: 6,
  },
  levelDots: {
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    marginLeft: 3,
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  impactMotto: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    width: 20,
    height: 20,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statItemDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
  }
});

export default DashboardScreen;
