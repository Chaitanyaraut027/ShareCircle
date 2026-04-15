import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');

try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
    console.warn('⚠️ Firebase service account key not found. Push notifications via Firebase will be disabled.');
    console.warn('Please place your downloaded JSON key at: backend/src/config/serviceAccountKey.json');
}

export default admin;
