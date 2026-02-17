import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import './QRCodeScanner.css'

export default function QRCodeScanner({ onScanSuccess }) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startScanning = async () => {
    try {
      setError('')
      const html5QrCode = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      )

      setScanning(true)
    } catch (err) {
      setError('Failed to start camera. Please ensure camera permissions are granted.')
      console.error('Scanner error:', err)
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error('Stop scanner error:', err)
      }
      html5QrCodeRef.current = null
    }
    setScanning(false)
  }

  const handleScanSuccess = (qrCodeData) => {
    stopScanning()
    onScanSuccess(qrCodeData)
  }

  return (
    <div className="qr-scanner-container">
      {!scanning ? (
        <button onClick={startScanning} className="start-scan-btn">
          Start Camera
        </button>
      ) : (
        <>
          <div id="qr-reader" className="qr-reader"></div>
          <button onClick={stopScanning} className="stop-scan-btn">
            Stop Scanning
          </button>
        </>
      )}
      {error && <div className="scanner-error">{error}</div>}
    </div>
  )
}
