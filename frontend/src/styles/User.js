import { StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 10,
    },
    userInfo: {
        backgroundColor: COLORS.white,
        padding: 30,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
        marginBottom: 40,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 5,
    },
    role: {
        fontSize: 16,
        color: COLORS.secondary,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    actionContainer: {
        width: '100%',
        gap: 15,
    },
    button: {
        backgroundColor: COLORS.secondary,
        padding: 15,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },
    buttonLogout: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.error,
        padding: 15,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonTextLogout: {
        color: COLORS.error,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default styles;
