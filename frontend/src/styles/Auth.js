import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        color: COLORS.text,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        backgroundColor: '#fafafa',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginBottom: 20,
        backgroundColor: '#fafafa',
        overflow: 'hidden',
    },
    button: {
        backgroundColor: COLORS.primary,
        padding: 18,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    linkText: {
        marginTop: 20,
        textAlign: 'center',
        color: COLORS.secondary,
        fontSize: 16,
    },
    errorText: {
        color: COLORS.error,
        marginBottom: 10,
        textAlign: 'center',
    },
    roleSelection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    roleButton: {
        flex: 1,
        padding: 15,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginHorizontal: 5,
        alignItems: 'center',
        backgroundColor: '#fafafa',
    },
    roleButtonActive: {
        backgroundColor: COLORS.primary + '20', // 20% opacity using hex if possible, or just light green
        borderColor: COLORS.primary,
    },
    roleText: {
        color: COLORS.text,
        fontWeight: '500',
    },
    roleTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
});

export default styles;
