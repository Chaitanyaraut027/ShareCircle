import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  TextInput,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../utils/constants';
import CustomToast from '../components/CustomToast';


const { width } = Dimensions.get('window');

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

const RequestsScreen = () => {
  const [mainTab, setMainTab] = useState('donations'); // 'donations' or 'needs'
  const [activeTab, setActiveTab] = useState('received'); // 'received' or 'sent'
  const [receivedDonations, setReceivedDonations] = useState([]);
  const [sentDonations, setSentDonations] = useState([]);
  const [receivedNeeds, setReceivedNeeds] = useState([]);
  const [sentNeeds, setSentNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted'
  const [user, setUser] = useState(null);

  // Toast setup
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return;
      const currentUser = JSON.parse(userStr);
      setUser(currentUser);

      let endpointDonationsRec, endpointDonationsSent, endpointNeedsRec, endpointNeedsSent;
      
      endpointDonationsRec = `${API_URL}/donations/received-requests/${currentUser._id}`;
      endpointDonationsSent = `${API_URL}/donations/sent-requests/${currentUser._id}`;
      endpointNeedsRec = `${API_URL}/requests/my/${currentUser._id}`;
      endpointNeedsSent = `${API_URL}/requests/offers/${currentUser._id}`;

      const [resDonRec, resDonSent, resNeedsRec, resNeedsSent] = await Promise.all([
          axios.get(endpointDonationsRec),
          axios.get(endpointDonationsSent),
          axios.get(endpointNeedsRec),
          axios.get(endpointNeedsSent)
      ]);

      if (resDonRec.data.success) {
          setReceivedDonations(resDonRec.data.data.map(d => ({...d, itemType: 'donation'})).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
      if (resDonSent.data.success) {
          setSentDonations(resDonSent.data.data.map(d => ({...d, itemType: 'donation'})).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
      if (resNeedsRec.data.success && resNeedsSent.data.success) {
          const myNeeds = resNeedsRec.data.data.map(n => ({...n, itemType: 'need'}));
          const myOffers = resNeedsSent.data.data.map(n => ({...n, itemType: 'need', isMyOffer: true}));

          // Received Needs: My Needs that have at least one offer
          const rNeeds = myNeeds.filter(n => n.offers && n.offers.length > 0);
          
          // Sent Needs: My Needs without offers + Offers I made to others
          const sNeeds = [
              ...myNeeds.filter(n => !n.offers || n.offers.length === 0),
              ...myOffers
          ];

          setReceivedNeeds(rNeeds.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
          setSentNeeds(sNeeds.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredData = useMemo(() => {
    let baseData = [];
    if (mainTab === 'donations') {
        baseData = activeTab === 'received' ? receivedDonations : sentDonations;
    } else {
        baseData = activeTab === 'received' ? receivedNeeds : sentNeeds;
    }
    
    return baseData.filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (statusFilter !== 'all') {
        if (activeTab === 'received') {
          if(item.itemType === 'donation') {
              matchesFilter = item.requests && item.requests.some(r => r.status === statusFilter);
          } else {
              matchesFilter = item.offers && item.offers.some(o => o.status === statusFilter);
          }
        } else {
          if(item.itemType === 'donation') {
              matchesFilter = item.myRequestStatus === statusFilter;
          } else {
              // For Needs in "Sent" tab:
              // If it's my offer to someone else, check myOfferStatus
              // If it's my own need waiting for offers, check item.status
              const stat = item.isMyOffer ? item.myOfferStatus : item.status;
              matchesFilter = stat === statusFilter;
          }
        }
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [receivedDonations, sentDonations, receivedNeeds, sentNeeds, mainTab, activeTab, searchQuery, statusFilter]);

  const handleAccept = async (itemId, requesterId, requesterName, type = 'donation') => {
    Alert.alert(
      "Accept Request",
      type === 'donation' 
         ? `Are you sure you want to give this item to ${requesterName}? This will close the donation.`
         : `Are you sure you want to accept ${requesterName}'s offer to fulfill your need?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Accept", 
          onPress: async () => {
            try {
              const url = type === 'donation' 
                 ? `${API_URL}/donations/${itemId}/accept` 
                 : `${API_URL}/requests/${itemId}/accept-offer`;
              const payload = type === 'donation' ? { requesterId } : { offerUserId: requesterId };
              
              const res = await axios.post(url, payload);
              if (res.data.success) {
                showToast("Request accepted! ✅");
                fetchData();
              }
            } catch (error) {
              showToast("Failed to accept request.", "error");
            }
          }
        }
      ]
    );
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#64748B';
    }
  };

  const renderReceivedItem = ({ item }) => {
    const isNeed = item.itemType === 'need';
    const cardBorderColor = isNeed ? '#BBF7D0' : '#F1F5F9';
    const cardBgColor = isNeed ? '#F0FDF4' : '#FFF';
    
    return (
    <View style={[styles.card, {borderColor: cardBorderColor, borderWidth: 1, backgroundColor: cardBgColor}]}>
      <View style={[styles.cardHeader, {backgroundColor: isNeed ? '#F0FDF4' : '#F8FAFC'}]}>
          {isNeed ? (
               <View style={[styles.itemThumb, {justifyContent:'center', alignItems:'center', backgroundColor: catColor(item.category) + '15'}]}>
                   <Ionicons name={catIcon(item.category)} size={24} color={catColor(item.category)} />
               </View>
          ) : (
             <Image source={{ uri: item.image || 'https://via.placeholder.com/50' }} style={styles.itemThumb} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemCategory}>{isNeed ? 'Need Request' : item.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' || item.status === 'fulfilled' ? '#D1FAE5' : (isNeed ? '#D1FAE5' : '#FEF3C7') }]}>
            <Text style={[styles.statusText, { color: item.status === 'completed' || item.status === 'fulfilled' ? '#059669' : (isNeed ? '#10B981' : '#D97706') }]}>
                {item.status === 'completed' || item.status === 'fulfilled' ? 'Fulfilled' : 'Active'}
            </Text>
        </View>
      </View>

      {(isNeed ? item.offers : item.requests)?.map((req, idx) => {
        const person = isNeed ? req.user : req.requester;
        if (!person) return null;

        return (
          <View key={person._id} style={[styles.personRow, idx !== 0 && styles.borderTop]}>
            <View style={styles.personBasic}>
              <Image 
                source={{ uri: person.profilePic || `https://ui-avatars.com/api/?name=${person.fullName}&background=random` }} 
                style={styles.avatar} 
              />
              <View style={styles.personText}>
                <Text style={styles.personName}>{person.fullName}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: getStatusColor(req.status) }]} />
                  <Text style={[styles.rowStatusText, { color: getStatusColor(req.status) }]}>{req.status}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.commGroup}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${person.mobileNumber}`)}>
                  <Ionicons name="call" color="#3B82F6" size={18} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`https://wa.me/${formatPhone(person.mobileNumber)}`)}>
                  <MaterialCommunityIcons name="whatsapp" color="#10B981" size={20} />
                </TouchableOpacity>
                {person.location?.coordinates && (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${person.location.coordinates[1]},${person.location.coordinates[0]}`)}>
                    <Ionicons name="navigate" color="#8B5CF6" size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {req.status === 'pending' && item.status !== 'completed' && item.status !== 'fulfilled' && (
                <TouchableOpacity style={[styles.acceptPill, isNeed && {backgroundColor: '#10B981'}]} onPress={() => handleAccept(item._id, person._id, person.fullName, item.itemType)}>
                  <Text style={styles.acceptPillText}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
    );
  };

  const renderSentItem = ({ item }) => {
    const isNeed = item.itemType === 'need';
    // If it's my own need without offers, I am the requester, and there is no other person to show yet.
    // If it's my offer to someone else, the other person is the requester.
    // If it's a donation I requested, the other person is the donor.
    const isMyNeedWaiting = isNeed && !item.isMyOffer;
    const person = isNeed ? (isMyNeedWaiting ? null : item.requester) : item.donor;
    
    const cardBorderColor = isNeed ? '#BBF7D0' : '#F1F5F9';
    const cardBgColor = isNeed ? '#F0FDF4' : '#FFF';
    const status = isNeed ? (isMyNeedWaiting ? item.status : item.myOfferStatus) : item.myRequestStatus;

    return (
      <View style={[styles.card, {borderColor: cardBorderColor, borderWidth: 1, backgroundColor: cardBgColor}]}>
        <View style={[styles.cardHeader, {backgroundColor: isNeed ? '#F0FDF4' : '#F8FAFC'}]}>
          {isNeed ? (
               <View style={[styles.itemThumb, {justifyContent:'center', alignItems:'center', backgroundColor: catColor(item.category) + '15'}]}>
                   <Ionicons name={catIcon(item.category)} size={24} color={catColor(item.category)} />
               </View>
          ) : (
               <Image source={{ uri: item.image || 'https://via.placeholder.com/50' }} style={styles.itemThumb} />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[styles.rowStatusText, { color: getStatusColor(status) }]}>
                    {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}
                </Text>
            </View>
          </View>
        </View>

        {isMyNeedWaiting ? (
            <View style={[styles.personRow, {justifyContent: 'center', alignItems: 'center', paddingVertical: 20}]}>
                <MaterialCommunityIcons name="clock-outline" size={30} color="#94A3B8" style={{marginBottom: 8}} />
                <Text style={{fontSize: 14, fontWeight: '600', color: '#64748B'}}>Waiting for offers from donors</Text>
            </View>
        ) : person && (
            <View style={styles.personRow}>
              <Text style={styles.sectionLabel}>{isNeed ? 'Needful Person' : 'Donor Details'}</Text>
              <View style={styles.personBasic}>
                <Image 
                  source={{ uri: person.profilePic || `https://ui-avatars.com/api/?name=${person.fullName}&background=random` }} 
                  style={styles.avatar} 
                />
                <View style={styles.personText}>
                  <Text style={styles.personName}>{person.fullName}</Text>
                  <Text style={styles.personSub}>{item.pickupAddress || 'Address hidden until accepted'}</Text>
                </View>
              </View>

              <View style={styles.fullActionRow}>
                 <TouchableOpacity style={[styles.fullActionBtn, { backgroundColor: '#E0F2FE' }]} onPress={() => Linking.openURL(`tel:${person.mobileNumber}`)}>
                   <Ionicons name="call" color="#0369A1" size={20} style={{marginRight: 8}} />
                   <Text style={[styles.fullActionText, {color: '#0369A1'}]}>Call</Text>
                 </TouchableOpacity>

                 <TouchableOpacity style={[styles.fullActionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => Linking.openURL(`https://wa.me/${formatPhone(person.mobileNumber)}`)}>
                   <MaterialCommunityIcons name="whatsapp" color="#15803D" size={22} style={{marginRight: 8}} />
                   <Text style={[styles.fullActionText, {color: '#15803D'}]}>WhatsApp</Text>
                 </TouchableOpacity>
              </View>
              
              {item.location?.coordinates && (
                <TouchableOpacity style={styles.navigateWide} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.location.coordinates[1]},${item.location.coordinates[0]}`)}>
                  <Ionicons name="navigate-outline" color="#64748B" size={18} style={{marginRight: 8}} />
                  <Text style={styles.navigateWideText}>Open Navigation in Google Maps</Text>
                </TouchableOpacity>
              )}
            </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
      {/* Search & Tabs Header */}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.topHeader}>
          <Text style={styles.mainTitle}>Requests Tracker</Text>
          
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color="#94A3B8" style={{marginLeft: 12}} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={[styles.mainTabBar, {marginBottom: 10}]}>
            <TouchableOpacity 
              style={[styles.mainTab, mainTab === 'donations' && styles.activeMainTab]}
              onPress={() => { setMainTab('donations'); setActiveTab('received'); }}
            >
              <Text style={[styles.mainTabText, mainTab === 'donations' && styles.activeMainTabText]}>Donations</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.mainTab, mainTab === 'needs' && styles.activeMainTabNeeds]}
              onPress={() => { setMainTab('needs'); setActiveTab('received'); }}
            >
              <Text style={[styles.mainTabText, mainTab === 'needs' && styles.activeMainTabTextNeeds]}>Need Requests</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'received' && styles.activeTab]}
              onPress={() => setActiveTab('received')}
            >
              <Text style={[styles.tabText, activeTab === 'received' && (mainTab === 'needs' ? {color: '#10B981'} : styles.activeTabText)]}>Received</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
              onPress={() => setActiveTab('sent')}
            >
              <Text style={[styles.tabText, activeTab === 'sent' && (mainTab === 'needs' ? {color: '#10B981'} : styles.activeTabText)]}>Sent</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterBar}>
            {['all', 'pending', 'accepted'].map(f => (
              <TouchableOpacity 
                key={f}
                style={[styles.filterPill, statusFilter === f && (mainTab === 'needs' ? {backgroundColor: '#10B981'} : styles.activeFilterPill)]}
                onPress={() => setStatusFilter(f)}
              >
                <Text style={[styles.filterText, statusFilter === f && styles.activeFilterText]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>


      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item._id}
          renderItem={activeTab === 'received' ? renderReceivedItem : renderSentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name={activeTab === 'received' ? 'download-outline' : 'send-outline'} size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No requests found</Text>
              <Text style={styles.emptySub}>Try changing your search or filter</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: { backgroundColor: '#FFF', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mainTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', paddingHorizontal: 20, paddingTop: 10, marginBottom: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', marginHorizontal: 20, borderRadius: 12, height: 45, marginBottom: 15 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15, color: '#1E293B' },
  mainTabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
  mainTab: { flex: 1, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  activeMainTab: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 2 },
  activeMainTabNeeds: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 2 },
  mainTabText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  activeMainTabText: { color: '#FFF' },
  activeMainTabTextNeeds: { color: '#FFF' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 12 },
  tab: { flex: 1, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#10B981' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 5 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 10, backgroundColor: '#F1F5F9' },
  activeFilterPill: { backgroundColor: '#10B981' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  activeFilterText: { color: '#FFF' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#E2E8F0' },
  headerInfo: { marginLeft: 12, flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  itemCategory: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '800' },
  personRow: { padding: 16 },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  personBasic: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9' },
  personText: { marginLeft: 12, flex: 1 },
  personName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  personSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  rowStatusText: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commGroup: { flexDirection: 'row' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  acceptPill: { backgroundColor: '#10B981', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
  acceptPillText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  fullActionRow: { flexDirection: 'row', marginBottom: 12 },
  fullActionBtn: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  fullActionText: { fontSize: 13, fontWeight: '700' },
  navigateWide: { height: 44, borderRadius: 12, borderHorizontal: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  navigateWideText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#475569' },
  emptySub: { fontSize: 14, color: '#94A3B8', marginTop: 5 }
});

export default RequestsScreen;
