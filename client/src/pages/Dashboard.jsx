import { useState, useEffect, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  isSameDay
} from 'date-fns'
import Layout from '../components/Layout'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const eventsRes = await api.getEvents()
      setEvents(eventsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const recentUpdates = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate))
      .slice(0, 5)
  }, [events])

  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(event => {
      const d = new Date(event.startDate)
      const key = format(d, 'yyyy-MM-dd')
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [events])

  const eventsForSelectedDate = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return events.filter(event => {
      const eventDate = new Date(event.startDate)
      return format(eventDate, 'yyyy-MM-dd') === key
    })
  }, [events, selectedDate])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.username}!</h1>
          <p>Manage your calendar and events</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card dashboard-card-calendar">
            <h2>Upcoming Events</h2>
            <div className="mini-calendar">
              <div className="mini-calendar-header">
                <button
                  type="button"
                  className="mini-calendar-nav"
                  onClick={() => setCalendarMonth(m => subMonths(m, 1))}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="mini-calendar-title">
                  {format(calendarMonth, 'MMMM yyyy')}
                </span>
                <button
                  type="button"
                  className="mini-calendar-nav"
                  onClick={() => setCalendarMonth(m => addMonths(m, 1))}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="mini-calendar-weekdays">
                {weekDays.map(day => (
                  <span key={day} className="mini-calendar-weekday">{day}</span>
                ))}
              </div>
              <div className="mini-calendar-grid">
                {calendarDays.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const count = eventsByDate[dateKey] || 0
                  const inMonth = isSameMonth(day, calendarMonth)
                  const today = isToday(day)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  return (
                    <div
                      key={dateKey}
                      className={`mini-calendar-day ${!inMonth ? 'other-month' : ''} ${today ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <span className="mini-calendar-day-num">{format(day, 'd')}</span>
                      {count > 0 && (
                        <div className="mini-calendar-dots" aria-hidden>
                          {[1, 2, 3].slice(0, Math.min(count, 3)).map(i => (
                            <span key={i} className="mini-calendar-dot" />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {selectedDate && (
              <div className="selected-day-events">
                <h3>
                  Events on {format(selectedDate, 'EEEE d MMMM yyyy')}
                </h3>
                {eventsForSelectedDate.length === 0 ? (
                  <p className="empty-state">No events on this day</p>
                ) : (
                  <div className="events-list">
                    {eventsForSelectedDate.map(event => (
                      <div key={event.id} className="event-item">
                        <div className="event-date">
                          {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="event-details">
                          <h3>{event.title}</h3>
                          {event.description && <p>{event.description}</p>}
                          <span className="event-creator">by {event.creator.username}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {events.length === 0 ? (
              <p className="empty-state">No upcoming events</p>
            ) : (
              <div className="events-list">
                {events.slice(0, 5).map(event => (
                  <div key={event.id} className="event-item">
                    <div className="event-date">
                      {new Date(event.startDate).toLocaleDateString()}
                    </div>
                    <div className="event-details">
                      <h3>{event.title}</h3>
                      {event.description && <p>{event.description}</p>}
                      <span className="event-creator">by {event.creator.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <a href="/events" className="view-all-link">View all events →</a>
          </div>

          <div className="dashboard-card">
            <h2>Recent Updates</h2>
            {recentUpdates.length === 0 ? (
              <p className="empty-state">No recent updates</p>
            ) : (
              <div className="events-list">
                {recentUpdates.map(event => (
                  <div key={event.id} className="event-item">
                    <div className="event-date">
                      {new Date(event.startDate).toLocaleDateString()}
                    </div>
                    <div className="event-details">
                      <h3>{event.title}</h3>
                      {event.description && <p>{event.description}</p>}
                      <span className="event-creator">by {event.creator.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <a href="/events" className="view-all-link">View all events →</a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
