import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../utils/constants';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    logoContainer: {
        marginBottom: 50,
        alignItems: 'center',
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 10,
    },
    sliderContainer: {
        height: 150,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 50,
    },
    taglineText: {
        fontSize: 18,
        color: COLORS.text,
        textAlign: 'center',
        fontStyle: 'italic',
        paddingHorizontal: 20,
    },
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 15,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    buttonSecondary: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 15,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonTextSecondary: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default styles;
