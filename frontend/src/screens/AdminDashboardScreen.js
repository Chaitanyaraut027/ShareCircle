import React, { useState, useCallback, useMemo } from 'react';
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
  Platform,
  Modal,
  TextInput,
  SafeAreaView as SafeView
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
  deleteAdminDonation,
  getReviewQueue,
  approveReviewDonation,
  rejectReviewDonation
} from '../services/api';

const { width, height } = Dimensions.get('window');

const AdminDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'donations', 'review', 'issues'
  const [stats, setStats] = useState({ users: 0, donations: 0, pendingRequests: 0, reviewQueue: 0 });
  const [users, setUsers] = useState([]);
  const [donations, setDonations] = useState([]);
  const [reviewItems, setReviewItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Modals
  const [donationFilter, setDonationFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDonation, setSelectedDonation] = useState(null);

  // Custom Action Modal for Android support
  const [actionModal, setActionModal] = useState({ visible: false, type: '', id: null, title: '' });
  const [actionNote, setActionNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sRes = await getAdminStats();
      if (sRes.success) setStats(sRes.data);

      const uRes = await getAdminUsers();
      if (uRes.success) setUsers(uRes.data);

      const dRes = await getAdminDonations();
      if (dRes.success) setDonations(dRes.data);

      const rRes = await getReviewQueue();
      if (rRes.success) setReviewItems(rRes.data);

    } catch (error) {
      console.error('Admin Fetch Error:', error);
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

  const handleDeleteUser = (userId, userName) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete user ${userName}? This will delete all their donations.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const res = await deleteAdminUser(userId);
            if (res.success) {
              Alert.alert("Success", "User deleted successfully");
              setSelectedUser(null);
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
    setActionModal({ visible: true, type: 'delete', id: donationId, title });
    setActionNote('');
  };

  const handleApprove = (donationId, title) => {
    setActionModal({ visible: true, type: 'approve', id: donationId, title });
    setActionNote('');
  };

  const handleReject = (donationId, title) => {
    setActionModal({ visible: true, type: 'reject', id: donationId, title });
    setActionNote('');
  };

  const submitActionModal = async () => {
    const { type, id } = actionModal;
    let res;
    
    if (type === 'approve') {
        res = await approveReviewDonation(id, actionNote);
    } else if (type === 'reject') {
        res = await rejectReviewDonation(id, actionNote);
    } else if (type === 'delete') {
        res = await deleteAdminDonation(id, actionNote);
    }

    if (res && res.success) {
      Alert.alert("Success", type === 'approve' ? 'Donation approved & is live!' : type === 'reject' ? 'Donation rejected.' : 'Donation deleted.');
      setActionModal({ visible: false });
      setSelectedDonation(null);
      fetchData();
    } else {
      Alert.alert("Error", `Failed to ${type} donation.`);
    }
  };

  // Derived Data
  const filteredDonations = useMemo(() => {
    if (donationFilter === 'all') return donations;
    return donations.filter(d => d.status === donationFilter);
  }, [donations, donationFilter]);

  const apiIssues = useMemo(() => {
    // Look for donations that had an AI error
    const all = [...donations, ...reviewItems];
    return all.filter(item => item.moderationResult && item.moderationResult.verdict === 'error');
  }, [donations, reviewItems]);

  const selectedUserDonations = useMemo(() => {
    if (!selectedUser) return [];
    return donations.filter(d => d.donor?._id === selectedUser._id);
  }, [selectedUser, donations]);


  // ---------------- RENDERS ---------------- //

  const renderStatCard = (title, count, icon, color) => (
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
    <TouchableOpacity style={styles.listCard} onPress={() => setSelectedUser(item)}>
       <Image source={{ uri: item.profilePic || `https://ui-avatars.com/api/?name=${item.fullName}&background=random` }} style={styles.avatar} />
       <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.fullName}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
          <View style={styles.badgeRow}>
             <View style={styles.roleBadge}><Text style={styles.roleText}>{item.role.toUpperCase()}</Text></View>
             <Text style={styles.subText}>Points: {item.rewardPoints}</Text>
          </View>
       </View>
       <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );

  const renderDonationItem = ({ item }) => {
    const catColors = { Food: '#EF4444', Clothes: '#3B82F6', Books: '#8B5CF6', Electronics: '#10B981', Medical: '#F59E0B', Toys: '#EC4899', Other: '#6B7280' };
    const catIcons = { Food: 'fast-food', Clothes: 'shirt', Books: 'book', Electronics: 'tv', Medical: 'medical', Toys: 'extension-puzzle', Other: 'grid' };
    
    return (
      <TouchableOpacity style={styles.nearbyCard} onPress={() => setSelectedDonation(item)}>
         <View style={styles.nearbyImageContainer}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/150' }} style={styles.nearbyImage} />
            <View style={[styles.nearbyCatBadge, { backgroundColor: catColors[item.category] || '#10B981' }]}>
               <Ionicons name={`${catIcons[item.category] || 'grid'}-outline`} size={10} color="#FFF" />
               <Text style={styles.nearbyCatText} numberOfLines={1}>{item.category}</Text>
            </View>
         </View>
         <View style={styles.nearbyInfo}>
            <Text style={styles.nearbyTitle} numberOfLines={1}>{item.title}</Text>
            
            <View style={styles.nearbyUserRow}>
               <Ionicons name="person-circle-outline" size={16} color="#94A3B8" />
               <Text style={styles.nearbyUserText} numberOfLines={1}>{item.donor?.fullName || 'Unknown Donor'}</Text>
            </View>
            
            <View style={styles.nearbyBottomRow}>
               <View style={[styles.nearbyStatusBadge, 
                 { backgroundColor: item.status === 'completed' ? '#F0FDF4' : item.status === 'pending' ? '#F0F9FF' : '#FFFBEB' }
               ]}>
                  <Ionicons 
                    name={item.status === 'completed' ? 'checkmark-circle' : item.status === 'pending' ? 'time' : 'alert-circle'} 
                    size={14} 
                    color={item.status === 'completed' ? '#10B981' : item.status === 'pending' ? '#0EA5E9' : '#F59E0B'} 
                  />
                  <Text style={[styles.nearbyStatusText, { color: item.status === 'completed' ? '#10B981' : item.status === 'pending' ? '#0EA5E9' : '#F59E0B' }]}>
                     {item.status.toUpperCase()}
                  </Text>
               </View>
               <View style={styles.nearbyActionBtn}>
                  <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
               </View>
            </View>
         </View>
      </TouchableOpacity>
    );
  };

  const renderIssueItem = ({ item }) => (
    <TouchableOpacity style={[styles.listCard, { borderColor: '#FEF2F2', borderWidth: 1 }]} onPress={() => setSelectedDonation(item)}>
       <View style={[styles.itemThumb, { backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }]}>
          <MaterialCommunityIcons name="api-off" size={24} color="#EF4444" />
       </View>
       <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>Donation ID: {item._id.slice(-6)}</Text>
          <Text style={[styles.cardSub, { color: '#EF4444', fontWeight: 'bold' }]} numberOfLines={2}>
            AI Error: {item.moderationResult?.aiReason || 'Limit reached or API failed'}
          </Text>
          <Text style={styles.subText}>{new Date(item.createdAt).toLocaleString()}</Text>
       </View>
       <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );


  // ---------------- MODALS ---------------- //

  const UserDetailModal = () => (
    <Modal visible={!!selectedUser} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedUser(null)}>
      {selectedUser && (
        <SafeView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>User Profile</Text>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="close" size={28} color="#1E293B" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.profileHeader}>
              <Image source={{ uri: selectedUser.profilePic || `https://ui-avatars.com/api/?name=${selectedUser.fullName}&background=random` }} style={styles.profileLargePic} />
              <Text style={styles.profileName}>{selectedUser.fullName}</Text>
              <Text style={styles.profileEmail}>{selectedUser.email}</Text>
              <Text style={styles.profilePhone}>{selectedUser.mobileNumber}</Text>
            </View>

            <View style={styles.sectionHeader}><Text style={styles.sectionTitleText}>Donation History ({selectedUserDonations.length})</Text></View>
            
            {selectedUserDonations.length === 0 ? (
               <Text style={styles.emptyTextModal}>No donations made yet.</Text>
            ) : (
              selectedUserDonations.map(d => (
                <TouchableOpacity key={d._id} style={styles.historyCard} onPress={() => { setSelectedUser(null); setSelectedDonation(d); }}>
                  <Image source={{ uri: d.image }} style={styles.historyImg} />
                  <View style={{flex: 1, marginLeft: 10}}>
                    <Text style={styles.historyTitle}>{d.title}</Text>
                    <Text style={styles.historyDate}>{new Date(d.createdAt).toLocaleDateString()}</Text>
                    <Text style={[styles.historyStatus, d.status === 'completed' ? {color: '#10B981'} : {color: '#0EA5E9'}]}>{d.status.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={styles.dangerBtn} onPress={() => handleDeleteUser(selectedUser._id, selectedUser.fullName)}>
              <Ionicons name="trash" size={20} color="#FFF" />
              <Text style={styles.dangerBtnText}>Delete User & All Donations</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeView>
      )}
    </Modal>
  );

  const DonationDetailModal = () => {
    if (!selectedDonation) return null;
    const isReview = selectedDonation.status === 'under_review';
    const isError = selectedDonation.moderationResult?.verdict === 'error';
    const acceptedRequest = selectedDonation.requests?.find(r => r.status === 'accepted');

    return (
      <Modal visible={!!selectedDonation} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedDonation(null)}>
        <SafeView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isReview ? 'Review Donation' : 'Donation Details'}</Text>
            <TouchableOpacity onPress={() => setSelectedDonation(null)}><Ionicons name="close" size={28} color="#1E293B" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Image source={{ uri: selectedDonation.image }} style={styles.detailHeroImage} />
            
            <View style={styles.detailSection}>
              <View style={styles.badgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: isReview ? '#FEF2F2' : '#F0FDF4' }]}>
                  <Text style={[styles.statusBadgeText, { color: isReview ? '#EF4444' : '#10B981' }]}>{selectedDonation.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.categoryBadge}>{selectedDonation.category}</Text>
              </View>
              
              <Text style={styles.detailTitle}>{selectedDonation.title}</Text>
              <Text style={styles.detailDesc}>{selectedDonation.description || 'No description provided.'}</Text>
              
              <View style={styles.infoBox}>
                <View style={styles.infoRow}><Ionicons name="person-outline" size={18} color="#64748B" /><Text style={styles.infoText}>Donor: {selectedDonation.donor?.fullName}</Text></View>
                <View style={styles.infoRow}><Ionicons name="location-outline" size={18} color="#64748B" /><Text style={styles.infoText}>{selectedDonation.pickupAddress}</Text></View>
                <View style={styles.infoRow}><Ionicons name="calendar-outline" size={18} color="#64748B" /><Text style={styles.infoText}>Posted: {new Date(selectedDonation.createdAt).toLocaleString()}</Text></View>
              </View>

              {/* Moderation Box */}
              {(isReview || isError || selectedDonation.moderationResult) && (
                <View style={[styles.infoBox, { backgroundColor: isError ? '#FEF2F2' : '#F8FAFC', borderColor: isError ? '#FECACA' : '#E2E8F0' }]}>
                  <Text style={styles.sectionTitleText}>AI Moderation Report</Text>
                  <Text style={styles.infoText}><Text style={{fontWeight: 'bold'}}>Verdict:</Text> {selectedDonation.moderationResult?.verdict || 'N/A'}</Text>
                  <Text style={styles.infoText}><Text style={{fontWeight: 'bold'}}>Reason:</Text> {selectedDonation.moderationResult?.aiReason || 'AI Failed / Limit reached'}</Text>
                </View>
              )}

              {/* Accepted By Box */}
              {acceptedRequest && (
                <View style={[styles.infoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <Text style={styles.sectionTitleText}>Accepted By</Text>
                  <Text style={styles.infoText}><Text style={{fontWeight: 'bold'}}>Name:</Text> {acceptedRequest.requester?.fullName}</Text>
                  <Text style={styles.infoText}><Text style={{fontWeight: 'bold'}}>Phone:</Text> {acceptedRequest.requester?.mobileNumber}</Text>
                </View>
              )}

              {/* Actions */}
              {isReview ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtnBlock, { backgroundColor: '#10B981', flex: 1, marginRight: 10 }]} onPress={() => handleApprove(selectedDonation._id, selectedDonation.title)}>
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtnBlock, { backgroundColor: '#EF4444', flex: 1 }]} onPress={() => handleReject(selectedDonation._id, selectedDonation.title)}>
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.dangerBtn} onPress={() => handleDeleteDonation(selectedDonation._id, selectedDonation.title)}>
                  <Ionicons name="trash" size={20} color="#FFF" />
                  <Text style={styles.dangerBtnText}>Delete Donation Record</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeView>
      </Modal>
    );
  };

  const ActionModalComponent = () => (
    <Modal visible={actionModal.visible} transparent animationType="fade" onRequestClose={() => setActionModal({visible: false, type: '', id: null, title: ''})}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, elevation: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 8 }}>
            {actionModal.type === 'approve' ? 'Approve Donation' : actionModal.type === 'reject' ? 'Reject Donation' : 'Delete Donation'}
          </Text>
          <Text style={{ color: '#64748B', marginBottom: 20, lineHeight: 20 }}>
            {actionModal.type === 'approve' ? `You are approving "${actionModal.title}". Add any optional notes:` : 
             actionModal.type === 'reject' ? `You are rejecting "${actionModal.title}". Provide a reason to notify the user:` : 
             `Are you sure you want to delete "${actionModal.title}"? Provide a reason to notify the user:`}
          </Text>
          
          <TextInput
            style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 16, minHeight: 100, textAlignVertical: 'top', marginBottom: 24, fontSize: 15, color: '#1E293B' }}
            placeholder={actionModal.type === 'approve' ? "Looking good! (Optional)" : "This doesn't meet our community guidelines..."}
            placeholderTextColor="#94A3B8"
            multiline
            value={actionNote}
            onChangeText={setActionNote}
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setActionModal({visible: false, type: '', id: null, title: ''})} style={{ paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 }}>
              <Text style={{ color: '#64748B', fontWeight: '800', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={submitActionModal}
              style={{ backgroundColor: actionModal.type === 'approve' ? '#10B981' : '#EF4444', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                {actionModal.type === 'approve' ? 'Confirm Approve' : actionModal.type === 'reject' ? 'Confirm Reject' : 'Confirm Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.activeTab]} onPress={() => setActiveTab('overview')}>
               <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Stats</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.tab, activeTab === 'users' && styles.activeTab]} onPress={() => setActiveTab('users')}>
               <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.tab, activeTab === 'donations' && styles.activeTab]} onPress={() => setActiveTab('donations')}>
               <Text style={[styles.tabText, activeTab === 'donations' && styles.activeTabText]}>Donations</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.tab, activeTab === 'review' && styles.activeTab]} onPress={() => setActiveTab('review')}>
               <Text style={[styles.tabText, activeTab === 'review' && styles.activeTabText]}>Reviews {stats.reviewQueue > 0 && `(${stats.reviewQueue})`}</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.tab, activeTab === 'issues' && styles.activeTab]} onPress={() => setActiveTab('issues')}>
               <Text style={[styles.tabText, activeTab === 'issues' && styles.activeTabText]}>API Issues {apiIssues.length > 0 && `(${apiIssues.length})`}</Text>
             </TouchableOpacity>
         </ScrollView>
      </View>

      {activeTab === 'overview' && (
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2F7B5E']} />}>
          <Text style={styles.sectionTitle}>Global Statistics</Text>
          <View style={styles.statsGrid}>
             {renderStatCard('Total Users', stats.users, 'account-group', '#4F46E5')}
             {renderStatCard('Total Items', stats.donations, 'gift', '#10B981')}
             {renderStatCard('Reviews Pending', stats.reviewQueue, 'shield-alert', '#F59E0B')}
             {renderStatCard('API Issues', apiIssues.length, 'api-off', '#EF4444')}
          </View>
        </ScrollView>
      )}

      {activeTab === 'donations' && (
        <View style={styles.filterContainer}>
          {['all', 'pending', 'completed'].map(f => (
            <TouchableOpacity key={f} style={[styles.filterBtn, donationFilter === f && styles.activeFilterBtn]} onPress={() => setDonationFilter(f)}>
              <Text style={[styles.filterText, donationFilter === f && styles.activeFilterText]}>{f.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {(activeTab !== 'overview') && (
        <View style={styles.listContainer}>
           {loading && !refreshing ? (
             <View style={styles.centered}><ActivityIndicator size="large" color="#2F7B5E" /></View>
           ) : (
             <FlatList
               data={activeTab === 'users' ? users : activeTab === 'donations' ? filteredDonations : activeTab === 'review' ? reviewItems : apiIssues}
               keyExtractor={(item) => item._id}
               renderItem={activeTab === 'users' ? renderUserItem : (activeTab === 'donations' || activeTab === 'review') ? renderDonationItem : renderIssueItem}
               contentContainerStyle={styles.listContent}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2F7B5E']} />}
               ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No {activeTab} found.</Text></View>}
             />
           )}
        </View>
      )}

      <UserDetailModal />
      <DonationDetailModal />
      <ActionModalComponent />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: '#F1F5F9' },
  activeTab: { backgroundColor: '#2F7B5E' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 50) / 2, padding: 20, borderRadius: 24, marginBottom: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  statIconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statCount: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  statTitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFF' },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 10 },
  activeFilterBtn: { backgroundColor: '#2F7B5E', borderColor: '#2F7B5E' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  activeFilterText: { color: '#FFF' },

  listContainer: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 },
  listCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F1F5F9' },
  itemThumb: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#F1F5F9' },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  cardEmail: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  cardSub: { fontSize: 12, color: '#64748B' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  roleText: { fontSize: 10, fontWeight: '800', color: '#2F7B5E' },
  subText: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },

  // New Nearby Donation UI Styles
  nearbyCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 12, flexDirection: 'row', marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  nearbyImageContainer: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  nearbyImage: { width: '100%', height: '100%' },
  nearbyCatBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  nearbyCatText: { color: '#FFF', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  nearbyInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  nearbyTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 6 },
  nearbyUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nearbyUserText: { fontSize: 13, color: '#64748B', marginLeft: 6, fontWeight: '600' },
  nearbyBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nearbyStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  nearbyStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  nearbyActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

  // Modals
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  modalBody: { flex: 1 },
  
  profileHeader: { alignItems: 'center', padding: 30, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  profileLargePic: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  profileName: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  profileEmail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  profilePhone: { fontSize: 14, color: '#64748B', marginTop: 4 },
  
  sectionHeader: { padding: 20, backgroundColor: '#F8FAFC' },
  sectionTitleText: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  emptyTextModal: { textAlign: 'center', color: '#94A3B8', marginTop: 20 },
  
  historyCard: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 10, borderRadius: 16, padding: 12, alignItems: 'center', elevation: 1 },
  historyImg: { width: 50, height: 50, borderRadius: 10 },
  historyTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  historyDate: { fontSize: 12, color: '#64748B' },
  historyStatus: { fontSize: 12, fontWeight: '800', marginTop: 4 },

  dangerBtn: { flexDirection: 'row', backgroundColor: '#EF4444', padding: 16, margin: 20, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  dangerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', marginLeft: 8 },

  detailHeroImage: { width: '100%', height: 250, backgroundColor: '#E2E8F0' },
  detailSection: { padding: 20 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  categoryBadge: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  detailTitle: { fontSize: 26, fontWeight: '900', color: '#1E293B', marginTop: 15, marginBottom: 10 },
  detailDesc: { fontSize: 15, color: '#475569', lineHeight: 24, marginBottom: 20 },
  
  infoBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 14, color: '#334155', marginLeft: 10, flex: 1 },
  
  actionRow: { flexDirection: 'row', marginTop: 10, marginBottom: 20 },
  actionBtnBlock: { padding: 18, borderRadius: 16, alignItems: 'center', elevation: 2 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});

export default AdminDashboardScreen;
