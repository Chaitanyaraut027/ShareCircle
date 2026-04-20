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

const HistoryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('donations'); // 'donations' or 'requests'
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

  const getStatusDetails = (status) => {
    const s = status ? status.toLowerCase() : 'pending';
    switch (s) {
      case 'completed':
      case 'accepted':
      case 'fulfilled':
        return { label: 'Completed', color: '#10B981', bg: '#D1FAE5', icon: 'check-circle' };
      case 'rejected':
      case 'cancelled':
        return { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' };
      default:
        return { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: 'clock-outline' };
    }
  };

  const renderItem = ({ item }) => {
    const status = getStatusDetails(item.status || 'pending');
    const isDonation = activeTab === 'donations';
    
    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHighlight} />
        <View style={styles.cardInner}>
          <Image 
            source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
            style={styles.itemImage} 
          />
          <View style={styles.itemDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            
            <Text style={styles.itemCategory}>{item.category || (isDonation ? 'Donated Item' : 'Requested Item')}</Text>
            
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.detailsBtn}
          onPress={() => isDonation ? navigation.navigate('DonationDetail', { item }) : null}
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

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'donations' && styles.activeTab]}
          onPress={() => setActiveTab('donations')}
        >
          <MaterialCommunityIcons 
            name="gift-outline" 
            size={20} 
            color={activeTab === 'donations' ? '#10B981' : '#94A3B8'} 
          />
          <Text style={[styles.tabText, activeTab === 'donations' && styles.activeTabText]}>
            My Donations
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons 
            name="clipboard-outline" 
            size={20} 
            color={activeTab === 'requests' ? '#10B981' : '#94A3B8'} 
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            My Requests
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

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'donations' ? donations : requests}
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
                    name={activeTab === 'donations' ? 'gift-outline' : 'clipboard-outline'} 
                    size={48} 
                    color="#CBD5E1" 
                />
              </View>
              <Text style={styles.emptyTitle}>Currently Empty</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'donations' 
                    ? "You haven't donated any items yet." 
                    : "You haven't made any requests yet."}
              </Text>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => navigation.navigate(activeTab === 'donations' ? 'DonateForm' : 'NearMe')}
              >
                <Text style={styles.actionBtnText}>
                    {activeTab === 'donations' ? 'Donate Now' : 'Find Items'}
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#F0FDFA',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeTabText: {
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
