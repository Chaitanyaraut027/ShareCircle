import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Ionicons, 
  MaterialCommunityIcons, 
  Feather, 
  FontAwesome5 
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { 
  getAdminStats, 
  getAdminUsers, 
  getAdminDonations, 
  deleteAdminUser, 
  deleteAdminDonation 
} from '../services/api';

const { width } = Dimensions.get('window');

const AdminDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'donations'
  const [stats, setStats] = useState({ users: 0, donations: 0, pendingRequests: 0 });
  const [users, setUsers] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sRes = await getAdminStats();
      if (sRes.success) setStats(sRes.data);

      if (activeTab === 'users') {
        const uRes = await getAdminUsers();
        if (uRes.success) setUsers(uRes.data);
      } else if (activeTab === 'donations') {
        const dRes = await getAdminDonations();
        if (dRes.success) setDonations(dRes.data);
      }
    } catch (error) {
      console.error('Admin Fetch Error:', error);
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

  const handleDeleteUser = (userId, userName) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete user ${userName}? This will also delete all their donations and records from ranking.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const res = await deleteAdminUser(userId);
            if (res.success) {
              Alert.alert("Success", "User deleted successfully");
              fetchData();
            } else {
              Alert.alert("Error", "Failed to delete user");
            }
          }
        }
      ]
    );
  };

  const handleDeleteDonation = (donationId, title) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete the donation "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const res = await deleteAdminDonation(donationId);
            if (res.success) {
              Alert.alert("Success", "Donation deleted successfully");
              fetchData();
            } else {
              Alert.alert("Error", "Failed to delete donation");
            }
          }
        }
      ]
    );
  };

  const renderStatCard = (title, count, icon, color, gradient) => (
    <View style={[styles.statCard, { backgroundColor: color }]}>
       <View style={styles.statIconContainer}>
         <MaterialCommunityIcons name={icon} size={28} color="#FFF" />
       </View>
       <View>
          <Text style={styles.statCount}>{count}</Text>
          <Text style={styles.statTitle}>{title}</Text>
       </View>
    </View>
  );

  const renderUserItem = ({ item }) => (
    <View style={styles.listCard}>
       <Image 
         source={{ uri: item.profilePic || `https://ui-avatars.com/api/?name=${item.fullName}&background=random` }} 
         style={styles.avatar} 
       />
       <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.fullName}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
          <View style={styles.badgeRow}>
             <View style={styles.roleBadge}>
               <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
             </View>
             <Text style={styles.subText}>Points: {item.rewardPoints}</Text>
          </View>
       </View>
       <TouchableOpacity 
         style={styles.deleteBtn}
         onPress={() => handleDeleteUser(item._id, item.fullName)}
       >
         <Ionicons name="trash-outline" size={20} color="#EF4444" />
       </TouchableOpacity>
    </View>
  );

  const renderDonationItem = ({ item }) => (
    <View style={styles.listCard}>
       <Image 
         source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
         style={styles.itemThumb} 
       />
       <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSub}>By: {item.donor?.fullName || 'Unknown'}</Text>
          <View style={styles.statusRow}>
             <View style={[styles.dot, { backgroundColor: item.status === 'completed' ? '#10B981' : '#F59E0B' }]} />
             <Text style={styles.statusText}>{item.status}</Text>
          </View>
       </View>
       <TouchableOpacity 
         style={styles.deleteBtn}
         onPress={() => handleDeleteDonation(item._id, item.title)}
       >
         <Ionicons name="trash-outline" size={20} color="#EF4444" />
       </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#1E293B" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Admin Control Center</Text>
         <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialCommunityIcons name="shield-account" size={28} color="#2F7B5E" />
         </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
           onPress={() => setActiveTab('overview')}
         >
           <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Stats</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'users' && styles.activeTab]}
           onPress={() => setActiveTab('users')}
         >
           <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'donations' && styles.activeTab]}
           onPress={() => setActiveTab('donations')}
         >
           <Text style={[styles.tabText, activeTab === 'donations' && styles.activeTabText]}>Donations</Text>
         </TouchableOpacity>
      </View>

      {activeTab === 'overview' && (
        <ScrollView 
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2F7B5E']} />}
        >
          <Text style={styles.sectionTitle}>Global Statistics</Text>
          <View style={styles.statsGrid}>
             {renderStatCard('Total Users', stats.users, 'account-group', '#4F46E5')}
             {renderStatCard('Total Items', stats.donations, 'gift', '#10B981')}
             {renderStatCard('Requests', stats.pendingRequests, 'clock-fast', '#F59E0B')}
             {renderStatCard('Active Items', stats.donations, 'check-decagram', '#0EA5E9')}
          </View>

          <View style={styles.actionCard}>
             <View style={styles.actionIconBox}>
                <MaterialCommunityIcons name="crown" size={32} color="#F59E0B" />
             </View>
             <View style={{flex: 1, marginLeft: 16}}>
                <Text style={styles.actionTitle}>Leaderboard Management</Text>
                <Text style={styles.actionDesc}>View and audit current community rankings and impact scores.</Text>
             </View>
             <TouchableOpacity 
               style={styles.actionBtn}
               onPress={() => navigation.navigate('Leaderboard')}
             >
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
             </TouchableOpacity>
          </View>

          <View style={styles.footerNote}>
             <Ionicons name="information-circle-outline" size={16} color="#64748B" />
             <Text style={styles.footerNoteText}>Authorized access only. All actions are logged.</Text>
          </View>
        </ScrollView>
      )}

      {(activeTab === 'users' || activeTab === 'donations') && (
        <View style={styles.listContainer}>
           {loading && !refreshing ? (
             <View style={styles.centered}>
               <ActivityIndicator size="large" color="#2F7B5E" />
             </View>
           ) : (
             <FlatList
               data={activeTab === 'users' ? users : donations}
               keyExtractor={(item) => item._id}
               renderItem={activeTab === 'users' ? renderUserItem : renderDonationItem}
               contentContainerStyle={styles.listContent}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2F7B5E']} />}
               ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No {activeTab} found.</Text>
                  </View>
               }
             />
           )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    paddingHorizontal: 20, 
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tab: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginRight: 10,
    backgroundColor: '#F1F5F9'
  },
  activeTab: { backgroundColor: '#2F7B5E' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { 
    width: (width - 50) / 2, 
    padding: 20, 
    borderRadius: 24, 
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  statIconContainer: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  statCount: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  statTitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  actionCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2
  },
  actionIconBox: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  actionDesc: { fontSize: 13, color: '#64748B', marginTop: 4 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F7B5E', justifyContent: 'center', alignItems: 'center' },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 40 },
  footerNoteText: { fontSize: 12, color: '#64748B', marginLeft: 8, fontWeight: '600' },
  listContainer: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 },
  listCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F1F5F9' },
  itemThumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  cardEmail: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  cardSub: { fontSize: 12, color: '#64748B' },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  roleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  roleText: { fontSize: 10, fontWeight: '800', color: '#2F7B5E' },
  subText: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' }
});

export default AdminDashboardScreen;
