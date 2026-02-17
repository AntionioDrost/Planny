import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

const NavIcon = ({ name, active }) => {
  const fill = active ? '#667eea' : '#666'
  switch (name) {
    case 'dashboard':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    case 'events':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'connections':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'profile':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    default:
      return null
  }
}

export default function Layout({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>Planny</h1>
        </div>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Dashboard
          </Link>
          <Link to="/events" className={location.pathname === '/events' ? 'active' : ''}>
            Events
          </Link>
          <Link to="/connections" className={location.pathname === '/connections' ? 'active' : ''}>
            Connect
          </Link>
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
            Profile
          </Link>
        </div>
        <div className="nav-user">
          {user?.profileImage && (
            <img src={user.profileImage} alt={user.username} className="nav-avatar" />
          )}
          <span className="nav-username">{user?.username}</span>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <NavIcon name="dashboard" active={location.pathname === '/'} />
          <span>Home</span>
        </Link>
        <Link to="/events" className={`bottom-nav-item ${location.pathname === '/events' ? 'active' : ''}`}>
          <NavIcon name="events" active={location.pathname === '/events'} />
          <span>Events</span>
        </Link>
        <Link to="/connections" className={`bottom-nav-item ${location.pathname === '/connections' ? 'active' : ''}`}>
          <NavIcon name="connections" active={location.pathname === '/connections'} />
          <span>Connect</span>
        </Link>
        <Link to="/profile" className={`bottom-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
          <NavIcon name="profile" active={location.pathname === '/profile'} />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  )
}
