# Hardware POS Frontend

Modern responsive web interface for the Hardware POS system.

## Features

- 🎯 Professional landing page with 3D animations
- 🔐 Google OAuth 2.0 authentication
- 💳 Paystack payment processing
- 📊 Sales dashboard and analytics
- 🛒 Point of sale interface
- 👥 Customer management
- 📦 Inventory tracking

## Technologies

- HTML5, CSS3, JavaScript
- Three.js for 3D animations
- GSAP for animations
- Google Identity Services (OAuth 2.0)

## Local Development

### Prerequisites

- No build step required (static files)
- Optional: Local HTTP server for development

### Running Locally

**Option 1: Direct file access**
```bash
cd frontend
# Open home.html in browser
```

**Option 2: With http-server (recommended for CORS)**
```bash
cd frontend
npm install
npm start
# Opens on http://localhost:3001
```

**Make sure backend is running on `http://localhost:3000`**

## Configuration

Backend API configuration is in `home.js` and `pos.js`:

```javascript
// Development (local backend)
const API_BASE = 'http://localhost:3000';

// Production (Render backend)
const API_BASE = 'https://hardware-pos-backend.onrender.com';
```

**.env file:**
```
VITE_API_BASE=http://localhost:3000
```

## Deployment (Netlify)

### Steps

1. Push to GitHub
2. Connect repository to Netlify
3. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.` (frontend root)
4. Settings → Domain management → Add custom domain (optional)

### Auto-redirect to Backend

`netlify.toml` automatically redirects `/api/*` calls to your Render backend.

## Project Structure

```
frontend/
├── home.html          # Landing page & auth
├── home.css, home.js  # Landing page logic
├── pos.html           # POS application
├── pos.css, pos.js    # POS logic
├── netlify.toml       # Netlify deployment config
├── .env               # Environment variables
└── .gitignore         # Git ignore rules
```

## File Descriptions

- **home.html/js** - Landing page with signup/login, pricing, and features
- **pos.html/js** - Main POS application with sales, inventory, reports
- **home.css** - Styling for landing page and modals
- **pos.css** - Styling for POS interface

## Environment Variables

Create `.env` file:

```env
# API endpoint
VITE_API_BASE=http://localhost:3000
```

## Common Issues

### CORS Errors
- Ensure backend is running
- Check `FRONTEND_URL` in backend `.env` matches frontend URL
- Check backend has CORS enabled

### API 401 Errors
- Session may have expired
- Try logging in again
- Check backend server is running

### Google OAuth Won't Load
- Verify `GOOGLE_CLIENT_ID` in backend `.env`
- Check authorized origins in Google Cloud Console
- Add `http://localhost:3000` and your production domain

## License

MIT
