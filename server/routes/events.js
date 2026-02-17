const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, startDate, endDate, allDay, participantIds } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    const eventId = uuidv4();
    const creatorId = req.user.userId;

    // Create event
    await db.runAsync(
      `INSERT INTO events (id, creator_id, title, description, start_date, end_date, all_day) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, creatorId, title, description || null, startDate, endDate || null, allDay ? 1 : 0]
    );

    // Add creator as participant
    const creatorParticipantId = uuidv4();
    await db.runAsync(
      'INSERT INTO event_participants (id, event_id, user_id) VALUES (?, ?, ?)',
      [creatorParticipantId, eventId, creatorId]
    );

    // Add other participants
    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        // Verify connection exists
        const connection = await db.getAsync(
          `SELECT id FROM connections 
           WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) 
           AND status = 'accepted'`,
          [creatorId, participantId, participantId, creatorId]
        );

        if (connection) {
          const participantRecordId = uuidv4();
          await db.runAsync(
            'INSERT INTO event_participants (id, event_id, user_id) VALUES (?, ?, ?)',
            [participantRecordId, eventId, participantId]
          );
        }
      }
    }

    const event = await db.getAsync(
      `SELECT e.*, u.username as creator_username 
       FROM events e
       JOIN users u ON e.creator_id = u.id
       WHERE e.id = ?`,
      [eventId]
    );

    res.status(201).json({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      allDay: event.all_day === 1,
      creatorId: event.creator_id,
      creatorUsername: event.creator_username
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get events for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const events = await db.allAsync(
      `SELECT DISTINCT
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.end_date,
        e.all_day,
        e.created_at,
        e.creator_id,
        u.username as creator_username,
        u.profile_image as creator_profile_image
       FROM events e
       JOIN event_participants ep ON e.id = ep.event_id
       JOIN users u ON e.creator_id = u.id
       WHERE ep.user_id = ?
       ORDER BY e.start_date ASC`,
      [req.user.userId]
    );

    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      allDay: event.all_day === 1,
      createdAt: event.created_at,
      creator: {
        id: event.creator_id,
        username: event.creator_username,
        profileImage: event.creator_profile_image ? `/uploads/${event.creator_profile_image}` : null
      }
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get event by ID
router.get('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify user is a participant
    const participant = await db.getAsync(
      'SELECT user_id FROM event_participants WHERE event_id = ? AND user_id = ?',
      [eventId, req.user.userId]
    );

    if (!participant) {
      return res.status(403).json({ error: 'Not authorized to view this event' });
    }

    const event = await db.getAsync(
      `SELECT e.*, u.username as creator_username, u.profile_image as creator_profile_image
       FROM events e
       JOIN users u ON e.creator_id = u.id
       WHERE e.id = ?`,
      [eventId]
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get participants
    const participants = await db.allAsync(
      `SELECT u.id, u.username, u.profile_image
       FROM event_participants ep
       JOIN users u ON ep.user_id = u.id
       WHERE ep.event_id = ?`,
      [eventId]
    );

    res.json({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      allDay: event.all_day === 1,
      createdAt: event.created_at,
      creator: {
        id: event.creator_id,
        username: event.creator_username,
        profileImage: event.creator_profile_image ? `/uploads/${event.creator_profile_image}` : null
      },
      participants: participants.map(p => ({
        id: p.id,
        username: p.username,
        profileImage: p.profile_image ? `/uploads/${p.profile_image}` : null
      }))
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Update event
router.put('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, startDate, endDate, allDay, participantIds } = req.body;

    // Verify user is creator
    const event = await db.getAsync(
      'SELECT creator_id FROM events WHERE id = ?',
      [eventId]
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.creator_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the creator can update this event' });
    }

    // Update event
    await db.runAsync(
      `UPDATE events 
       SET title = ?, description = ?, start_date = ?, end_date = ?, all_day = ?
       WHERE id = ?`,
      [title, description || null, startDate, endDate || null, allDay ? 1 : 0, eventId]
    );

    // Update participants if provided
    if (participantIds && Array.isArray(participantIds)) {
      // Remove existing participants (except creator)
      await db.runAsync(
        'DELETE FROM event_participants WHERE event_id = ? AND user_id != ?',
        [eventId, req.user.userId]
      );

      // Add new participants
      for (const participantId of participantIds) {
        if (participantId !== req.user.userId) {
          const connection = await db.getAsync(
            `SELECT id FROM connections 
             WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) 
             AND status = 'accepted'`,
            [req.user.userId, participantId, participantId, req.user.userId]
          );

          if (connection) {
            const participantRecordId = uuidv4();
            await db.runAsync(
              'INSERT INTO event_participants (id, event_id, user_id) VALUES (?, ?, ?)',
              [participantRecordId, eventId, participantId]
            );
          }
        }
      }
    }

    res.json({ message: 'Event updated' });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify user is creator
    const event = await db.getAsync(
      'SELECT creator_id FROM events WHERE id = ?',
      [eventId]
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.creator_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the creator can delete this event' });
    }

    await db.runAsync('DELETE FROM events WHERE id = ?', [eventId]);

    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
