# Quick Start Guide

## Installation

1. **Install all dependencies**:
   ```bash
   npm run install-all
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and change `JWT_SECRET` to a random string (e.g., use `openssl rand -hex 32`)

## Running the App

Start both frontend and backend:
```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## First Steps

1. **Register an account** at http://localhost:3000/register
2. **Upload a profile image** from the Profile page
3. **View your QR code** from Connections or Profile page
4. **Connect with others** by scanning their QR codes
5. **Create events** and share them with your connections
6. **Copy your calendar feed URL** and add it to your calendar app

## Calendar Sync

To sync with Google Calendar, Apple Calendar, or Outlook:

1. Go to Dashboard or Profile page
2. Copy your calendar feed URL
3. In your calendar app:
   - **Google Calendar**: Settings → Add calendar → From URL
   - **Apple Calendar**: File → New Calendar Subscription
   - **Outlook**: Add calendar → Subscribe from web

## Features

✅ QR code-based connections (no invite codes)
✅ Profile image uploads
✅ Event creation and sharing
✅ iCal feed generation
✅ Beautiful, responsive UI

Enjoy using Planny!
