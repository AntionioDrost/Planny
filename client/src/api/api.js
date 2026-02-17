import axios from 'axios'

const API_BASE_URL = '/api'

export const api = {
  // Auth
  login: (email, password) => axios.post(`${API_BASE_URL}/auth/login`, { email, password }),
  register: (username, email, password) => axios.post(`${API_BASE_URL}/auth/register`, { username, email, password }),
  getQRCode: (userId) => `${API_BASE_URL}/auth/qr/${userId}`,

  // Users
  getCurrentUser: () => axios.get(`${API_BASE_URL}/users/me`),
  uploadProfileImage: (file) => {
    const formData = new FormData()
    formData.append('image', file)
    return axios.post(`${API_BASE_URL}/users/me/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getUser: (userId) => axios.get(`${API_BASE_URL}/users/${userId}`),

  // Connections
  scanQRCode: (qrCodeData) => axios.post(`${API_BASE_URL}/connections/scan`, { qrCodeData }),
  getConnections: () => axios.get(`${API_BASE_URL}/connections`),
  deleteConnection: (connectionId) => axios.delete(`${API_BASE_URL}/connections/${connectionId}`),

  // Events
  getEvents: () => axios.get(`${API_BASE_URL}/events`),
  createEvent: (eventData) => axios.post(`${API_BASE_URL}/events`, eventData),
  updateEvent: (eventId, eventData) => axios.put(`${API_BASE_URL}/events/${eventId}`, eventData),
  deleteEvent: (eventId) => axios.delete(`${API_BASE_URL}/events/${eventId}`),
  getEvent: (eventId) => axios.get(`${API_BASE_URL}/events/${eventId}`),

  // Calendar
  getCalendarFeed: (userId, token) => `${API_BASE_URL}/calendar/feed/${userId}?token=${token}`
}
