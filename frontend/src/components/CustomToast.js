import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CustomToast = ({ visible, message, type = 'success', onHide }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(-100));

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 50,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            const timer = setTimeout(() => {
                hideToast();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(-100);
        }
    }, [visible]);

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start(() => {
            if (onHide) onHide();
        });
    };

    if (!visible && fadeAnim._value === 0) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'error': return 'alert-circle';
            case 'info': return 'information-circle';
            default: return 'checkmark-circle';
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return '#10B981';
            case 'error': return '#EF4444';
            case 'info': return '#3B82F6';
            default: return '#10B981';
        }
    };

    return (
        <Animated.View 
            style={[
                styles.toastContainer, 
                { 
                    opacity: fadeAnim, 
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: getBgColor()
                }
            ]}
        >
            <Ionicons name={getIcon()} size={24} color="#FFF" />
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 9999,
    },
    toastText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 12,
        flex: 1,
    },
});

export default CustomToast;
