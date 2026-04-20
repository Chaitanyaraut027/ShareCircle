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

const RequestsScreen = () => {
  const [activeTab, setActiveTab] = useState('received'); // 'received' or 'sent'
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
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

      const endpoint = activeTab === 'received' 
        ? `${API_URL}/donations/received-requests/${currentUser._id}`
        : `${API_URL}/donations/sent-requests/${currentUser._id}`;

      const res = await axios.get(endpoint);
      if (res.data.success) {
        if (activeTab === 'received') {
          setReceivedRequests(res.data.data);
        } else {
          setSentRequests(res.data.data);
        }
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
    const baseData = activeTab === 'received' ? receivedRequests : sentRequests;
    
    return baseData.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (statusFilter !== 'all') {
        if (activeTab === 'received') {
          // For received, we check if ANY request in the array matches the filter or if donation itself matches
          // Simplification: check if any request has the filtered status
          matchesFilter = item.requests.some(r => r.status === statusFilter);
        } else {
          matchesFilter = item.myRequestStatus === statusFilter;
        }
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [receivedRequests, sentRequests, activeTab, searchQuery, statusFilter]);

  const handleAccept = async (donationId, requesterId, requesterName) => {
    Alert.alert(
      "Accept Request",
      `Are you sure you want to give this item to ${requesterName}? This will close the donation.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Accept", 
          onPress: async () => {
            try {
              const res = await axios.post(`${API_URL}/donations/${donationId}/accept`, { requesterId });
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

  const renderReceivedItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.image }} style={styles.itemThumb} />
        <View style={styles.headerInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemCategory}>{item.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? '#D1FAE5' : '#FEF3C7' }]}>
            <Text style={[styles.statusText, { color: item.status === 'completed' ? '#059669' : '#D97706' }]}>
                {item.status === 'completed' ? 'Fulfilled' : 'Active'}
            </Text>
        </View>
      </View>

      {item.requests.map((req, idx) => {
        const person = req.requester;
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

              {req.status === 'pending' && item.status !== 'completed' && (
                <TouchableOpacity style={styles.acceptPill} onPress={() => handleAccept(item._id, person._id, person.fullName)}>
                  <Text style={styles.acceptPillText}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderSentItem = ({ item }) => {
    const donor = item.donor;
    if (!donor) return null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: item.image }} style={styles.itemThumb} />
          <View style={styles.headerInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: getStatusColor(item.myRequestStatus) }]} />
                <Text style={[styles.rowStatusText, { color: getStatusColor(item.myRequestStatus) }]}>
                    {item.myRequestStatus.charAt(0).toUpperCase() + item.myRequestStatus.slice(1)}
                </Text>
            </View>
          </View>
        </View>

        <View style={styles.personRow}>
          <Text style={styles.sectionLabel}>Donor Details</Text>
          <View style={styles.personBasic}>
            <Image 
              source={{ uri: donor.profilePic || `https://ui-avatars.com/api/?name=${donor.fullName}&background=random` }} 
              style={styles.avatar} 
            />
            <View style={styles.personText}>
              <Text style={styles.personName}>{donor.fullName}</Text>
              <Text style={styles.personSub}>{item.pickupAddress || 'Address not provided'}</Text>
            </View>
          </View>

          <View style={styles.fullActionRow}>
             <TouchableOpacity style={[styles.fullActionBtn, { backgroundColor: '#E0F2FE' }]} onPress={() => Linking.openURL(`tel:${donor.mobileNumber}`)}>
               <Ionicons name="call" color="#0369A1" size={20} style={{marginRight: 8}} />
               <Text style={[styles.fullActionText, {color: '#0369A1'}]}>Call Donor</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.fullActionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => Linking.openURL(`https://wa.me/${formatPhone(donor.mobileNumber)}`)}>
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

          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'received' && styles.activeTab]}
              onPress={() => setActiveTab('received')}
            >
              <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>Received</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
              onPress={() => setActiveTab('sent')}
            >
              <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>Sent</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterBar}>
            {['all', 'pending', 'accepted'].map(f => (
              <TouchableOpacity 
                key={f}
                style={[styles.filterPill, statusFilter === f && styles.activeFilterPill]}
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
