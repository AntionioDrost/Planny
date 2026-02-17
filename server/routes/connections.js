const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Scan QR code and create connection
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { qrCodeData } = req.body;

    if (!qrCodeData) {
      return res.status(400).json({ error: 'QR code data is required' });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(qrCodeData);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    if (parsedData.type !== 'planny_connection' || !parsedData.userId) {
      return res.status(400).json({ error: 'Invalid QR code type' });
    }

    const scannedUserId = parsedData.userId;
    const currentUserId = req.user.userId;

    // Can't connect to yourself
    if (scannedUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot connect to yourself' });
    }

    // Check if user exists
    const targetUser = await db.getAsync(
      'SELECT id, username, profile_image FROM users WHERE id = ?',
      [scannedUserId]
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await db.getAsync(
      `SELECT id, status FROM connections 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, scannedUserId, scannedUserId, currentUserId]
    );

    if (existingConnection) {
      if (existingConnection.status === 'accepted') {
        return res.status(400).json({ error: 'Already connected' });
      }
      // Update to accepted if pending
      await db.runAsync(
        'UPDATE connections SET status = ? WHERE id = ?',
        ['accepted', existingConnection.id]
      );
    } else {
      // Create new connection (bidirectional)
      const connectionId = uuidv4();
      await db.runAsync(
        `INSERT INTO connections (id, user1_id, user2_id, status) 
         VALUES (?, ?, ?, ?)`,
        [connectionId, currentUserId, scannedUserId, 'accepted']
      );
    }

    res.json({
      message: 'Connection established',
      user: {
        id: targetUser.id,
        username: targetUser.username,
        profileImage: targetUser.profile_image ? `/uploads/${targetUser.profile_image}` : null
      }
    });
  } catch (error) {
    console.error('Scan QR code error:', error);
    res.status(500).json({ error: 'Failed to process QR code' });
  }
});

// Get all connections
router.get('/', authenticateToken, async (req, res) => {
  try {
    const connections = await db.allAsync(
      `SELECT 
        c.id,
        c.status,
        c.created_at,
        CASE 
          WHEN c.user1_id = ? THEN u2.id
          ELSE u1.id
        END as connected_user_id,
        CASE 
          WHEN c.user1_id = ? THEN u2.username
          ELSE u1.username
        END as connected_username,
        CASE 
          WHEN c.user1_id = ? THEN u2.profile_image
          ELSE u1.profile_image
        END as connected_profile_image
       FROM connections c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE (c.user1_id = ? OR c.user2_id = ?) AND c.status = 'accepted'
       ORDER BY c.created_at DESC`,
      [req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId]
    );

    const formattedConnections = connections.map(conn => ({
      id: conn.id,
      userId: conn.connected_user_id,
      username: conn.connected_username,
      profileImage: conn.connected_profile_image ? `/uploads/${conn.connected_profile_image}` : null,
      connectedAt: conn.created_at
    }));

    res.json(formattedConnections);
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// Remove connection
router.delete('/:connectionId', authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Verify connection belongs to user
    const connection = await db.getAsync(
      'SELECT id FROM connections WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [connectionId, req.user.userId, req.user.userId]
    );

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await db.runAsync('DELETE FROM connections WHERE id = ?', [connectionId]);

    res.json({ message: 'Connection removed' });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

module.exports = router;
