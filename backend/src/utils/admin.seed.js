import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';

const seedAdmins = async () => {
    const admins = [
        { email: 'chaitanyaraut027@gmail.com', fullName: 'Chaitanya Raut', mobileNumber: '1234567890' },
        { email: 'simranmandave04@gmail.com', fullName: 'Simran Mandave', mobileNumber: '1234567890' },
        { email: 'shruti21@gmail.com', fullName: 'Shruti', mobileNumber: '1234567890' },
    ];

    const password = '12345678';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        for (const adminData of admins) {
            const adminExists = await User.findOne({ email: adminData.email });

            if (!adminExists) {
                await User.create({
                    fullName: adminData.fullName,
                    email: adminData.email,
                    mobileNumber: adminData.mobileNumber,
                    password: hashedPassword,
                    role: 'admin',
                });
                console.log(`Admin ${adminData.email} created.`);
            } 
        }
    } catch (error) {
        console.error('Error seeding admins:', error);
    }
};

export default seedAdmins;
