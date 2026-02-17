const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getAsync(
      `SELECT id, username, email, profile_image, qr_code_data, calendar_token, created_at 
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate calendar token if missing (for existing users)
    let calendarToken = user.calendar_token;
    if (!calendarToken) {
      calendarToken = crypto.randomBytes(32).toString('hex');
      await db.runAsync(
        'UPDATE users SET calendar_token = ? WHERE id = ?',
        [calendarToken, user.id]
      );
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      profileImage: user.profile_image ? `/uploads/${user.profile_image}` : null,
      qrCodeData: user.qr_code_data,
      calendarToken: calendarToken,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Upload profile image
router.post('/me/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Get current user to delete old image if exists
    const user = await db.getAsync(
      'SELECT profile_image FROM users WHERE id = ?',
      [req.user.userId]
    );

    // Delete old image if exists
    if (user && user.profile_image) {
      const oldImagePath = path.join(__dirname, '../uploads', user.profile_image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update user with new image
    await db.runAsync(
      'UPDATE users SET profile_image = ? WHERE id = ?',
      [req.file.filename, req.user.userId]
    );

    res.json({
      profileImage: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get user by ID (for displaying to connections)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if users are connected
    const connection = await db.getAsync(
      `SELECT status FROM connections 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [req.user.userId, userId, userId, req.user.userId]
    );

    if (!connection || connection.status !== 'accepted') {
      return res.status(403).json({ error: 'Users are not connected' });
    }

    const user = await db.getAsync(
      `SELECT id, username, profile_image, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      profileImage: user.profile_image ? `/uploads/${user.profile_image}` : null,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
