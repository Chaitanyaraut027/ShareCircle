import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/Welcome';
import { TAGLINES, COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= TAGLINES.length) {
                nextIndex = 0;
            }
            setCurrentIndex(nextIndex);
            if (flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
            }
        }, 3000); // 3 seconds

        return () => clearInterval(interval);
    }, [currentIndex]);

    const renderItem = ({ item }) => (
        <View style={{ width: width - 40, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.taglineText}>"{item}"</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
            <View style={styles.logoContainer}>
                <View style={{ backgroundColor: '#F0F9F4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 10 }}>
                    <Text style={{ color: COLORS.primary, fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>COMMUNITY FIRST</Text>
                </View>
                <Text style={styles.appName}>ShareCircle</Text>
            </View>

            <View style={styles.sliderContainer}>
                <FlatList
                    ref={flatListRef}
                    data={TAGLINES}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={false}
                    getItemLayout={(data, index) => ({
                        length: width - 40,
                        offset: (width - 40) * index,
                        index,
                    })}
                />
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.buttonSecondary}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.buttonTextSecondary}>Already a member? Sign In</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default WelcomeScreen;
