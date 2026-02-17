const express = require('express');
const ical = require('ical-generator');
const db = require('../database');

const router = express.Router();

// Generate iCal feed for user (public access via token)
router.get('/feed/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { token } = req.query;

    // Verify token matches user's calendar token
    const user = await db.getAsync(
      'SELECT id, calendar_token FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!token || token !== user.calendar_token) {
      return res.status(403).json({ error: 'Invalid calendar token' });
    }

    // Get user info
    const userInfo = await db.getAsync(
      'SELECT username, email FROM users WHERE id = ?',
      [userId]
    );

    // Get events for this user
    const events = await db.allAsync(
      `SELECT DISTINCT
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.end_date,
        e.all_day,
        u.username as creator_username
       FROM events e
       JOIN event_participants ep ON e.id = ep.event_id
       JOIN users u ON e.creator_id = u.id
       WHERE ep.user_id = ?
       ORDER BY e.start_date ASC`,
      [userId]
    );

    // Create iCal calendar
    const calendar = ical({
      prodId: {
        company: 'Planny',
        product: 'Planny Calendar',
        language: 'EN'
      },
      name: `${userInfo.username}'s Planny Calendar`,
      timezone: 'UTC'
    });

    // Add events to calendar
    events.forEach(event => {
      const startDate = new Date(event.start_date);
      const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 3600000); // Default 1 hour

      calendar.createEvent({
        id: event.id,
        start: startDate,
        end: event.all_day ? undefined : endDate,
        allDay: event.all_day === 1,
        summary: event.title,
        description: event.description || `Created by ${event.creator_username}`,
        url: `${req.protocol}://${req.get('host')}/events/${event.id}`
      });
    });

    // Set headers for iCal
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="planny-${userId}.ics"`);
    
    res.send(calendar.toString());
  } catch (error) {
    console.error('Generate iCal error:', error);
    res.status(500).json({ error: 'Failed to generate calendar feed' });
  }
});

module.exports = router;
