import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/user.model.js';
import connectDB from '../src/config/db.js'; // Assuming this maps to where db connection is

dotenv.config();

const admins = [
    {
        fullName: 'Admin One',
        email: 'admin1@sharecircle.com',
        password: 'adminpassword123',
        mobileNumber: '9999999991',
        role: 'admin'
    },
    {
        fullName: 'Admin Two',
        email: 'admin2@sharecircle.com',
        password: 'adminpassword123',
        mobileNumber: '9999999992',
        role: 'admin'
    },
    {
        fullName: 'Admin Three',
        email: 'admin3@sharecircle.com',
        password: 'adminpassword123',
        mobileNumber: '9999999993',
        role: 'admin'
    }
];

const seedAdmins = async () => {
    try {
        await connectDB();

        console.log('Checking for existing admins...');

        for (const adminData of admins) {
            const adminExists = await User.findOne({ email: adminData.email });

            if (!adminExists) {
                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(adminData.password, salt);

                await User.create({
                    ...adminData,
                    password: hashedPassword
                });
                console.log(`Admin created: ${adminData.email}`);
            } else {
                console.log(`Admin already exists: ${adminData.email}`);
            }
        }

        console.log('Admin seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admins:', error);
        process.exit(1);
    }
};

seedAdmins();
