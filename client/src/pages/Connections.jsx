import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { api } from '../api/api'
import QRCodeScanner from '../components/QRCodeScanner'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import './Connections.css'

export default function Connections() {
  const { user } = useAuth()
  const [connections, setConnections] = useState([])
  const [showScanner, setShowScanner] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const response = await api.getConnections()
      setConnections(response.data)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScanSuccess = async (qrCodeData) => {
    try {
      await api.scanQRCode(qrCodeData)
      setShowScanner(false)
      loadConnections()
      alert('Connection established!')
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to connect')
    }
  }

  const handleDeleteConnection = async (connectionId) => {
    if (!window.confirm('Are you sure you want to remove this connection?')) {
      return
    }

    try {
      await api.deleteConnection(connectionId)
      loadConnections()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove connection')
    }
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>
  }

  return (
    <Layout>
      <div className="connections-page">
        <div className="page-header">
          <h1>Connections</h1>
          <div className="header-actions">
            <button onClick={() => setShowScanner(!showScanner)} className="action-btn primary">
              {showScanner ? 'Cancel' : 'Scan QR Code'}
            </button>
            <button onClick={() => setShowQRCode(!showQRCode)} className="action-btn">
              {showQRCode ? 'Hide' : 'Show'} My QR Code
            </button>
          </div>
        </div>

        {showQRCode && user && (
          <div className="qr-section">
            <h2>Your QR Code</h2>
            <p>Share this QR code with others to connect</p>
            <div className="qr-container">
              <QRCodeSVG value={user.qrCodeData} size={256} />
            </div>
          </div>
        )}

        {showScanner && (
          <div className="scanner-section">
            <h2>Scan QR Code</h2>
            <p>Point your camera at another user's QR code</p>
            <QRCodeScanner onScanSuccess={handleScanSuccess} />
          </div>
        )}

        <div className="connections-list-section">
          <h2>Your Connections ({connections.length})</h2>
          {connections.length === 0 ? (
            <div className="empty-state">
              <p>No connections yet. Scan a QR code or share yours to get started!</p>
            </div>
          ) : (
            <div className="connections-grid">
              {connections.map(conn => (
                <div key={conn.id} className="connection-card">
                  {conn.profileImage ? (
                    <img src={conn.profileImage} alt={conn.username} className="connection-image" />
                  ) : (
                    <div className="connection-image-placeholder">
                      {conn.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h3>{conn.username}</h3>
                  <p className="connection-date">
                    Connected {new Date(conn.connectedAt).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    className="delete-btn"
                  >
                    Remove Connection
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
