import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Override DNS resolution to fix MongoDB SRV lookup issues on Windows
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
