import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Linking, Image, Dimensions,
  RefreshControl, Platform, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LeafletMap from '../components/LeafletMap';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';

const { width: SW } = Dimensions.get('window');

// ─── helpers ─────────────────────────────────────────────────────────────────
const CATEGORY_META = {
  All:         { icon: 'apps',              color: '#6366F1' },
  Food:        { icon: 'fast-food-outline', color: '#F97316' },
  Clothes:     { icon: 'shirt-outline',     color: '#3B82F6' },
  Books:       { icon: 'book-outline',      color: '#8B5CF6' },
  Electronics: { icon: 'tv-outline',        color: '#10B981' },
  Medical:     { icon: 'medical-outline',   color: '#EF4444' },
  Toys:        { icon: 'extension-puzzle-outline', color: '#EC4899' },
  Other:       { icon: 'grid-outline',      color: '#64748B' },
};

const catColor = (c) => (CATEGORY_META[c] || CATEGORY_META.Other).color;
const catIcon  = (c) => (CATEGORY_META[c] || CATEGORY_META.Other).icon;

const haversine = (c1, c2) => {
  if (!c1 || !c2) return null;
  const getLat = c => c.latitude  ?? c.coordinates?.[1];
  const getLng = c => c.longitude ?? c.coordinates?.[0];
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(getLat(c2) - getLat(c1));
  const dLng = toR(getLng(c2) - getLng(c1));
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(getLat(c1)))*Math.cos(toR(getLat(c2)))*Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
};

const fmt = (phone, wa=false) => {
  if (!phone) return '';
  const d = phone.replace(/\D/g,'');
  if (d.length === 10) return wa ? `91${d}` : `+91${d}`;
  return wa ? d : `+${d}`;
};

// ─── card ─────────────────────────────────────────────────────────────────────
const DonationCard = ({ item, location, onNavigate, onCall, onWhatsApp, onPress }) => {
  const dist = location && item.location?.coordinates
    ? haversine(location, { latitude: item.location.coordinates[1], longitude: item.location.coordinates[0] })
    : null;
  const color = catColor(item.category);
  const imgUri = item.image || item.imageUrl || null;

  return (
    <TouchableOpacity activeOpacity={0.93} style={card.wrapper} onPress={onPress}>
      {/* Image */}
      <View style={[card.imgBox, { borderColor: color + '30' }]}>
        {imgUri
          ? <Image source={{ uri: imgUri }} style={card.img} resizeMode="cover" />
          : <View style={[card.imgFallback, { backgroundColor: color + '18' }]}>
              <Ionicons name={catIcon(item.category)} size={30} color={color} />
            </View>
        }
        {/* Category badge */}
        <View style={[card.catBadge, { backgroundColor: color }]}>
          <Ionicons name={catIcon(item.category)} size={10} color="#FFF" />
          <Text style={card.catTxt}>{item.category}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={card.info}>
        <Text style={card.title} numberOfLines={2}>{item.title}</Text>

        <View style={card.row}>
          <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
          <Text style={card.donor} numberOfLines={1}>
            {' '}{item.donor?.fullName || 'Anonymous'}
          </Text>
        </View>

        {item.address?.fullAddress || item.homeNo ? (
          <View style={card.row}>
            <Ionicons name="location-outline" size={12} color="#94A3B8" />
            <Text style={card.addrTxt} numberOfLines={1}>
              {' '}{item.address?.fullAddress || item.homeNo || ''}
            </Text>
          </View>
        ) : null}

        <View style={card.bottomRow}>
          {dist && (
            <View style={[card.distChip, { backgroundColor: color + '15' }]}>
              <Ionicons name="navigate-circle-outline" size={12} color={color} />
              <Text style={[card.distTxt, { color }]}> {dist} km</Text>
            </View>
          )}
          <View style={card.actions}>
            <TouchableOpacity style={[card.btn, { backgroundColor: '#F0FDF4' }]} onPress={onCall}>
              <Ionicons name="call-outline" size={16} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity style={[card.btn, { backgroundColor: '#F0FDF4' }]} onPress={onWhatsApp}>
              <MaterialCommunityIcons name="whatsapp" size={17} color="#25D366" />
            </TouchableOpacity>
            <TouchableOpacity style={[card.btn, { backgroundColor: '#EFF6FF' }]} onPress={onNavigate}>
              <Ionicons name="navigate-outline" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── main screen ─────────────────────────────────────────────────────────────
const CATEGORIES = ['All','Food','Clothes','Books','Electronics','Medical','Toys','Other'];

export default function FindNearbyDonationsScreen({ navigation }) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [radius, setRadius]               = useState(5);
  const [donations, setDonations]         = useState([]);
  const [location, setLocation]           = useState(null);
  const [userId, setUserId]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMarker, setSelectedMarker]     = useState(null);
  const [mapType, setMapType]             = useState('standard');
  const [mapCollapsed, setMapCollapsed]   = useState(false);
  const mapHeight = useRef(new Animated.Value(240)).current;

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchDonations = useCallback(async (q, r, loc, uid = userId) => {
    if (!loc) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/dashboard/nearby`, {
        params: { lat: loc.latitude, lng: loc.longitude, radius: r, query: q, type: 'donations', excludeUserId: uid },
      });
      if (data.success) {
        setDonations([...data.data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      }
    } catch (e) {
      console.error('fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      let myLoc = null; let uid = null;
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          uid = u._id; setUserId(uid);
          if (u.location?.coordinates?.length === 2) {
            myLoc = { latitude: u.location.coordinates[1], longitude: u.location.coordinates[0] };
          }
        }
      } catch (_) {}
      if (!myLoc) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const l = await Location.getCurrentPositionAsync({});
          myLoc = { latitude: l.coords.latitude, longitude: l.coords.longitude };
        }
      }
      if (myLoc) { setLocation(myLoc); fetchDonations('', radius, myLoc, uid); }
    })();
  }, []);

  useEffect(() => {
    if (!location) return;
    const t = setTimeout(() => fetchDonations(searchQuery, radius, location), 500);
    return () => clearTimeout(t);
  }, [searchQuery, radius, location]);

  // ── map collapse animation ────────────────────────────────────────────────
  const toggleMap = () => {
    Animated.timing(mapHeight, {
      toValue: mapCollapsed ? 240 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
    setMapCollapsed(v => !v);
  };

  // ── actions ──────────────────────────────────────────────────────────────
  const openWhatsApp = async (phone, title) => {
    const raw = await AsyncStorage.getItem('user');
    const me = raw ? JSON.parse(raw).fullName : 'a ShareCircle user';
    const msg = `*ShareCircle*\n\nHello! I am *${me}* and I'm interested in *${title}*.\nCould you please share more details?\n\nThank you ❤️`;
    Linking.openURL(`https://wa.me/${fmt(phone,true)}?text=${encodeURIComponent(msg)}`).catch(()=>{});
  };
  const callPhone = (p) => p && Linking.openURL(`tel:${fmt(p)}`);
  const navigate  = (item) => {
    const c = item.location?.coordinates;
    if (c) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`);
  };

  // ── filtered list ────────────────────────────────────────────────────────
  const filtered = selectedCategory === 'All'
    ? donations
    : donations.filter(d => d.category === selectedCategory);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nearby Donations</Text>
        <TouchableOpacity style={s.mapToggle} onPress={toggleMap}>
          <Ionicons name={mapCollapsed ? 'map-outline' : 'map'} size={20} color="#10B981" />
          <Text style={s.mapToggleTxt}>{mapCollapsed ? 'Map' : 'Hide'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search donations..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>

        {/* Radius row */}
        <View style={s.radiusRow}>
          <Text style={s.radiusLabel}>Radius</Text>
          <View style={s.radiusSlider}>
            <Slider
              style={{ flex: 1 }}
              minimumValue={1} maximumValue={50} step={1}
              value={radius} onValueChange={setRadius}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor="#10B981"
            />
          </View>
          <View style={s.radiusBadge}>
            <Text style={s.radiusBadgeTxt}>{radius} km</Text>
          </View>
        </View>
      </View>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.mapCard, { height: mapHeight }]}>
        {location ? (
          <>
            <LeafletMap
              style={{ flex: 1 }}
              latitude={location.latitude}
              longitude={location.longitude}
              zoom={Math.max(8, Math.round(14 - Math.log2(Math.max(1, radius))))}
              markers={filtered}
              radiusKm={radius}
              satellite={mapType === 'satellite'}
              onMarkerPress={(id) => {
                const f = donations.find(it => String(it._id) === String(id));
                if (f) setSelectedMarker(f);
              }}
            />
            {/* Map controls */}
            <View style={s.mapControls}>
              <TouchableOpacity style={s.mapCtlBtn}
                onPress={() => setMapType(t => t === 'standard' ? 'satellite' : 'standard')}>
                <Ionicons name={mapType === 'standard' ? 'layers-outline' : 'map-outline'} size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>
            {/* Selected marker popup */}
            {selectedMarker && (
              <View style={s.popup}>
                <Image
                  source={{ uri: selectedMarker.image || selectedMarker.imageUrl || 'https://via.placeholder.com/80' }}
                  style={s.popupImg}
                />
                <View style={s.popupInfo}>
                  <Text style={s.popupTitle} numberOfLines={1}>{selectedMarker.title}</Text>
                  <Text style={s.popupDonor} numberOfLines={1}>{selectedMarker.donor?.fullName || 'Anonymous'}</Text>
                  <Text style={s.popupDist}>
                    {haversine(location, selectedMarker.location) ?? '--'} km away
                  </Text>
                </View>
                <View style={s.popupActions}>
                  <TouchableOpacity style={[s.popActBtn,{backgroundColor:'#10B981'}]}
                    onPress={() => navigate(selectedMarker)}>
                    <Ionicons name="navigate" size={15} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.popActBtn,{backgroundColor:'#25D366', marginTop:6}]}
                    onPress={() => openWhatsApp(selectedMarker.donor?.mobileNumber, selectedMarker.title)}>
                    <MaterialCommunityIcons name="whatsapp" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.popupClose} onPress={() => setSelectedMarker(null)}>
                  <Ionicons name="close-circle" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={s.mapLoading}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={s.mapLoadingTxt}>Locating you…</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Category filter ─────────────────────────────────────────────────── */}
      <View style={s.filterWrap}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={CATEGORIES} keyExtractor={i => i}
          contentContainerStyle={s.filterList}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            const col = catColor(item);
            return (
              <TouchableOpacity
                style={[s.chip, active && { backgroundColor: col, borderColor: col }]}
                onPress={() => setSelectedCategory(item)}
              >
                <Ionicons name={catIcon(item)} size={13} color={active ? '#FFF' : col} />
                <Text style={[s.chipTxt, active && { color: '#FFF' }]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <View style={s.listWrap}>
        {/* Count bar */}
        <View style={s.countBar}>
          <Text style={s.countTxt}>
            {loading ? 'Loading…' : `${filtered.length} donation${filtered.length !== 1 ? 's' : ''} found`}
          </Text>
          {!loading && filtered.length > 0 && (
            <Text style={s.refreshHint}>Pull to refresh</Text>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchDonations(searchQuery, radius, location);
                setRefreshing(false);
              }}
              colors={['#10B981']}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={s.emptyWrap}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={s.emptyTxt}>Finding nearby donations…</Text>
              </View>
            ) : (
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Ionicons name="gift-outline" size={44} color="#CBD5E1" />
                </View>
                <Text style={s.emptyHead}>No donations found</Text>
                <Text style={s.emptyTxt}>Try increasing the radius or changing the category filter.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <DonationCard
              item={item}
              location={location}
              onPress={() => navigation.navigate('DonationDetail', { item, userLocation: location })}
              onCall={() => callPhone(item.donor?.mobileNumber)}
              onWhatsApp={() => openWhatsApp(item.donor?.mobileNumber, item.title)}
              onNavigate={() => navigate(item)}
            />
          )}
        />
      </View>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.donateBtn} onPress={() => navigation.navigate('DonateForm')}>
          <Ionicons name="gift-outline" size={20} color="#FFF" />
          <Text style={s.donateBtnTxt}>Donate an Item</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── card styles ──────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  imgBox: {
    width: 90, height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1.5,
  },
  img: { width: '100%', height: '100%' },
  imgFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  catBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 3, paddingHorizontal: 6,
    justifyContent: 'center',
  },
  catTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', marginLeft: 3 },
  info: { flex: 1, justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  donor: { fontSize: 12, color: '#64748B', fontWeight: '600', flex: 1 },
  addrTxt: { fontSize: 11, color: '#94A3B8', flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  distChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  distTxt: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row' },
  btn: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginLeft: 6,
  },
});

// ─── screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  mapToggle: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1, borderColor: '#D1FAE5',
  },
  mapToggleTxt: { fontSize: 12, fontWeight: '800', color: '#10B981', marginLeft: 4 },

  // Search
  searchWrap: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10,
  },
  searchInput: { flex: 1, marginHorizontal: 8, fontSize: 14, color: '#334155' },
  radiusRow: { flexDirection: 'row', alignItems: 'center' },
  radiusLabel: { fontSize: 13, fontWeight: '700', color: '#334155', width: 48 },
  radiusSlider: { flex: 1, marginHorizontal: 6 },
  radiusBadge: {
    backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  radiusBadgeTxt: { fontSize: 12, fontWeight: '800', color: '#10B981' },

  // Map
  mapCard: {
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#E8F0E9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  mapControls: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  mapCtlBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  mapLoadingTxt: { fontSize: 13, color: '#64748B' },

  // Popup
  popup: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: '#FFF', borderRadius: 18, padding: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  popupImg: { width: 58, height: 58, borderRadius: 12, marginRight: 10, backgroundColor: '#F1F5F9' },
  popupInfo: { flex: 1 },
  popupTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  popupDonor: { fontSize: 12, color: '#64748B', marginVertical: 1 },
  popupDist: { fontSize: 11, color: '#10B981', fontWeight: '700' },
  popupActions: { marginLeft: 8 },
  popActBtn: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  popupClose: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFF', borderRadius: 12 },

  // Category filter
  filterWrap: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterList: { paddingHorizontal: 14, paddingVertical: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, marginRight: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipTxt: { fontSize: 12, fontWeight: '700', color: '#64748B', marginLeft: 4 },

  // List
  listWrap: { flex: 1 },
  countBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  countTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  refreshHint: { fontSize: 11, color: '#CBD5E1' },
  listContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 120 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyHead: { fontSize: 18, fontWeight: '900', color: '#334155', marginBottom: 8 },
  emptyTxt: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  donateBtn: {
    backgroundColor: '#10B981', height: 50, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  donateBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '900', marginLeft: 8 },
});
