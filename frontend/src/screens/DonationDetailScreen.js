import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking, Share, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { API_URL } from '../utils/constants';

const DonationDetailScreen = ({ route, navigation }) => {
    const { item, userLocation } = route.params; // Expecting item data and user's current location

    const openWhatsApp = async () => {
        const phone = item.donor?.mobileNumber;
        if (!phone) return;
        
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`;

        // Get current user name for the draft
        const userStr = await AsyncStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const userName = user?.fullName || 'a ShareCircle user';
        
        const message = `*ShareCircle *\n\nHello, I hope you are doing well \n\nI am *${userName}*, and I am looking for *${item.title}*. If you happen to have one available and are willing to donate or share, it would truly mean a lot to me.\n\nThank you so much for your kindness and support ❤️`;
        
        const encodedMsg = encodeURIComponent(message);
        Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${encodedMsg}`);
    };

    const callPhone = () => {
        const phone = item.donor?.mobileNumber;
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const openNavigation = () => {
        if (!item.location?.coordinates) return;
        const [lng, lat] = item.location.coordinates;
        const origin = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : '';
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${lat},${lng}&travelmode=driving`;
        Linking.openURL(url);
    };

    const shareItem = async () => {
        try {
            await Share.share({
                message: `Check out this donation on ShareCircle: ${item.title}\nCategory: ${item.category}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView bounces={false}>
                {/* Header Image */}
                <View style={styles.imageContainer}>
                    <Image 
                        source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/400' }} 
                        style={styles.image}
                        resizeMode="cover"
                    />
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.shareButton} onPress={shareItem}>
                        <Ionicons name="share-social" size={24} color="#1E293B" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{item.title}</Text>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>{item.category}</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="cube-outline" size={20} color="#64748B" />
                        <Text style={styles.infoText}>Quantity: {item.quantity || '1'}</Text>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{item.description || 'No description provided.'}</Text>

                    <View style={styles.divider} />

                    <View style={styles.donorSection}>
                        {item.donor?.profilePic ? (
                            <Image 
                                source={{ uri: item.donor.profilePic }} 
                                style={styles.donorAvatar}
                            />
                        ) : (
                            <View style={[styles.donorAvatar, styles.initialsAvatar]}>
                                <Text style={styles.initialsText}>
                                    {(() => {
                                        const name = item.donor?.fullName || 'User';
                                        const parts = name.split(' ');
                                        return parts.length > 1 
                                            ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
                                            : parts[0].substring(0, 2).toUpperCase();
                                    })()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.donorInfo}>
                            <Text style={styles.donorName}>{item.donor?.fullName || 'Anonymous Donor'}</Text>
                            <View style={styles.donorBadgeRow}>
                                <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
                                <Text style={styles.donorBadge}>Verified Donor</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.locationSection}>
                        <View style={styles.locationHeader}>
                            <Ionicons name="location" size={20} color="#E74C3C" />
                            <Text style={styles.locationTitle}>Pick-up Location</Text>
                        </View>
                        <Text style={styles.address}>{item.pickupAddress || item.address || 'Address not provided'}</Text>
                    </View>

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={callPhone}>
                    <Ionicons name="call" size={22} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.whatsappBtn]} onPress={openWhatsApp}>
                    <MaterialCommunityIcons name="whatsapp" size={26} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.requestBtn]} 
                    onPress={async () => {
                        try {
                            const userStr = await AsyncStorage.getItem('user');
                            const user = userStr ? JSON.parse(userStr) : null;
                            const res = await fetch(`${API_URL}/donations/${item._id}/request`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ requesterId: user?._id, message: `I would like to request ${item.title}` })
                            });
                            const data = await res.json();
                            if (data.success) {
                                Alert.alert("Success", "Request sent!");
                            } else {
                                Alert.alert("Notice", data.message);
                            }
                        } catch (error) {
                            Alert.alert("Error", "Could not send request.");
                        }
                    }}
                >
                    <Text style={styles.requestBtnText}>Request</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation}>
                    <FontAwesome5 name="directions" size={18} color="#1E293B" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    imageContainer: { height: 380, position: 'relative' },
    image: { width: '100%', height: '100%' },
    backButton: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(255,255,255,0.95)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    shareButton: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.95)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    content: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, marginTop: -40, backgroundColor: '#FFF', minHeight: 600, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 10 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 26, fontWeight: '900', color: '#0F172A', flex: 1, marginRight: 10, letterSpacing: -0.5 },
    categoryBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#DCFCE7' },
    categoryText: { color: '#16A34A', fontWeight: '800', fontSize: 13 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    infoText: { marginLeft: 8, fontSize: 15, color: '#475569', fontWeight: '700' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
    description: { fontSize: 16, color: '#475569', lineHeight: 26, fontWeight: '400' },
    donorSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    donorAvatar: { width: 54, height: 54, borderRadius: 27, marginRight: 16 },
    initialsAvatar: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    initialsText: { color: '#475569', fontSize: 18, fontWeight: '900' },
    donorInfo: { flex: 1 },
    donorName: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    donorBadgeRow: { flexDirection: 'row', alignItems: 'center' },
    donorBadge: { fontSize: 13, color: '#10B981', fontWeight: '700', marginLeft: 4 },
    locationSection: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    locationTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginLeft: 10 },
    address: { fontSize: 15, color: '#475569', lineHeight: 24, paddingLeft: 30, fontWeight: '500' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 35, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 15 },
    actionBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    callBtn: { backgroundColor: '#EFF6FF' },
    whatsappBtn: { backgroundColor: '#F0FDF4' },
    requestBtn: { flex: 1, height: 52, backgroundColor: '#10B981', borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    requestBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    navigateBtn: { width: 48, height: 48, backgroundColor: '#F1F5F9', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    navigateBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700', marginLeft: 10 }
});

export default DonationDetailScreen;
