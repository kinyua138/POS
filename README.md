# Hardware POS - Professional Point of Sale System

A full-stack point-of-sale system designed for hardware stores with inventory management, sales analytics, customer profiles, and multi-user support.

## 🏗️ Architecture

This is a **monorepo** with separate frontend and backend services deployed independently:

```
hardware-pos/
├── backend/              # Express.js + MongoDB API Server
│   ├── server.js         # Main server file
│   ├── models/           # MongoDB schemas
│   ├── package.json      # Backend dependencies
│   ├── .env              # Backend configuration
│   ├── render.yaml       # Render deployment config
│   └── README.md         # Backend documentation
│
├── frontend/             # Static files + HTML/CSS/JS
│   ├── home.html         # Landing page & auth
│   ├── pos.html          # Main POS application
│   ├── *.css, *.js       # Styles and logic
│   ├── netlify.toml      # Netlify deployment config
│   ├── .env              # Frontend configuration
│   └── README.md         # Frontend documentation
│
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or [Atlas cloud](https://www.mongodb.com/cloud/atlas))

### Local Development

**Terminal 1 - Backend (API Server):**
```bash
cd backend
npm install
npm start
# Runs on http://localhost:3000
```

**Terminal 2 - Frontend (Web Interface):**
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3001
# Or open frontend/home.html in browser
```

### First-Time Setup

1. Open `http://localhost:3000` or `http://localhost:3001`
2. Click "Start Your Free Trial"
3. Set company details and admin credentials
4. Login with your credentials
5. Access POS at `/pos.html`

## 📦 Tech Stack

### Backend
- **Node.js** + **Express.js** - HTTP server
- **MongoDB** - Cloud database (Atlas)
- **Mongoose** - ODM/validation
- **Bcrypt** - Password hashing
- **JWT/Sessions** - Authentication
- **CORS** - Cross-origin requests

### Frontend
- **HTML5** + **CSS3** + **Vanilla JS**
- **Three.js** - 3D animations
- **GSAP** - Animation framework
- **Google Identity Services** - OAuth 2.0
- **Paystack** - Payment processing

## ✨ Features

- ✅ **Multi-user authentication** with role-based access (Admin, Cashier)
- ✅ **Inventory management** with low-stock alerts
- ✅ **Sales processing** with invoice generation
- ✅ **Customer profiles** and purchase history
- ✅ **Real-time analytics** and sales reports
- ✅ **Google OAuth** sign-in
- ✅ **Paystack** payment integration
- ✅ **3D animations** on landing page
- ✅ **Responsive design** (desktop, tablet, mobile)
- ✅ **Session management** with MongoDB store

## 🔐 Security

- Passwords hashed with Bcrypt (10 rounds)
- Session management with secure cookies
- Rate limiting on authentication endpoints
- CORS protection
- Role-based access control
- Environment variables for sensitive data
- HTTPS ready

## 🌐 Deployment

### One-Click Deployment

#### Backend (Render)

1. Push to GitHub repository
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repository
4. Manual configuration:
   - **Environment**: Node
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Root directory**: `backend`
5. Add environment variables (see below)
6. Deploy

**Get your backend URL** (e.g., `https://hardware-pos-backend.onrender.com`)

#### Frontend (Netlify)

1. Go to [netlify.com](https://netlify.com) → Add new site
2. Select your GitHub repository
3. Build settings:
   - **Build command**: (leave empty)
   - **Publish directory**: `frontend`
4. Deploy

**Frontend auto-redirects `/api/*` calls to your Render backend** via `netlify.toml`

### Environment Variables

#### Backend (.env or Render dashboard)

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/hardware_pos

# Frontend (for CORS)
FRONTEND_URL=https://your-site.netlify.app

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id

# Paystack
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_SECRET_KEY=sk_live_xxx

# Session
SESSION_SECRET=random_secure_string

# Admin Setup
MASTER_USERNAME=emergencyadmin
MASTER_PASSWORD=SecurePassword123!
```

#### Frontend (.env or Netlify build settings)

```env
# API endpoint (automatically set via netlify.toml redirects)
VITE_API_BASE=https://your-backend.onrender.com
```

## 📖 Documentation

- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
- [API Endpoints Reference](#api-endpoints)

## 📊 API Endpoints

### Public
- `GET /` - Landing page (home.html)
- `GET /api/config/google-client-id` - Get Google OAuth client ID
- `GET /api/first-run` - Check if first-time setup
- `POST /api/first-run` - Initial setup

### Authentication
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/session` - Get current session
- `POST /api/auth/google` - Google OAuth callback

### Protected Routes (require login)
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/sales` - List sales
- `POST /api/sales` - Create sale
- `GET /api/customers` - List customers
- `GET /api/reports/summary` - Sales summary
- `GET /api/reports/inventory` - Inventory report

## 🛠️ Development

### Adding Features

1. **Backend**: Add routes in `backend/server.js` or create API modules
2. **Database**: Create/update schemas in `backend/models/`
3. **Frontend**: Update HTML templates and JavaScript in `frontend/`

### Code Structure

```
backend/
  ├── server.js       # All API routes
  ├── db.js           # Database setup
  └── models/         # MongoDB schemas
      ├── User.js
      ├── Product.js
      ├── Sale.js
      ├── Customer.js
      └── Invoice.js

frontend/
  ├── home.html       # Landing & auth
  ├── home.js         # Landing logic
  ├── pos.html        # POS interface
  └── pos.js          # POS logic
```

## 🐛 Troubleshooting

### Backend won't connect to MongoDB
```
Error: MongoDB error: connect ECONNREFUSED

Solution:
1. Check MongoDB is running: `mongosh` or check Atlas
2. Update MONGO_URI in .env
3. Check network/firewall settings
```

### Frontend can't reach backend API
```
Error: Failed to fetch from /api/

Solution:
1. Check backend is Running on port 3000
2. Check CORS is enabled (should be automatic)
3. Check FRONTEND_URL in backend .env
4. Browser console → Network tab for details
```

### Google OAuth not working
```
Error: Error 401: invalid_client, no registered origin

Solution:
1. Go to Google Cloud Console
2. OAuth 2.0 Credentials
3. Add authorized origins:
   - http://localhost:3000 (dev)
   - https://your-domain.netlify.app (prod)
4. Restart backend
```

### Port already in use
```
Error: EADDRINUSE: address already in use :::3000

Solution:
# Find and kill process
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

## 📝 License

MIT License - Free to use and modify

## 👤 Author

**Kinyua Toni**
- Email: kinyuatonny@gmail.com
- GitHub: [@kinyua138](https://github.com/kinyua138)

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📱 Screenshots

Visit [http://localhost:3000](http://localhost:3000) to see:
- 🎨 Modern landing page with 3D animations
- 📧 Email/password and Google OAuth login
- 💰 Pricing plans
- ✨ Feature showcase
- 🏪 Full POS interface with sales, inventory, and reports

---

**Ready to deploy?** Follow the [Deployment](#-deployment) section above!

