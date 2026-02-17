# Planny

A calendar sharing application designed for polyamorous relationships. Share important dates with your connections through QR code scanning and sync with your preferred calendar app via iCal feeds.

## Features

- **QR Code Connections**: Connect with others by scanning QR codes (no invite codes needed)
- **Profile Images**: Upload and display your profile image to connections
- **Event Management**: Create, edit, and delete calendar events
- **Shared Calendars**: Events can be shared with multiple connections
- **iCal Integration**: Generate .ical feed URLs for syncing with Google Calendar, Apple Calendar, Outlook, and more
- **Beautiful UI**: Modern, responsive design with a gradient theme

## Tech Stack

### Backend
- Node.js + Express
- SQLite database
- JWT authentication
- Multer for image uploads
- QR code generation
- iCal feed generation

### Frontend
- React + Vite
- React Router for navigation
- HTML5 QR Code Scanner
- Responsive CSS design

## Setup

1. **Install dependencies**:
   ```bash
   npm run install-all
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `JWT_SECRET` (use a strong random string in production)

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   This starts both the backend (port 5000) and frontend (port 3000)

4. **Access the app**:
   Open http://localhost:3000 in your browser

## Usage

1. **Register/Login**: Create an account or login
2. **Upload Profile Image**: Go to Profile page and upload your image
3. **Connect with Others**: 
   - Go to Connections page
   - Show your QR code or scan someone else's
   - Connections are established instantly
4. **Create Events**: 
   - Go to Events page
   - Create events and select which connections to share with
5. **Sync Calendar**: 
   - Copy your calendar feed URL from Dashboard or Profile
   - Add it to your preferred calendar app (Google Calendar, Apple Calendar, etc.)

## Project Structure

```
planny/
├── server/
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── uploads/         # Uploaded images
│   ├── database.js      # Database setup
│   └── index.js         # Server entry point
├── client/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── context/     # Auth context
│   │   └── api/         # API client
│   └── ...
└── package.json
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/qr/:userId` - Get QR code image
- `GET /api/users/me` - Get current user
- `POST /api/users/me/image` - Upload profile image
- `POST /api/connections/scan` - Scan QR code to connect
- `GET /api/connections` - Get all connections
- `GET /api/events` - Get user's events
- `POST /api/events` - Create event
- `GET /api/calendar/feed/:userId` - Get iCal feed

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Build the frontend: `npm run build`
3. The server will serve the built frontend automatically
4. Use a process manager like PM2
5. Set up HTTPS for secure connections
6. Use a production database (PostgreSQL recommended)

## License

MIT
