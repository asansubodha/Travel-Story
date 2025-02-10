const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

//storage configaration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // File name after upload
    }
});

//file filter to accept only images
const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed"), false);
    }
};

//initialize multer instance
const upload = multer({ storage, fileFilter });

module.exports = upload;