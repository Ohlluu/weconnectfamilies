const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting for admin login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching for development - serve fresh files every time
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve static files (your existing HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to admin login
app.use('/api/admin/login', loginLimiter);

// Routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

// SEO: sitemap.xml
app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database
const db = new sqlite3.Database('./database.db');

// Create tables if they don't exist
db.serialize(() => {
    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        facility TEXT NOT NULL,
        visit_date TEXT NOT NULL,
        pickup_location TEXT NOT NULL,
        guests INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME,
        notes TEXT,
        payment_intent_id TEXT,
        payment_status TEXT DEFAULT 'pending',
        payment_amount INTEGER DEFAULT 2000
    )`);

    // Add payment columns to existing bookings table (if they don't exist)
    db.run(`ALTER TABLE bookings ADD COLUMN payment_intent_id TEXT`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'pending'`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN payment_amount INTEGER DEFAULT 2000`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN adults INTEGER DEFAULT 1`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN children INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN total_cost INTEGER`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN balance_due INTEGER`, () => {});

    // Admin sessions table
    db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_token TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
    )`);

    console.log('Database tables initialized');
});

// Make database available to routes
app.locals.db = db;

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 WE Connect Families server running on http://localhost:${PORT}`);
    console.log(`📱 Admin password: ${process.env.ADMIN_PASSWORD}`);
    console.log(`📊 Database: SQLite (database.db)`);
});

module.exports = app;