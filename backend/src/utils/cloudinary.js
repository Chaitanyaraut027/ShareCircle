import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        });
        fs.unlinkSync(localFilePath); // remove locally saved temp file
        return response;
    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath); // remove temp file on error
        }
        console.error("Cloudinary upload failed", error);
        return null;
    }
}

export { uploadOnCloudinary };
