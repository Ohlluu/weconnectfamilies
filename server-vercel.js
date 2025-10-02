const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Simple persistent storage solution
console.log('🗄️ Using file-based storage for Vercel deployment');

const app = express();

// Rate limiting for admin login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 10, // 10 attempts (increased from 5)
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to admin login
app.use('/api/admin/login', loginLimiter);

// Simple session store
const adminSessions = new Map();

// In-memory storage with backup (works reliably on Vercel)
let bookingsData = { bookings: [], nextId: 1 };
const DATA_FILE = '/tmp/bookings.json';
const fs = require('fs').promises;

// Initialize storage
async function initializeStorage() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    bookingsData = JSON.parse(data);
    console.log(`📊 Loaded ${bookingsData.bookings.length} bookings from storage`);
  } catch (error) {
    console.log('📊 Starting with empty booking database');
    bookingsData = { bookings: [], nextId: 1 };
  }
}

// Data storage functions
async function loadBookings() {
  return { ...bookingsData };
}

async function saveBookings(data) {
  try {
    // Update in-memory storage
    bookingsData = { ...data };
    
    // Also save to file for persistence
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${data.bookings.length} bookings to storage`);
  } catch (error) {
    console.error('Save error:', error);
    // Don't throw error - in-memory storage still works
    console.log('⚠️ File save failed, but booking is in memory');
  }
}

// Routes

// POST /api/bookings - Create a new booking
app.post('/api/bookings', async (req, res) => {
  const { name, phone, email, facility, visit_date, pickup_location, guests, notes } = req.body;

  if (!name || !phone || !facility || !visit_date || !pickup_location) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['name', 'phone', 'facility', 'visit_date', 'pickup_location']
    });
  }

  try {
    const data = await loadBookings();
    
    const booking = {
      id: data.nextId++,
      name,
      phone,
      email: email || null,
      facility,
      visit_date: visit_date, // Keep the date as-is to avoid timezone issues
      pickup_location,
      guests: guests || 1,
      visitors: guests || 1, // Add visitors field for admin display
      notes: notes || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      confirmed_at: null
    };

    data.bookings.push(booking);
    await saveBookings(data);

    console.log(`📝 New booking created: ID ${booking.id} - ${name} for ${facility}`);
    
    res.status(201).json({
      success: true,
      bookingId: booking.id,
      message: 'Booking submitted successfully! We will contact you soon to confirm.',
      booking: {
        id: booking.id,
        name,
        phone,
        facility,
        visit_date,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Save booking error:', error);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password !== (process.env.ADMIN_PASSWORD || 'hgt-ASgf83-jkdGS1@')) {
    console.log(`🚨 Failed admin login attempt with password: "${password}"`);
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate session token
  const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  adminSessions.set(sessionToken, { 
    createdAt: new Date(),
    expiresAt: expiresAt
  });

  console.log('✅ Admin logged in successfully');

  res.json({
    success: true,
    sessionToken: sessionToken,
    expiresAt: expiresAt,
    message: 'Login successful'
  });
});

// Middleware to verify admin session
function verifyAdminSession(req, res, next) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = adminSessions.get(sessionToken);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  if (new Date() > session.expiresAt) {
    adminSessions.delete(sessionToken);
    return res.status(401).json({ error: 'Session expired' });
  }

  req.adminSession = session;
  next();
}

// Get all bookings for admin
app.get('/api/admin/bookings', verifyAdminSession, async (req, res) => {
  try {
    const data = await loadBookings();
    
    const groupedBookings = {
      pending: data.bookings.filter(b => b.status === 'pending'),
      confirmed: data.bookings.filter(b => b.status === 'confirmed'),
      rejected: data.bookings.filter(b => b.status === 'rejected')
    };

    res.json({
      success: true,
      bookings: data.bookings,
      grouped: groupedBookings,
      total: data.bookings.length,
      counts: {
        pending: groupedBookings.pending.length,
        confirmed: groupedBookings.confirmed.length,
        rejected: groupedBookings.rejected.length
      }
    });
  } catch (error) {
    console.error('Load bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Confirm booking
app.post('/api/admin/bookings/:id/confirm', verifyAdminSession, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const data = await loadBookings();
    
    const booking = data.bookings.find(b => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({ error: 'Booking already confirmed' });
    }

    booking.status = 'confirmed';
    booking.confirmed_at = new Date().toISOString();
    
    await saveBookings(data);

    console.log(`✅ Booking ${bookingId} confirmed for ${booking.name}`);

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: booking,
      notifications: { 
        sms: { success: false, error: 'SMS not configured on Vercel' },
        email: { success: false, error: 'Email not configured on Vercel' }
      }
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Reject booking
app.post('/api/admin/bookings/:id/reject', verifyAdminSession, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { reason } = req.body;
    const data = await loadBookings();
    
    const booking = data.bookings.find(b => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'rejected') {
      return res.status(400).json({ error: 'Booking already rejected' });
    }

    booking.status = 'rejected';
    booking.notes = reason || 'Booking rejected by admin';
    
    await saveBookings(data);

    console.log(`❌ Booking ${bookingId} rejected for ${booking.name}`);

    res.json({
      success: true,
      message: 'Booking rejected successfully',
      booking: booking,
      notifications: { 
        sms: { success: false, error: 'SMS not configured on Vercel' },
        email: { success: false, error: 'Email not configured on Vercel' }
      }
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

// Admin stats
app.get('/api/admin/stats', verifyAdminSession, async (req, res) => {
  try {
    const data = await loadBookings();
    
    const stats = {
      total: data.bookings.length,
      pending: data.bookings.filter(b => b.status === 'pending').length,
      confirmed: data.bookings.filter(b => b.status === 'confirmed').length,
      rejected: data.bookings.filter(b => b.status === 'rejected').length,
      thisMonth: data.bookings.filter(b => {
        const created = new Date(b.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      today: data.bookings.filter(b => {
        const created = new Date(b.created_at);
        const now = new Date();
        return created.toDateString() === now.toDateString();
      }).length
    };

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Admin logout
app.post('/api/admin/logout', verifyAdminSession, (req, res) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (sessionToken && adminSessions.has(sessionToken)) {
    adminSessions.delete(sessionToken);
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize storage on startup
initializeStorage();

module.exports = app;