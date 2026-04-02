const express = require('express');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
// For local MongoDB: mongodb://localhost:27017/hardware_pos
// For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/hardware_pos
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hardware_pos';

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Import all models
const User = require('./models/User');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const Sale = require('./models/Sale');
const Invoice = require('./models/Invoice');
const Setting = require('./models/Setting');
const Logo = require('./models/Logo');
const Subscription = require('./models/Subscription');

// CORS - Allow frontend to communicate with backend
const cors = require('cors');
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../frontend')));

// Session store - connect-mongo v5 correct syntax
const MongoStore = connectMongo.create(mongoose.connection, {
  ttl: 8 * 60 * 60
});
app.use(session({
  store: MongoStore,
  secret: process.env.SESSION_SECRET || 'hardware-pos-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
}));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin required' });
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/home.html'));
});

// Serve POS app (for logged-in users)
app.get('/pos', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pos.html'));
});

// Serve frontend files for any unmatched routes (SPA routing)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/home.html'));
});

// Public config endpoint for frontend
app.get('/api/config/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

app.get('/api/first-run', async (req, res) => {
  const userCount = await User.countDocuments();
  res.json({ firstRun: userCount === 0 });
});

app.post('/api/first-run', loginLimiter, async (req, res) => {
  if (await User.countDocuments() > 0) {
    return res.status(400).json({ error: 'Already initialised' });
  }

  const { companyName, currency, taxRate, lowStockThreshold, username, password, name } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);
    await Setting.findOneAndUpdate(
      { key: 'app' },
      { companyName, currency, taxRate: parseFloat(taxRate), lowStockThreshold: parseInt(lowStockThreshold) },
      { upsert: true }
    );
    await User.create({ username, password: hash, name, role: 'admin' });
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Setup failed:', e.message, e);
    res.status(500).json({ error: 'Setup failed', details: e.message });
  }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.name = user.name;
    req.session.role = user.role;

    res.json({ id: user._id, username: user.username, name: user.name, role: user.role });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        name: req.session.name,
        role: req.session.role
      }
    });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// Google OAuth authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token, isSignUp, fullName, phone, companyName, plan, amount } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Decode and verify Google token
    let userInfo;
    try {
      // Verify token with Google's servers
      const googleResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`,
        { timeout: 5000 }
      ).catch(() => {
        // If that fails, try verifying with the ID token endpoint
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return { data: payload };
      });
      
      const tokenData = googleResponse.data;
      
      if (!tokenData.email) {
        throw new Error('No email in token');
      }
      
      userInfo = {
        email: tokenData.email,
        name: tokenData.name || tokenData.email.split('@')[0],
        picture: tokenData.picture
      };
    } catch (error) {
      console.error('Token verification error:', error.message);
      // Fallback: try to decode JWT locally
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (!payload.email) {
          throw new Error('No email in token');
        }
        userInfo = {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture
        };
      } catch (decodeError) {
        console.error('Token decode error:', decodeError.message);
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
    }

    if (!userInfo.email) {
      return res.status(400).json({ error: 'No email in token' });
    }

    let user = await User.findOne({ username: userInfo.email });

    if (isSignUp) {
      // Create new account (signup flow)
      if (user) {
        return res.status(400).json({ error: 'Account already exists' });
      }

      // Generate random password for Google sign-ups
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const hash = await bcrypt.hash(tempPassword, 10);

      user = await User.create({
        username: userInfo.email,
        password: hash,
        name: userInfo.name || 'Google User',
        role: 'admin'
      });

      // Create subscription
      if (plan === 'Trial') {
        // Trial account
        const trialExpiryDate = new Date();
        trialExpiryDate.setDate(trialExpiryDate.getDate() + 30);

        const subscription = new Subscription({
          fullName: fullName || userInfo.name || 'Google User',
          email: userInfo.email,
          phone: phone || '',
          companyName: companyName || 'Hardware Store',
          plan: 'Trial',
          amount: 0,
          paymentStatus: 'completed',
          expiryDate: trialExpiryDate,
          daysRemaining: 30,
          active: true,
          trialUsed: true,
          posAccountId: user._id
        });
        await subscription.save();
      } else {
        // Paid plan - pending payment
        const subscription = new Subscription({
          fullName: fullName || userInfo.name || 'Google User',
          email: userInfo.email,
          phone: phone || '',
          companyName: companyName || 'Hardware Store',
          plan: plan || 'Starter',
          amount: amount || 1500,
          paymentStatus: 'pending',
          active: false,
          trialUsed: false,
          posAccountId: user._id
        });
        await subscription.save();
      }

      // Create default settings
      await Setting.findOneAndUpdate(
        { key: 'app' },
        {
          key: 'app',
          companyName: companyName || 'Hardware Store',
          currency: 'KSH',
          taxRate: 10,
          lowStockThreshold: 10
        },
        { upsert: true }
      );
    } else {
      // Login with Google
      if (!user) {
        return res.status(401).json({ error: 'Account not found. Please sign up first.' });
      }
    }

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.name = user.name;
    req.session.role = user.role;

    res.json({
      status: true,
      message: isSignUp ? 'Account created successfully' : 'Logged in successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(500).json({ error: 'Google authentication failed: ' + error.message });
  }
});

// Products
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==================== CUSTOMERS ====================
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch { res.status(500).json({ error: 'Failed to load customers' }); }
});

app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.json(customer);
  } catch (e) { res.status(500).json({ error: 'Failed to add customer' }); }
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(customer);
  } catch { res.status(500).json({ error: 'Failed to update customer' }); }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete customer' }); }
});

// ==================== SUPPLIERS ====================
app.get('/api/suppliers', requireAuth, async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch { res.status(500).json({ error: 'Failed to load suppliers' }); }
});

app.post('/api/suppliers', requireAuth, async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.json(supplier);
  } catch (e) { res.status(500).json({ error: 'Failed to add supplier' }); }
});

app.put('/api/suppliers/:id', requireAuth, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(supplier);
  } catch { res.status(500).json({ error: 'Failed to update supplier' }); }
});

app.delete('/api/suppliers/:id', requireAuth, async (req, res) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete supplier' }); }
});

// ==================== SALES ====================
app.get('/api/sales', requireAuth, async (req, res) => {
  try {
    const sales = await Sale.find();
    res.json(sales);
  } catch { res.status(500).json({ error: 'Failed to load sales' }); }
});

app.post('/api/sales', requireAuth, async (req, res) => {
  try {
    const sale = new Sale(req.body);
    await sale.save();
    res.json(sale);
  } catch (e) { res.status(500).json({ error: 'Failed to add sale' }); }
});

app.put('/api/sales/:id', requireAuth, async (req, res) => {
  try {
    const sale = await Sale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(sale);
  } catch { res.status(500).json({ error: 'Failed to update sale' }); }
});

app.delete('/api/sales/:id', requireAuth, async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete sale' }); }
});

// ==================== INVOICES ====================
app.get('/api/invoices', requireAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find();
    res.json(invoices);
  } catch { res.status(500).json({ error: 'Failed to load invoices' }); }
});

app.post('/api/invoices', requireAuth, async (req, res) => {
  try {
    const invoice = new Invoice(req.body);
    await invoice.save();
    res.json(invoice);
  } catch (e) { res.status(500).json({ error: 'Failed to add invoice' }); }
});

app.put('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(invoice);
  } catch { res.status(500).json({ error: 'Failed to update invoice' }); }
});

app.delete('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete invoice' }); }
});

// ==================== USERS ====================
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch { res.status(500).json({ error: 'Failed to load users' }); }
});

app.get('/api/users/full', requireAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch { res.status(500).json({ error: 'Failed to load users' }); }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const user = new User({ ...req.body, password: hash });
    await user.save();
    res.json(user);
  } catch (e) { res.status(500).json({ error: 'Failed to add user' }); }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, data, { new: true }).select('-password');
    res.json(user);
  } catch { res.status(500).json({ error: 'Failed to update user' }); }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete user' }); }
});

// ==================== SETTINGS ====================
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'app' });
    res.json(setting || {});
  } catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    await Setting.findOneAndUpdate(
      { key: 'app' },
      { key: 'app', ...req.body },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to save settings' }); }
});

// Settings public endpoint
app.get('/api/settings/public', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'app' });
    res.json(setting || {
      companyName: 'Hardware Pro',
      currency: '$',
      taxRate: 0,
      lowStockThreshold: 10
    });
  } catch {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Logo API
app.get('/api/logo/public', async (req, res) => {
  try {
    const logo = await Logo.findOne();
    res.json({ data: logo ? logo.data : '' });
  } catch {
    res.json({ data: '' });
  }
});

app.get('/api/logo', requireAuth, async (req, res) => {
  try {
    const logo = await Logo.findOne();
    res.json(logo || {});
  } catch {
    res.json({});
  }
});

app.put('/api/logo', requireAuth, async (req, res) => {
  try {
    await Logo.findOneAndUpdate({}, { data: req.body.data }, { upsert: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to save logo' });
  }
});

// ==================== PAYMENT ENDPOINTS ====================

// Initialize Paystack payment
app.post('/api/payment/initialize', async (req, res) => {
  try {
    const { fullName, email, phone, companyName, plan, amount } = req.body;

    if (!email || !fullName || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create or get existing subscription
    let subscription = await Subscription.findOne({ email });
    
    if (!subscription) {
      subscription = new Subscription({
        fullName,
        email,
        phone,
        companyName: companyName || 'Hardware Store',
        plan,
        amount,
        paymentStatus: 'pending'
      });
    } else {
      subscription.fullName = fullName;
      subscription.plan = plan;
      subscription.amount = amount;
      subscription.paymentStatus = 'pending';
    }

    // Generate unique reference
    const reference = `HW-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    subscription.paymentReference = reference;
    await subscription.save();

    // Initialize Paystack transaction
    const paystackResponse = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount: amount * 100, // Paystack uses kobo (1 Naira = 100 kobo)
      reference,
      metadata: {
        fullName,
        phone,
        companyName: companyName || 'Hardware Store',
        plan,
        subscriptionId: subscription._id.toString()
      }
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (paystackResponse.data.status) {
      res.json({
        status: true,
        authorizationUrl: paystackResponse.data.data.authorization_url,
        accessCode: paystackResponse.data.data.access_code,
        reference
      });
    } else {
      throw new Error('Paystack initialization failed');
    }
  } catch (error) {
    console.error('Payment initialization error:', error.message);
    res.status(500).json({ error: 'Payment initialization failed: ' + error.message });
  }
});

// Verify Paystack payment
app.get('/api/payment/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const paystackResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    if (!paystackResponse.data.status) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const payment = paystackResponse.data.data;

    // Update subscription
    const subscription = await Subscription.findOne({ paymentReference: reference });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (payment.status === 'success') {
      // Calculate expiry date based on plan
      const days = 30; // 30 days for all plans
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      subscription.paymentStatus = 'completed';
      subscription.transactionId = payment.id;
      subscription.expiryDate = expiryDate;
      subscription.daysRemaining = days;
      subscription.active = true;

      // Create POS user account if not exists
      let user = await User.findOne({ username: subscription.email });
      if (!user) {
        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hash = await bcrypt.hash(tempPassword, 10);

        user = await User.create({
          username: subscription.email,
          password: hash,
          name: subscription.fullName,
          role: 'admin'
        });

        subscription.posAccountId = user._id;
      }

      await subscription.save();

      res.json({
        status: true,
        message: 'Payment verified successfully',
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          expiryDate: subscription.expiryDate,
          daysRemaining: subscription.daysRemaining
        }
      });
    } else {
      subscription.paymentStatus = 'failed';
      await subscription.save();
      res.status(400).json({ error: 'Payment failed', status: payment.status });
    }
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ error: 'Payment verification failed: ' + error.message });
  }
});

// Create trial account
app.post('/api/trial/create', async (req, res) => {
  try {
    const { fullName, email, phone, companyName, plan } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if trial already exists for this email
    const existingSubscription = await Subscription.findOne({ email });
    if (existingSubscription && existingSubscription.plan === 'Trial' && existingSubscription.active) {
      return res.status(400).json({ error: 'Trial account already exists for this email' });
    }

    // Create subscription
    const trialExpiryDate = new Date();
    trialExpiryDate.setDate(trialExpiryDate.getDate() + 30); // 30-day trial

    const subscription = new Subscription({
      fullName,
      email,
      phone,
      companyName: companyName || 'Trial Store',
      plan: 'Trial',
      amount: 0,
      paymentStatus: 'completed',
      expiryDate: trialExpiryDate,
      daysRemaining: 30,
      active: true,
      trialUsed: true
    });

    await subscription.save();

    // Create POS user account
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      username: email,
      password: hash,
      name: fullName,
      role: 'admin'
    });

    subscription.posAccountId = user._id;
    await subscription.save();

    // Create default settings
    await Setting.findOneAndUpdate(
      { key: 'app' },
      {
        key: 'app',
        companyName: companyName || 'Trial Store',
        currency: 'KSH',
        taxRate: 10,
        lowStockThreshold: 10
      },
      { upsert: true }
    );

    res.json({
      status: true,
      message: 'Trial account created successfully',
      credentials: {
        username: email,
        password: tempPassword,
        expiryDate: trialExpiryDate
      },
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        daysRemaining: subscription.daysRemaining
      }
    });
  } catch (error) {
    console.error('Trial creation error:', error.message);
    res.status(500).json({ error: 'Trial creation failed: ' + error.message });
  }
});

// Create account with pay-later subscription
app.post('/api/subscription/pay-later', async (req, res) => {
  try {
    const { fullName, email, phone, companyName, plan, amount } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if account exists
    const existingSubscription = await Subscription.findOne({ email });
    if (existingSubscription && existingSubscription.active) {
      return res.status(400).json({ error: 'Account already exists for this email' });
    }

    // Create subscription with pay-later status
    const trialExpiryDate = new Date();
    trialExpiryDate.setDate(trialExpiryDate.getDate() + 7); // 7 days to pay

    const subscription = new Subscription({
      fullName,
      email,
      phone,
      companyName: companyName || 'Hardware Store',
      plan,
      amount,
      paymentStatus: 'pending',
      expiryDate: trialExpiryDate,
      daysRemaining: 7,
      active: true,
      trialUsed: false
    });

    await subscription.save();

    // Create POS user account
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      username: email,
      password: hash,
      name: fullName,
      role: 'admin'
    });

    subscription.posAccountId = user._id;
    await subscription.save();

    // Create default settings
    await Setting.findOneAndUpdate(
      { key: 'app' },
      {
        key: 'app',
        companyName: companyName || 'Hardware Store',
        currency: 'KSH',
        taxRate: 10,
        lowStockThreshold: 10
      },
      { upsert: true }
    );

    res.json({
      status: true,
      message: 'Account created successfully. Please pay within 7 days.',
      credentials: {
        username: email,
        password: tempPassword,
        expiryDate: trialExpiryDate
      },
      subscription: {
        id: subscription._id,
        plan,
        amount,
        daysRemaining: 7,
        message: 'Pay within 7 days to continue using the system'
      }
    });
  } catch (error) {
    console.error('Pay later creation error:', error.message);
    res.status(500).json({ error: 'Account creation failed: ' + error.message });
  }
});

// Create account for paid plans (without payment - user pays later via Paystack modal)
app.post('/api/subscription/create-account', async (req, res) => {
  try {
    const { fullName, email, phone, companyName, password, plan, amount } = req.body;

    if (!email || !fullName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if account exists
    const existingSubscription = await Subscription.findOne({ email });
    if (existingSubscription && existingSubscription.active) {
      return res.status(400).json({ error: 'Account already exists for this email' });
    }

    // Create subscription pending payment
    const subscription = new Subscription({
      fullName,
      email,
      phone,
      companyName: companyName || 'Hardware Store',
      plan,
      amount,
      paymentStatus: 'pending',
      active: false, // Not active until payment
      trialUsed: false
    });

    await subscription.save();

    // Create POS user account
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: email,
      password: hash,
      name: fullName,
      role: 'admin'
    });

    subscription.posAccountId = user._id;
    await subscription.save();

    // Create default settings
    await Setting.findOneAndUpdate(
      { key: 'app' },
      {
        key: 'app',
        companyName: companyName || 'Hardware Store',
        currency: 'KSH',
        taxRate: 10,
        lowStockThreshold: 10
      },
      { upsert: true }
    );

    res.json({
      status: true,
      message: 'Account created. Please complete payment to activate.',
      credentials: {
        username: email,
        email: email
      },
      subscription: {
        id: subscription._id,
        plan,
        amount,
        paymentStatus: 'pending',
        message: 'Proceed to payment to activate your account'
      }
    });
  } catch (error) {
    console.error('Account creation error:', error.message);
    res.status(500).json({ error: 'Account creation failed: ' + error.message });
  }
});

// Get subscription status
app.get('/api/subscription/status', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ active: false, message: 'Not logged in' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json({ active: false, message: 'User not found' });
    }

    const subscription = await Subscription.findOne({ posAccountId: user._id });

    if (!subscription) {
      return res.json({ active: false, message: 'No subscription found' });
    }

    // Check if subscription has expired
    if (subscription.expiryDate && new Date() > subscription.expiryDate) {
      subscription.active = false;
      await subscription.save();
    }

    const daysRemaining = subscription.expiryDate ? 
      Math.ceil((subscription.expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    // Determine features based on plan
    const features = getPlanFeatures(subscription.plan);

    res.json({
      active: subscription.active,
      plan: subscription.plan,
      expiryDate: subscription.expiryDate,
      daysRemaining: Math.max(0, daysRemaining),
      email: subscription.email,
      companyName: subscription.companyName,
      amount: subscription.amount,
      paymentStatus: subscription.paymentStatus,
      features
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Get plan features
function getPlanFeatures(plan) {
  const features = {
    'Trial': {
      maxProducts: 100,
      maxUsers: 1,
      analytics: 'basic',
      multiUser: false,
      supplierManagement: false,
      customBranding: false,
      priority: false,
      description: '30-day trial with limited features'
    },
    'Starter': {
      maxProducts: 999999,
      maxUsers: 3,
      analytics: 'advanced',
      multiUser: true,
      supplierManagement: false,
      customBranding: false,
      priority: false,
      description: 'Great for small stores'
    },
    'Professional': {
      maxProducts: 999999,
      maxUsers: 10,
      analytics: 'advanced',
      multiUser: true,
      supplierManagement: true,
      customBranding: true,
      priority: true,
      description: 'Perfect for growing businesses'
    },
    'Enterprise': {
      maxProducts: 999999,
      maxUsers: 999999,
      analytics: 'advanced',
      multiUser: true,
      supplierManagement: true,
      customBranding: true,
      priority: true,
      description: 'For large operations'
    }
  };

  return features[plan] || features['Trial'];
}

// Verify feature access
app.post('/api/subscription/verify-feature', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ allowed: false, error: 'Not logged in' });
    }

    const { feature } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ allowed: false, error: 'User not found' });
    }

    const subscription = await Subscription.findOne({ posAccountId: user._id });
    if (!subscription || !subscription.active) {
      return res.status(403).json({ allowed: false, error: 'No active subscription' });
    }

    const features = getPlanFeatures(subscription.plan);
    
    // Check specific features
    const allowed = checkFeatureAccess(feature, features, subscription);

    res.json({ 
      allowed,
      plan: subscription.plan,
      feature,
      daysRemaining: Math.max(0, Math.ceil((subscription.expiryDate - new Date()) / (1000 * 60 * 60 * 24)))
    });
  } catch (error) {
    console.error('Feature verification error:', error);
    res.status(500).json({ allowed: false, error: 'Verification failed' });
  }
});

function checkFeatureAccess(feature, features, subscription) {
  const feature_checks = {
    'multi_user': features.multiUser,
    'supplier_management': features.supplierManagement,
    'custom_branding': features.customBranding,
    'priority_support': features.priority,
    'advanced_analytics': features.analytics === 'advanced'
  };

  return feature_checks[feature] !== false;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mongodb: mongoose.connection.readyState === 1 });
});

app.listen(PORT, () => {
  console.log(`Hardware POS (MongoDB) running at http://localhost:${PORT}`);
});
