import { StyleSheet, Dimensions, Platform } from 'react-native';
import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 25,
        paddingTop: Platform.OS === 'ios' ? 20 : 40,
        paddingBottom: 40,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 35,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F9F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
        fontWeight: '500',
    },
    quoteSection: {
        backgroundColor: '#F8FAFC',
        padding: 20,
        borderRadius: 24,
        marginBottom: 35,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        borderStyle: 'dashed',
    },
    quoteText: {
        fontSize: 15,
        color: '#475569',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 22,
        fontWeight: '600',
    },
    quoteAuthor: {
        fontSize: 12,
        color: COLORS.primary,
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        color: '#334155',
        marginBottom: 10,
        fontWeight: '800',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        borderRadius: 18,
        paddingHorizontal: 16,
        backgroundColor: '#F8FAFC',
        height: 60,
    },
    inputIcon: {
        marginRight: 12,
    },
    inputField: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '600',
    },
    eyeIcon: {
        padding: 10,
    },
    forgotPassword: {
        textAlign: 'right',
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '800',
        marginTop: -10,
        marginBottom: 30,
    },
    button: {
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
        marginTop: 10,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    footerLinkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 35,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '600',
    },
    footerLinkBold: {
        fontSize: 15,
        color: COLORS.primary,
        fontWeight: '800',
        marginLeft: 5,
    },
});

export default styles;
