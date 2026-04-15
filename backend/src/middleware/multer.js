import multer from 'multer';
import path from 'path';
import os from 'os';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use system temp directory for universal compatibility (Render, local, etc.)
        cb(null, os.tmpdir())
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})

export const upload = multer({ storage: storage });
