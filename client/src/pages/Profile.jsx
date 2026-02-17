import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import './Profile.css'

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await api.getCurrentUser()
      setProfile(response.data)
      updateUser(response.data)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      const response = await api.uploadProfileImage(file)
      await loadProfile()
      alert('Profile image updated!')
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const calendarFeedUrl = profile?.calendarToken 
    ? `${window.location.origin}${api.getCalendarFeed(profile.id, profile.calendarToken)}` 
    : ''

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>
  }

  return (
    <Layout>
      <div className="profile-page">
        <div className="profile-header">
          <h1>My Profile</h1>
        </div>

        <div className="profile-content">
          <div className="profile-card">
            <div className="profile-image-section">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt={profile.username} className="profile-image" />
              ) : (
                <div className="profile-image-placeholder">
                  {profile?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="image-upload">
                <label htmlFor="image-upload" className="upload-btn">
                  {uploading ? 'Uploading...' : 'Change Photo'}
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div className="profile-info">
              <h2>{profile?.username}</h2>
              <p className="profile-email">{profile?.email}</p>
              <p className="profile-joined">
                Joined {new Date(profile?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="profile-card">
            <h2>QR Code</h2>
            <p>Share this QR code with others to connect</p>
            <button onClick={() => setShowQRCode(!showQRCode)} className="toggle-qr-btn">
              {showQRCode ? 'Hide' : 'Show'} QR Code
            </button>
            {showQRCode && profile && (
              <div className="qr-container">
                <QRCodeSVG value={profile.qrCodeData} size={256} />
              </div>
            )}
          </div>

          <div className="profile-card">
            <h2>Calendar Feed</h2>
            <p>Sync your Planny calendar with your preferred calendar app</p>
            <div className="calendar-link">
              <input 
                type="text" 
                value={calendarFeedUrl} 
                readOnly 
                className="feed-input"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(calendarFeedUrl)
                  alert('Calendar feed URL copied to clipboard!')
                }}
                className="copy-btn"
              >
                Copy Link
              </button>
            </div>
            <p className="help-text">
              Add this URL to Google Calendar, Apple Calendar, Outlook, or any calendar app that supports iCal feeds.
            </p>
          </div>

          <div className="profile-card profile-logout-section">
            <button onClick={handleLogout} className="logout-btn" type="button">Logout</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
