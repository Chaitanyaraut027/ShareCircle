import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import DonateFormScreen from '../screens/DonateFormScreen';
import RequestsScreen from '../screens/RequestsScreen';

const Tab = createBottomTabNavigator();

// Placeholder screens for other tabs
const PlaceholderScreen = ({ name }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
    <Text style={{ fontSize: 18, fontWeight: '600', color: '#64748B' }}>{name} Screen</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>Coming Soon</Text>
  </View>
);



const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Leaderboard" 
        component={LeaderboardScreen} 
        options={{
          tabBarLabel: 'Rankings',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="trophy-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="DonateTab" 
        component={DonateFormScreen} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('DonateForm');
          },
        })}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color, size }) => (
            <View style={styles.customButton}>
               <Feather name="plus" color="#FFF" size={26} />
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Requests" 
        component={RequestsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 0,
    height: 85,
    paddingBottom: 25,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
  },

  customButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F39C12',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    marginTop: -5,
  }
});

export default MainTabNavigator;
