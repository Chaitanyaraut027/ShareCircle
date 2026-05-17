import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Linking, Image, Dimensions,
  RefreshControl, StatusBar, Animated, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import LeafletMap from '../components/LeafletMap';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';
import CustomToast from '../components/CustomToast';

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

const CATEGORIES = ['All','Food','Clothes','Books','Electronics','Medical','Toys','Other'];

// ─── card ─────────────────────────────────────────────────────────────────────
const NeedCard = ({ item, location, onNavigate, onCall, onWhatsApp, onOffer }) => {
  const dist = location && item.location?.coordinates
    ? haversine(location, { latitude: item.location.coordinates[1], longitude: item.location.coordinates[0] })
    : null;
  const color = catColor(item.category);

  return (
    <View style={card.wrapper}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={card.info}>
            <Text style={card.title} numberOfLines={2}>{item.title}</Text>
            <View style={card.row}>
                <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                <Text style={card.donor} numberOfLines={1}>
                    {' '}{item.requester?.fullName || 'Anonymous'}
                </Text>
            </View>
            <View style={card.row}>
                <Ionicons name="layers-outline" size={14} color="#64748B" />
                <Text style={card.donor} numberOfLines={1}>
                    {' '}Qty: {item.quantity || '1'}
                </Text>
            </View>
        </View>
        
        {/* Category badge */}
        <View style={[card.catBadge, { backgroundColor: color + '15', borderColor: color }]}>
          <Ionicons name={catIcon(item.category)} size={12} color={color} />
          <Text style={[card.catTxt, {color: color}]}>{item.category}</Text>
        </View>
      </View>

      <Text style={card.desc} numberOfLines={3}>{item.description}</Text>

      {/* Actions */}
      <View style={card.bottomRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {dist && (
            <View style={[card.distChip, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={[card.distTxt, { color: '#64748B' }]}> {dist} km</Text>
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

        <TouchableOpacity style={card.offerBtn} onPress={() => onOffer(item._id)}>
            <Text style={card.offerBtnTxt}>Offer to Fulfill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


// ─── main screen ─────────────────────────────────────────────────────────────
export default function NeedRequestScreen({ navigation }) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [radius, setRadius]               = useState(5);
  const [needs, setNeeds]                 = useState([]);
  const [location, setLocation]           = useState(null);
  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMarker, setSelectedMarker]     = useState(null);
  const [mapType, setMapType]             = useState('standard');
  const [mapCollapsed, setMapCollapsed]   = useState(false);
  const [isFullScreen, setIsFullScreen]   = useState(false);
  const mapHeight = useRef(new Animated.Value(240)).current;

  // Post Need Modal State
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postQuantity, setPostQuantity] = useState('');
  const [postDesc, setPostDesc] = useState('');
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Moderation state
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const showToast = (msg, type = 'success') => {
    setToastMessage(msg); setToastType(type); setToastVisible(true);
  };

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchNeeds = useCallback(async (loc, r) => {
    if (!loc) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/requests/nearby`, {
        params: { latitude: loc.latitude, longitude: loc.longitude, radius: r, category: selectedCategory },
      });
      if (data.success) {
        let filtered = data.data;
        if(user && user._id) {
            filtered = data.data.filter(d => d.requester?._id !== user._id);
        }
        setNeeds(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
    } catch (e) {
      console.error('fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    (async () => {
      let myLoc = null; let u = null;
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          u = JSON.parse(raw);
          setUser(u);
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
      if (myLoc) { setLocation(myLoc); fetchNeeds(myLoc, radius); }
    })();
  }, [selectedCategory]);

  useEffect(() => {
    if (!location) return;
    const t = setTimeout(() => fetchNeeds(location, radius), 500);
    return () => clearTimeout(t);
  }, [radius, location]);

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
    const me = user ? user.fullName : 'a ShareCircle user';
    const msg = `*ShareCircle*\n\nHello! I am *${me}* and I can fulfill your need for *${title}*.\nLet me know how we can coordinate!\n\nThank you ❤️`;
    Linking.openURL(`https://wa.me/${fmt(phone,true)}?text=${encodeURIComponent(msg)}`).catch(()=>{});
  };
  const callPhone = (p) => p && Linking.openURL(`tel:${fmt(p)}`);
  const navigate  = (item) => {
    const c = item.location?.coordinates;
    if (c) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`);
  };

  const handleOffer = async (requestId) => {
    try {
        if(!user) return showToast("Please login first", "error");
        const res = await axios.post(`${API_URL}/requests/${requestId}/offer`, { donorId: user._id });
        if(res.data.success) {
            showToast("Offer sent successfully! 🎉");
            fetchNeeds(location, radius);
        }
    } catch(err) {
        if(err.response && err.response.data.message) {
            showToast(err.response.data.message, "error");
        } else {
            showToast("Failed to send offer", "error");
        }
    }
  };

  const generateAI = async () => {
      if(!postTitle || !postCategory) {
          return showToast("Enter title and category first to generate AI description", "error");
      }
      try {
          setGeneratingDesc(true);
          const res = await axios.post(`${API_URL}/donations/generate-description`, {
              title: postTitle, category: postCategory, quantity: postQuantity || '1', type: 'need'
          });
          if(res.data.success) {
              setPostDesc(res.data.description);
              showToast("AI Description Generated ✨");
          }
      } catch (e) {
          showToast("AI Failed. Please write description manually.", "error");
      } finally {
          setGeneratingDesc(false);
      }
  };

  const submitNeed = async () => {
      if(!postTitle || !postCategory || !postQuantity) return showToast("Please fill all required fields", "error");
      if(!location) return showToast("Location not found", "error");

      try {
          setIsSubmitting(true);
          const res = await axios.post(`${API_URL}/requests`, {
              requesterId: user._id,
              title: postTitle,
              category: postCategory,
              quantity: postQuantity,
              description: postDesc,
              longitude: location.longitude,
              latitude: location.latitude
          });
          if(res.data.success) {
              setPostModalVisible(false);
              if (res.data.data?.status === 'under_review') {
                  showToast("Need Request submitted for admin review! 🛡️");
              } else {
                  showToast("Need Request Posted! 📢");
              }
              setPostTitle(''); setPostCategory(''); setPostQuantity(''); setPostDesc('');
              fetchNeeds(location, radius);
          }
      } catch (err) {
          if (err.response?.status === 400 && err.response?.data?.reason) {
              setRejectionReason(err.response.data.reason || 'Your request was flagged as inappropriate.');
              setRejectionModalVisible(true);
          } else {
              showToast("Failed to post request", "error");
          }
      } finally {
          setIsSubmitting(false);
      }
  };

  // ── filtered list ────────────────────────────────────────────────────────
  const filtered = needs.filter(d => 
      searchQuery === '' || d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Need Requests</Text>
        <TouchableOpacity style={s.mapToggle} onPress={toggleMap}>
          <Ionicons name={mapCollapsed ? 'map-outline' : 'map'} size={20} color="#10B981" />
          <Text style={[s.mapToggleTxt, {color: '#10B981'}]}>{mapCollapsed ? 'Map' : 'Hide'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search needs..."
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
              minimumValue={0.1} maximumValue={100} step={0.1}
              value={radius} onValueChange={setRadius}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor="#10B981"
            />
          </View>
          <View style={[s.radiusBadge, {borderColor: '#A7F3D0', backgroundColor: '#F0FDF4'}]}>
            <Text style={[s.radiusBadgeTxt, {color: '#10B981'}]}>{radius < 1 ? `${(radius*1000).toFixed(0)} m` : `${radius.toFixed(1)} km`}</Text>
          </View>
        </View>
      </View>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      {(() => {
          const mapContent = location ? (
              <View style={{ flex: 1 }}>
                <LeafletMap
                  style={{ flex: 1 }}
                  latitude={location.latitude}
                  longitude={location.longitude}
                  zoom={Math.max(8, Math.round(14 - Math.log2(Math.max(1, radius))))}
                  markers={filtered}
                  radiusKm={radius}
                  satellite={mapType === 'satellite'}
                  onMarkerPress={(id) => {
                    const f = needs.find(it => String(it._id) === String(id));
                    if (f) setSelectedMarker(f);
                  }}
                />
                {/* Map controls */}
                <View style={s.mapControls}>
                  {isFullScreen && (
                      <TouchableOpacity style={s.mapCtlBtn} onPress={() => setIsFullScreen(false)}>
                        <Ionicons name="close" size={20} color="#EF4444" />
                      </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.mapCtlBtn}
                    onPress={() => setMapType(t => t === 'standard' ? 'satellite' : 'standard')}>
                    <Ionicons name={mapType === 'standard' ? 'layers-outline' : 'map-outline'} size={20} color="#1E293B" />
                  </TouchableOpacity>
                  {!isFullScreen && (
                      <TouchableOpacity style={s.mapCtlBtn} onPress={() => setIsFullScreen(true)}>
                        <Ionicons name="expand" size={20} color="#1E293B" />
                      </TouchableOpacity>
                  )}
                </View>
                {/* Selected marker popup */}
                {selectedMarker && (
                  <View style={[s.popup, isFullScreen && { bottom: 40 }]}>
                    <View style={[s.popupImg, {backgroundColor: catColor(selectedMarker.category) + '20', justifyContent:'center', alignItems:'center'}]}>
                         <Ionicons name={catIcon(selectedMarker.category)} size={30} color={catColor(selectedMarker.category)} />
                    </View>
                    <View style={s.popupInfo}>
                      <Text style={s.popupTitle} numberOfLines={1}>{selectedMarker.title}</Text>
                      <Text style={s.popupDonor} numberOfLines={1}>{selectedMarker.requester?.fullName || 'Anonymous'}</Text>
                      <Text style={s.popupDist}>
                        {haversine(location, selectedMarker.location) ?? '--'} km away
                      </Text>
                    </View>
                    <View style={s.popupActions}>
                      <TouchableOpacity style={[s.popActBtn,{backgroundColor:'#3B82F6'}]}
                        onPress={() => {
                            if (isFullScreen) setIsFullScreen(false);
                            navigate(selectedMarker);
                        }}>
                        <Ionicons name="navigate" size={15} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.popActBtn,{backgroundColor:'#25D366', marginTop:6}]}
                        onPress={() => openWhatsApp(selectedMarker.requester?.mobileNumber, selectedMarker.title)}>
                        <MaterialCommunityIcons name="whatsapp" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={s.popupClose} onPress={() => setSelectedMarker(null)}>
                      <Ionicons name="close-circle" size={22} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
          ) : (
            <View style={s.mapLoading}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={s.mapLoadingTxt}>Locating you…</Text>
            </View>
          );

          if (isFullScreen) {
              return (
                  <Modal visible={true} animationType="fade" onRequestClose={() => setIsFullScreen(false)}>
                      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
                          {mapContent}
                      </View>
                  </Modal>
              );
          }

          return (
              <Animated.View style={[s.mapCard, { height: mapHeight }]}>
                  {mapContent}
              </Animated.View>
          );
      })()}

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
            {loading ? 'Loading…' : `${filtered.length} need${filtered.length !== 1 ? 's' : ''} found`}
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
                await fetchNeeds(location, radius);
                setRefreshing(false);
              }}
              colors={['#10B981']}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={s.emptyWrap}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={s.emptyTxt}>Finding nearby needs…</Text>
              </View>
            ) : (
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Ionicons name="hand-right-outline" size={44} color="#CBD5E1" />
                </View>
                <Text style={s.emptyHead}>No requests found</Text>
                <Text style={s.emptyTxt}>Be the first to post a need or check another area.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <NeedCard
              item={item}
              location={location}
              onCall={() => callPhone(item.requester?.mobileNumber)}
              onWhatsApp={() => openWhatsApp(item.requester?.mobileNumber, item.title)}
              onNavigate={() => navigate(item)}
              onOffer={Object.assign((id) => handleOffer(id), {userId: user?._id})}
            />
          )}
        />
      </View>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.donateBtn} onPress={() => setPostModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          <Text style={s.donateBtnTxt}>Post a Need Request</Text>
        </TouchableOpacity>
      </View>

      {/* Post Need Modal */}
      <Modal visible={postModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPostModalVisible(false)}>
         <KeyboardAvoidingView style={{flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.4)'}} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={s.modalContent}>
                <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>Post a Need</Text>
                    <TouchableOpacity onPress={() => setPostModalVisible(false)}>
                        <Ionicons name="close-circle" size={28} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingVertical: 10}}>
                    <Text style={s.inputLabel}>What do you need?</Text>
                    <TextInput style={s.modalInput} placeholder="e.g. Winter Jacket, Textbooks" value={postTitle} onChangeText={setPostTitle} />

                    <View style={{flexDirection:'row', gap: 10}}>
                        <View style={{flex:1}}>
                            <Text style={s.inputLabel}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                                {CATEGORIES.filter(c=>c!=='All').map(c => (
                                    <TouchableOpacity 
                                        key={c} 
                                        style={[s.catSelectBtn, postCategory === c && {backgroundColor: catColor(c), borderColor: catColor(c)}]} 
                                        onPress={() => setPostCategory(c)}
                                    >
                                        <Text style={[s.catSelectTxt, postCategory === c && {color: '#FFF'}]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    <Text style={s.inputLabel}>Quantity</Text>
                    <TextInput style={s.modalInput} placeholder="e.g. 2 pieces, 1 kg" value={postQuantity} onChangeText={setPostQuantity} />

                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 5}}>
                        <Text style={s.inputLabel}>Description</Text>
                        <TouchableOpacity style={s.aiBtn} onPress={generateAI} disabled={generatingDesc}>
                            {generatingDesc ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialCommunityIcons name="magic-staff" size={16} color="#FFF" />}
                            <Text style={s.aiBtnTxt}>Use AI</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput 
                        style={[s.modalInput, {height: 80, textAlignVertical: 'top'}]} 
                        placeholder="Why do you need this? AI can help write this for you." 
                        multiline 
                        value={postDesc} 
                        onChangeText={setPostDesc} 
                    />

                    <Text style={s.modalNote}>* Your profile location will be used to show this request to nearby users.</Text>

                    <TouchableOpacity style={[s.submitBtn, isSubmitting && {backgroundColor: '#94A3B8'}]} onPress={submitNeed} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ActivityIndicator color="#FFF" size="small" />
                                <Text style={[s.submitBtnTxt, {marginLeft: 8}]}>AI is Analyzing...</Text>
                            </View>
                        ) : (
                            <Text style={s.submitBtnTxt}>Broadcast Need</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
         </KeyboardAvoidingView>
      </Modal>

      {/* AI Moderation Rejection Modal */}
      <Modal
          animationType="fade"
          transparent={true}
          visible={rejectionModalVisible}
          onRequestClose={() => setRejectionModalVisible(false)}
      >
          <View style={s.modalOverlay}>
              <View style={s.rejectionModalContent}>
                  <View style={s.rejectionIconContainer}>
                      <MaterialCommunityIcons name="shield-alert-outline" size={50} color="#FFF" />
                  </View>
                  <Text style={s.rejectionTitle}>Request Flagged</Text>
                  <Text style={s.rejectionMessage}>
                      {rejectionReason}
                  </Text>
                  <View style={s.rejectionTipContainer}>
                      <Ionicons name="information-circle" size={20} color="#64748B" />
                      <Text style={s.rejectionTipText}>
                          Ensure your request does not contain inappropriate language, prohibited items, or spam.
                      </Text>
                  </View>
                  <TouchableOpacity 
                      style={s.rejectionBtn}
                      onPress={() => setRejectionModalVisible(false)}
                  >
                      <Text style={s.rejectionBtnText}>Got it, I'll rewrite</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── card styles ──────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  info: { flex: 1, marginRight: 10 },
  title: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  donor: { fontSize: 13, color: '#475569', fontWeight: '600' },
  desc: { fontSize: 13, color: '#64748B', marginTop: 8, marginBottom: 12, lineHeight: 18 },
  catBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1
  },
  catTxt: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  distChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10
  },
  distTxt: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row' },
  btn: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  offerBtn: { backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, shadowColor: '#10B981', shadowOffset: {width:0, height:2}, shadowOpacity:0.3, shadowRadius:4, elevation: 3 },
  offerBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 13 }
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
    borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0',
  },
  mapToggleTxt: { fontSize: 12, fontWeight: '800', marginLeft: 4 },

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
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1,
  },
  radiusBadgeTxt: { fontSize: 12, fontWeight: '800' },

  // Map
  mapCard: {
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  mapControls: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  mapCtlBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, marginBottom: 6
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
  popupImg: { width: 58, height: 58, borderRadius: 12, marginRight: 10 },
  popupInfo: { flex: 1 },
  popupTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  popupDonor: { fontSize: 12, color: '#64748B', marginVertical: 1 },
  popupDist: { fontSize: 11, color: '#E91E63', fontWeight: '700' },
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
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
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

  // Modal
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', marginBottom: 10 },
  catSelectBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8, backgroundColor: '#F8FAFC' },
  catSelectTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  aiBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  modalNote: { fontSize: 12, color: '#94A3B8', marginTop: 10, marginBottom: 20, fontStyle: 'italic' },
  submitBtn: { backgroundColor: '#10B981', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:6, elevation:4 },
  submitBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  // Moderation Rejection Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  rejectionModalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 28, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  rejectionIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 4, borderColor: '#FEF2F2' },
  rejectionTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 12 },
  rejectionMessage: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  rejectionTipContainer: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  rejectionTipText: { flex: 1, fontSize: 13, color: '#64748B', marginLeft: 12, lineHeight: 18 },
  rejectionBtn: { backgroundColor: '#1E293B', width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  rejectionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});
