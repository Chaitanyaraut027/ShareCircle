import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/user.model.js';
import Donation from '../src/models/donation.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const seedDemoData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for demo seeding...');

    const users = await User.find({
      fullName: { $in: [/shruti/i, /Shivam/i, /Yash/i, /Atharva/i, /Rohan/i, /Vaishnavi/i] }
    });

    if (users.length === 0) {
      console.log('No matching users found to seed. Make sure users are registered.');
      process.exit(0);
    }

    console.log(`Found ${users.length} users to seed.`);

    // Categorized items for variety
    const items = [
      { title: 'Winter Jacket', category: 'Clothes' },
      { title: 'Bread & Jam', category: 'Food' },
      { title: 'Physics Book', category: 'Books & Stationery' },
      { title: 'Old iPhone', category: 'Electronics' },
      { title: 'First Aid Kit', category: 'Medical Supplies' },
      { title: 'Teddy Bear', category: 'Toys' }
    ];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        // Give each user a different number of donations to create ranking
        const donationCount = (users.length - i) * 3; 
        
        console.log(`Seeding ${donationCount} donations for ${user.fullName}...`);
        
        for (let j = 0; j < donationCount; j++) {
            const item = items[j % items.length];
            await Donation.create({
                donor: user._id,
                title: `${item.title} #${j+1}`,
                category: item.category,
                quantity: '1 unit',
                description: 'Demo item for leaderboard variety.',
                status: 'available',
                location: user.location || { type: 'Point', coordinates: [73.8567, 18.5204] } // Pune fallback
            });
        }
    }

    console.log('Demo seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemoData();
