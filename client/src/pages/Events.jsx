import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import './Events.css'

export default function Events() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [connections, setConnections] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    allDay: false,
    participantIds: []
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [eventsRes, connectionsRes] = await Promise.all([
        api.getEvents(),
        api.getConnections()
      ])
      setEvents(eventsRes.data)
      setConnections(connectionsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, formData)
      } else {
        await api.createEvent(formData)
      }
      setShowForm(false)
      setEditingEvent(null)
      resetForm()
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save event')
    }
  }

  const handleEdit = async (event) => {
    try {
      const { data: fullEvent } = await api.getEvent(event.id)
      setEditingEvent(fullEvent)
      const startVal = fullEvent.startDate ? String(fullEvent.startDate).slice(0, 16) : ''
      const endVal = fullEvent.endDate ? String(fullEvent.endDate).slice(0, 16) : ''
      setFormData({
        title: fullEvent.title,
        description: fullEvent.description || '',
        startDate: startVal,
        endDate: endVal,
        allDay: fullEvent.allDay,
        participantIds: (fullEvent.participants || [])
          .map(p => p.id)
          .filter(id => id !== user.id) || []
      })
      setShowForm(true)
    } catch (err) {
      console.error(err)
      alert('Could not load event details')
    }
  }

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      await api.deleteEvent(eventId)
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete event')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      allDay: false,
      participantIds: []
    })
  }

  const toggleParticipant = (connectionId) => {
    setFormData(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(connectionId)
        ? prev.participantIds.filter(id => id !== connectionId)
        : [...prev.participantIds, connectionId]
    }))
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>
  }

  return (
    <Layout>
      <div className="events-page">
        <div className="page-header">
          <h1>Events</h1>
          <button onClick={() => { setShowForm(!showForm); resetForm(); setEditingEvent(null); }} className="action-btn primary">
            {showForm ? 'Cancel' : '+ New Event'}
          </button>
        </div>

        {showForm && (
          <div className="event-form-card">
            <h2>{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Event title"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.allDay}
                    onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                  />
                  All-day event
                </label>
              </div>

              <div className="form-group participants-section">
                <label className="participants-section-label">
                  Share this event with
                </label>
                <p className="participants-hint">
                  Select the people who should see this event on their calendar.
                </p>
                {connections.length === 0 ? (
                  <p className="no-connections-message">
                    You have no connections yet. Add someone via the Connections page (scan their QR code) to share events with them.
                  </p>
                ) : (
                  <div className="participants-list">
                    {connections.map(conn => (
                      <label key={conn.id} className="participant-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.participantIds.includes(conn.userId)}
                          onChange={() => toggleParticipant(conn.userId)}
                        />
                        {conn.profileImage ? (
                          <img src={conn.profileImage} alt={conn.username} className="participant-avatar" />
                        ) : (
                          <span className="participant-avatar-placeholder">
                            {conn.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="participant-name">{conn.username}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn">
                {editingEvent ? 'Update Event' : 'Create Event'}
              </button>
            </form>
          </div>
        )}

        <div className="events-list-section">
          {events.length === 0 ? (
            <div className="empty-state">
              <p>No events yet. Create your first event!</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map(event => (
                <div key={event.id} className="event-card">
                  <div className="event-header">
                    <h3>{event.title}</h3>
                    {event.creator.id === user.id && (
                      <div className="event-actions">
                        <button onClick={() => handleEdit(event)} className="edit-btn">Edit</button>
                        <button onClick={() => handleDelete(event.id)} className="delete-btn">Delete</button>
                      </div>
                    )}
                  </div>
                  {event.description && <p className="event-description">{event.description}</p>}
                  <div className="event-meta">
                    <div className="event-date">
                      <strong>Start:</strong> {new Date(event.startDate).toLocaleString()}
                    </div>
                    {event.endDate && (
                      <div className="event-date">
                        <strong>End:</strong> {new Date(event.endDate).toLocaleString()}
                      </div>
                    )}
                    {event.allDay && <span className="all-day-badge">All Day</span>}
                  </div>
                  <div className="event-creator">
                    Created by {event.creator.profileImage && (
                      <img src={event.creator.profileImage} alt={event.creator.username} className="creator-avatar" />
                    )}
                    <span>{event.creator.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
