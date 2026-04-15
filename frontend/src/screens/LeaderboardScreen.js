import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';

const { width } = Dimensions.get('window');

const getInitials = (fullName) => {
  if (!fullName) return '?';
  const names = fullName.trim().split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[1][0]).toUpperCase();
  }
  return names[0][0].toUpperCase();
};

const LeaderboardScreen = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/leaderboard`);
      if (res.data.success) {
        setLeaderboard(res.data.data);
      }
      
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const renderAvatar = (item, isWinner = false) => {
    const size = isWinner ? 90 : 50;
    if (item.profilePic && item.profilePic.trim() !== '') {
      return (
        <Image
          source={{ uri: item.profilePic }}
          style={[styles.baseAvatar, isWinner ? styles.winnerAvatar : styles.itemAvatar]}
        />
      );
    }
    
    return (
      <View style={[styles.initialsAvatar, isWinner ? styles.winnerInitials : styles.itemInitials]}>
        <Text style={[styles.initialsText, isWinner && styles.winnerInitialsText]}>
          {getInitials(item.fullName)}
        </Text>
      </View>
    );
  };

  const renderTopThree = () => {
    const topThree = leaderboard.slice(0, 3);
    if (topThree.length === 0) return null;

    // Rearrange to put Rank 1 in middle: [2, 1, 3]
    const displayArray = [];
    if (topThree[1]) displayArray.push(topThree[1]);
    if (topThree[0]) displayArray.push(topThree[0]);
    if (topThree[2]) displayArray.push(topThree[2]);

    return (
      <View style={styles.topThreeContainer}>
        {displayArray.map((item, index) => {
          const isWinner = item.rank === 1;
          const isSecond = item.rank === 2;
          const isThird = item.rank === 3;
          
          return (
            <View key={item._id} style={[styles.topThreeItem, isWinner && styles.winnerItem]}>
              <View style={styles.avatarWrapper}>
                {renderAvatar(item, isWinner)}
                <View style={[styles.rankBadge, isWinner ? styles.goldBadge : isSecond ? styles.silverBadge : styles.bronzeBadge]}>
                  <Text style={styles.rankBadgeText}>{item.rank}</Text>
                </View>
              </View>
              <Text style={styles.topName} numberOfLines={1}>{item.fullName.split(' ')[0]}</Text>
              <View style={styles.pointsWrapper}>
                <FontAwesome5 name="star" size={10} color="#F1C40F" solid />
                <Text style={styles.topPoints}>{item.rewardPoints}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isMe = currentUser && item._id === currentUser._id;

    return (
      <View style={[styles.rankItem, isMe && styles.myRankItem]}>
        <View style={styles.rankNumberContainer}>
          <Text style={[styles.rankNumber, isMe && styles.myRankText]}>{item.rank}</Text>
        </View>
        
        {renderAvatar(item, false)}
        
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, isMe && styles.myRankText]} numberOfLines={1}>{item.fullName}</Text>
          <View style={styles.itemStats}>
            <View style={styles.statRow}>
              <Ionicons name="gift-outline" size={12} color="#10B981" />
              <Text style={[styles.statText, isMe && styles.myRankText]}>{item.donationCount} items</Text>
            </View>
            <View style={styles.statRow}>
              <Ionicons name="heart-outline" size={12} color="#E74C3C" />
              <Text style={[styles.statText, isMe && styles.myRankText]}>{item.livesSaved} lives</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.itemPointsContainer}>
          <Text style={[styles.itemPoints, isMe && styles.myRankText]}>{item.rewardPoints}</Text>
          <Text style={[styles.ptsLabel, isMe && styles.myRankText]}>pts</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={leaderboard.slice(3)}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={renderTopThree}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
          }
          ListEmptyComponent={
            leaderboard.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyText}>No rankings yet</Text>
              </View>
            )
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 30,
    paddingBottom: 40,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  topThreeItem: {
    alignItems: 'center',
    width: width * 0.28,
  },
  winnerItem: {
    width: width * 0.35,
    transform: [{ scale: 1.1 }],
    zIndex: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  baseAvatar: {
    backgroundColor: '#E2E8F0',
  },
  topAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#E2E8F0',
  },
  winnerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderColor: '#FDCB6E',
    borderWidth: 3,
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  itemInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 12,
  },
  winnerInitials: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F39C12',
    borderColor: '#FDCB6E',
    borderWidth: 3,
  },
  initialsText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  winnerInitialsText: {
    fontSize: 32,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  goldBadge: { backgroundColor: '#FDCB6E' },
  silverBadge: { backgroundColor: '#D1D8E0' },
  bronzeBadge: { backgroundColor: '#E17055' },
  rankBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  pointsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topPoints: {
    fontSize: 12,
    fontWeight: '800',
    color: '#636E72',
    marginLeft: 4,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  myRankItem: {
    backgroundColor: '#10B981',
    borderWidth: 0,
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
  },
  rankNumberContainer: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
  },
  myRankText: {
    color: '#FFF',
  },
  itemAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 12,
    backgroundColor: '#E2E8F0'
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  itemPointsContainer: {
    alignItems: 'flex-end',
  },
  itemPoints: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  ptsLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: -2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 15,
    fontWeight: '500',
  }
});

export default LeaderboardScreen;
