import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserHistory } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

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

const HistoryScreen = ({ route, navigation }) => {
  const { initialFilter, initialTab } = route.params || {};
  const [mainTab, setMainTab] = useState(initialTab || 'donations'); // 'donations' or 'needs'
  const [subTab, setSubTab] = useState('received'); // 'received' or 'sent'
  const [statusFilter, setStatusFilter] = useState(initialFilter || 'All'); // 'All', 'Approved', 'Pending', 'Rejected'
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return;
      const currentUser = JSON.parse(userStr);
      setUser(currentUser);

      const res = await getUserHistory(currentUser._id);
      if (res && res.success) {
        setDonations(res.data.donated || []);
        setRequests(res.data.received || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusDetails = (item) => {
    const s = item.status ? item.status.toLowerCase() : 'pending';
    const mod = item.moderationResult || {};

    switch (s) {
      case 'completed':
      case 'accepted':
      case 'fulfilled':
        return { label: 'Completed', color: '#10B981', bg: '#D1FAE5', icon: 'check-circle' };
      
      case 'approved':
      case 'available':
        if (mod.reviewedBy) return { label: 'Admin Approved', color: '#10B981', bg: '#D1FAE5', icon: 'shield-check' };
        if (mod.aiVerdict === 'safe') return { label: 'AI Approved', color: '#10B981', bg: '#D1FAE5', icon: 'robot' };
        return { label: 'Approved', color: '#10B981', bg: '#D1FAE5', icon: 'check-circle' };

      case 'rejected':
      case 'cancelled':
        if (mod.reviewedBy) return { label: 'Admin Rejected', color: '#EF4444', bg: '#FEE2E2', icon: 'shield-alert' };
        if (mod.aiVerdict === 'unsafe') return { label: 'AI Rejected', color: '#EF4444', bg: '#FEE2E2', icon: 'robot-dead' };
        return { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' };

      case 'under_review':
      case 'pending':
        if (mod.status === 'under_review') return { label: 'Admin Reviewing', color: '#F59E0B', bg: '#FEF3C7', icon: 'shield-search' };
        return { label: 'Pending AI', color: '#F59E0B', bg: '#FEF3C7', icon: 'robot-outline' };

      default:
        return { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: 'clock-outline' };
    }
  };

  const getFilteredData = () => {
    let baseData = [];
    if (mainTab === 'donations') {
        baseData = subTab === 'received' 
            ? requests.filter(i => i.itemType === 'donation')
            : donations.filter(i => i.itemType === 'donation');
    } else {
        baseData = subTab === 'received' 
            ? requests.filter(i => i.itemType === 'need')
            : donations.filter(i => i.itemType === 'need');
    }

    if (statusFilter === 'All') return baseData;
    
    return baseData.filter(item => {
      const s = (item.status || 'pending').toLowerCase();
      if (statusFilter === 'Approved') return ['approved', 'available', 'completed', 'accepted', 'fulfilled'].includes(s);
      if (statusFilter === 'Pending') return ['pending', 'under_review'].includes(s);
      if (statusFilter === 'Rejected') return ['rejected', 'cancelled'].includes(s);
      return true;
    });
  };

  const renderItem = ({ item }) => {
    const status = getStatusDetails(item);
    const isDonation = mainTab === 'donations';
    
    return (
      <View style={styles.historyCard}>
        <View style={[styles.cardHighlight, { backgroundColor: status.color }]} />
        <View style={styles.cardInner}>
          {item.itemType === 'need' ? (
              <View style={[styles.itemImage, {justifyContent:'center', alignItems:'center', backgroundColor: catColor(item.category) + '15'}]}>
                  <Ionicons name={catIcon(item.category)} size={28} color={catColor(item.category)} />
              </View>
          ) : (
              <Image 
                source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
                style={styles.itemImage} 
              />
          )}
          <View style={styles.itemDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg, flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialCommunityIcons name={status.icon} size={12} color={status.color} style={{ marginRight: 4 }} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            
            <Text style={styles.itemCategory}>{item.category || (item.itemType === 'donation' ? 'Donation' : 'Need Request')}</Text>
            
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.detailsBtn}
          onPress={() => item.itemType === 'donation' ? navigation.navigate('DonationDetail', { item }) : null}
        >
          <Text style={styles.detailsBtnText}>View Details</Text>
          <Feather name="chevron-right" size={16} color="#4B8BF5" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity History</Text>
        <View style={{ width: 44 }} /> 
      </View>

      <View style={styles.mainTabBar}>
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'donations' && styles.activeMainTab]}
          onPress={() => { setMainTab('donations'); setSubTab('received'); }}
        >
          <MaterialCommunityIcons 
            name="gift-outline" 
            size={20} 
            color={mainTab === 'donations' ? '#10B981' : '#94A3B8'} 
          />
          <Text style={[styles.mainTabText, mainTab === 'donations' && styles.activeMainTabText]}>
            Donations
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'needs' && styles.activeMainTabNeeds]}
          onPress={() => { setMainTab('needs'); setSubTab('received'); }}
        >
          <MaterialCommunityIcons 
            name="hand-heart" 
            size={20} 
            color={mainTab === 'needs' ? '#10B981' : '#94A3B8'} 
          />
          <Text style={[styles.mainTabText, mainTab === 'needs' && styles.activeMainTabTextNeeds]}>
            Need Requests
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subTabBar}>
        <TouchableOpacity 
          style={[styles.subTab, subTab === 'received' && styles.activeSubTab]}
          onPress={() => setSubTab('received')}
        >
          <Text style={[styles.subTabText, subTab === 'received' && (mainTab === 'needs' ? {color: '#10B981'} : styles.activeSubTabText)]}>
            Received
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.subTab, subTab === 'sent' && styles.activeSubTab]}
          onPress={() => setSubTab('sent')}
        >
          <Text style={[styles.subTabText, subTab === 'sent' && (mainTab === 'needs' ? {color: '#10B981'} : styles.activeSubTabText)]}>
            Sent
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsSummary}>
          <View style={styles.statBox}>
              <Text style={styles.statVal}>{donations.length}</Text>
              <Text style={styles.statLab}>Donations</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
              <Text style={styles.statVal}>{requests.length}</Text>
              <Text style={styles.statLab}>Requests</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
              <Text style={[styles.statVal, {color: '#F59E0B'}]}>{donations.length * 50}</Text>
              <Text style={styles.statLab}>Points</Text>
          </View>
      </View>

      <View style={styles.filterContainer}>
        {['All', 'Approved', 'Pending', 'Rejected'].map(filter => (
          <TouchableOpacity 
            key={filter} 
            style={[styles.filterChip, statusFilter === filter && (mainTab === 'needs' ? {backgroundColor: '#10B981', borderColor: '#10B981'} : styles.activeFilterChip)]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text style={[styles.filterChipText, statusFilter === filter && styles.activeFilterChipText]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={getFilteredData()}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons 
                    name={mainTab === 'donations' ? 'gift-outline' : 'hand-heart-outline'} 
                    size={48} 
                    color="#CBD5E1" 
                />
              </View>
              <Text style={styles.emptyTitle}>Currently Empty</Text>
              <Text style={styles.emptySub}>
                {mainTab === 'donations' 
                    ? "You haven't made any donation activity in this category." 
                    : "You haven't made any need requests here."}
              </Text>
              <TouchableOpacity 
                style={[styles.actionBtn, mainTab === 'needs' && {backgroundColor: '#10B981', shadowColor: '#10B981'}]}
                onPress={() => navigation.navigate(mainTab === 'donations' ? 'DonateForm' : 'NeedRequest')}
              >
                <Text style={styles.actionBtnText}>
                    {mainTab === 'donations' ? 'Donate Now' : 'Post a Need'}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: '#FFF',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  mainTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeMainTab: {
    backgroundColor: '#F0FDFA',
  },
  activeMainTabNeeds: {
    backgroundColor: '#F0FDF4',
  },
  mainTabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeMainTabText: {
    color: '#10B981',
  },
  activeMainTabTextNeeds: {
    color: '#10B981',
  },
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 5,
  },
  subTab: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  activeSubTab: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  activeSubTabText: {
    color: '#10B981',
  },
  statsSummary: {
      flexDirection: 'row',
      backgroundColor: '#FFF',
      margin: 20,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
  },
  statBox: {
      flex: 1,
      alignItems: 'center',
  },
  statVal: {
      fontSize: 22,
      fontWeight: '900',
      color: '#10B981',
  },
  statLab: {
      fontSize: 12,
      color: '#64748B',
      fontWeight: '600',
      marginTop: 4,
  },
  statDivider: {
      width: 1,
      backgroundColor: '#F1F5F9',
      height: '80%',
      alignSelf: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    justifyContent: 'space-between',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterChip: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeFilterChipText: {
    color: '#FFF',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  historyCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    overflow: 'hidden',
  },
  cardHighlight: {
      height: 4,
      backgroundColor: '#10B981',
      width: '100%',
  },
  cardInner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemCategory: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
    fontWeight: '500',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B8BF5',
    marginRight: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  actionBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default HistoryScreen;
