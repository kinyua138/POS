# Hardware POS Backend API

Express.js + MongoDB backend for the Hardware POS system.

## Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- npm

## Installation

```bash
cd backend
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/hardware_pos
FRONTEND_URL=http://localhost:3001
GOOGLE_CLIENT_ID=your_client_id
PAYSTACK_PUBLIC_KEY=your_key
PAYSTACK_SECRET_KEY=your_secret
SESSION_SECRET=your_secret
```

## Running Locally

```bash
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/session` - Check session
- `POST /api/first-run` - Initial setup

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Sales
- `POST /api/sales` - Create sale
- `GET /api/sales` - List sales
- `GET /api/invoices/:id` - Get invoice

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer

### Reports
- `GET /api/reports/summary` - Sales summary
- `GET /api/reports/inventory` - Inventory status

## Building for Production

Create executable:

```bash
npm run build
```

## Deployment (Render)

1. Push to GitHub
2. Create new Web Service on [Render](https://render.com)
3. Connect repository
4. Set environment variables in dashboard
5. Deploy

Render will automatically use `render.yaml` configuration.

## Environment Variables Needed on Render

- `MONGO_URI` - MongoDB connection string
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `SESSION_SECRET` - Secure random string
- `FRONTEND_URL` - Your Netlify frontend URL

## Architecture

- Express.js for HTTP server
- MongoDB for data persistence
- Bcrypt for password hashing
- Session management with MongoDB store
- CORS enabled for frontend communication
- Rate limiting on auth endpoints

## License

MIT
