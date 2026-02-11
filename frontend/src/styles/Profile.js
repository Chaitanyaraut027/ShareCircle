import { StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: 30,
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatarText: {
        fontSize: 40,
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    role: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 5,
        textTransform: 'uppercase',
    },
    detailsContainer: {
        padding: 20,
        marginTop: 20,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    detailLabel: {
        width: 100,
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
    },
    detailValue: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        fontWeight: '500',
    },
    logoutButton: {
        margin: 30,
        backgroundColor: COLORS.error,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    logoutText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default styles;
