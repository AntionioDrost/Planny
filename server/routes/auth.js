const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await db.getAsync(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate QR code data (user ID)
    const userId = uuidv4();
    const qrCodeData = JSON.stringify({ userId, type: 'planny_connection' });
    const calendarToken = crypto.randomBytes(32).toString('hex');

    // Create user
    await db.runAsync(
      `INSERT INTO users (id, username, email, password_hash, qr_code_data, calendar_token) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username, email, passwordHash, qrCodeData, calendarToken]
    );

    // Generate token
    const token = generateToken(userId);

    res.status(201).json({
      token,
      user: {
        id: userId,
        username,
        email,
        qrCodeData,
        calendarToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.getAsync(
      'SELECT id, username, email, password_hash, profile_image, qr_code_data, calendar_token FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile_image,
        qrCodeData: user.qr_code_data,
        calendarToken: user.calendar_token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get QR code image
router.get('/qr/:userId', async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT qr_code_data FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const qrCodeBuffer = await QRCode.toBuffer(user.qr_code_data, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300
    });

    res.type('png');
    res.send(qrCodeBuffer);
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
