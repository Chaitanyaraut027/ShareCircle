import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');

let serviceAccount;

try {
    // 1. Check if the environment variable exists (Best for Render/Heroku)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    // 2. Fallback to local file (For local development)
    else if (require('fs').existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(require('fs').readFileSync(serviceAccountPath, 'utf8'));
    }

    if (serviceAccount) {
        // Fix for private key newlines in environment variables
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized successfully');
    } else {
        throw new Error('No service account credentials found');
    }
} catch (error) {
    console.warn('⚠️ Firebase initialization failed:', error.message);
    console.warn('Push notifications will be disabled. To fix this:');
    console.warn('Local: Place src/config/serviceAccountKey.json');
    console.warn('Render: Add FIREBASE_SERVICE_ACCOUNT environment variable with the JSON content');
}

export default admin;
