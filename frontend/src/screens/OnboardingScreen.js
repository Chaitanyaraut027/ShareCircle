import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    Dimensions,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Share the Love',
        description: 'Easily donate your extra food, clothes, and essentials to those in need within your community.',
        image: require('../../assets/onboarding_donate_clean.png'),
    },
    {
        id: '2',
        title: 'Build Community',
        description: 'Connect with donors and receivers nearby. Together, we can create a stronger, more caring circle.',
        image: require('../../assets/onboarding_community_clean.png'),
    },
    {
        id: '3',
        title: 'Make an Impact',
        description: 'See the difference your contributions make. Every small gesture helps someone in a big way.',
        image: require('../../assets/onboarding_impact_clean.png'),
    }
];

const OnboardingScreen = ({ navigation }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        navigation.replace('Welcome');
    };

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const renderItem = ({ item }) => (
        <View style={styles.slide}>
            <Image source={item.image} style={styles.image} resizeMode="contain" />
            <View style={styles.textContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                currentIndex === index && styles.activeIndicator
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
    },
    skipText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
    slide: {
        width: width,
        alignItems: 'center',
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    image: {
        width: width,
        height: width * 1.0, 
        marginBottom: 20,
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    title: {
        fontSize: 30,
        fontWeight: '900',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 17,
        color: '#444',
        textAlign: 'center',
        lineHeight: 26,
        paddingHorizontal: 10,
    },
    footer: {
        height: 120,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 30,
    },
    indicatorContainer: {
        flexDirection: 'row',
    },
    indicator: {
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 5,
    },
    activeIndicator: {
        backgroundColor: COLORS.primary,
        width: 30,
    },
    nextButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 60,
        paddingVertical: 15,
        borderRadius: 30,
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default OnboardingScreen;
