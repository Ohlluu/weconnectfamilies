const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// MongoDB connection
const { MongoClient } = require('mongodb');

// Twilio SMS setup
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('📱 Twilio SMS initialized');
}

// Stripe setup
let stripe = null;
let stripeAvailable = false;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe');
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    stripeAvailable = true;
    console.log('💳 Stripe initialized successfully');
  } else {
    console.log('⚠️ Stripe not configured - payment endpoints will be disabled');
  }
} catch (error) {
  console.error('❌ Stripe initialization error:', error.message);
  stripe = null;
  stripeAvailable = false;
}

let mongoClient = null;
let db = null;

// Initialize MongoDB connection
async function initializeMongoDB() {
  try {
    if (process.env.MONGODB_URI) {
      console.log('🍃 Connecting to MongoDB Atlas...');
      
      // Add connection options with shorter timeout for Vercel
      const options = {
        serverSelectionTimeoutMS: 10000, // 10 seconds
        connectTimeoutMS: 10000,
        socketTimeoutMS: 10000,
        maxPoolSize: 1, // Minimize connections for serverless
        retryWrites: true,
        retryReads: true
      };
      
      mongoClient = new MongoClient(process.env.MONGODB_URI, options);
      await mongoClient.connect();
      
      // Test the connection
      await mongoClient.db('weconnectfamilies').admin().ping();
      
      db = mongoClient.db('weconnectfamilies');
      console.log('✅ MongoDB connected successfully');
      return true;
    } else {
      console.log('⚠️ MONGODB_URI not found, using fallback storage');
      return false;
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    db = null; // Ensure db is null on failure
    return false;
  }
}

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

// Disable caching for static files - serve fresh files every time
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to admin login
app.use('/api/admin/login', loginLimiter);

// Simple session store
const adminSessions = new Map();

// Fallback storage for when MongoDB is not available
let fallbackData = { bookings: [], nextId: 1 };

// Data storage functions
async function loadBookings() {
  console.log('🔍 loadBookings called');
  
  try {
    // Ensure MongoDB connection is established
    if (!db && process.env.MONGODB_URI) {
      console.log('🔌 No existing connection, initializing MongoDB...');
      const connected = await initializeMongoDB();
      if (!connected) {
        console.log('⚠️ MongoDB initialization failed, using fallback');
        return { ...fallbackData };
      }
    }
    
    if (db) {
      console.log('📡 Querying MongoDB for bookings...');
      
      // Use MongoDB with timeout
      const collection = db.collection('bookings');
      const bookings = await Promise.race([
        collection.find({}).toArray(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MongoDB query timeout')), 15000)
        )
      ]);
      
      // Get next ID
      const metaCollection = db.collection('meta');
      let metaDoc = await metaCollection.findOne({ _id: 'counters' });
      if (!metaDoc) {
        metaDoc = { _id: 'counters', nextId: 1 };
        await metaCollection.insertOne(metaDoc);
      }
      
      console.log(`📊 Loaded ${bookings.length} bookings from MongoDB`);
      return { bookings, nextId: metaDoc.nextId };
    } else {
      // Use fallback storage
      console.log(`📊 Using fallback storage: ${fallbackData.bookings.length} bookings`);
      return { ...fallbackData };
    }
  } catch (error) {
    console.error('❌ Load bookings error:', error.message);
    // Reset db connection on error
    db = null;
    console.log('🔄 Falling back to memory storage');
    return { ...fallbackData };
  }
}

async function saveBookings(data) {
  try {
    // Ensure MongoDB connection is established
    if (!db && process.env.MONGODB_URI) {
      await initializeMongoDB();
    }
    
    if (db) {
      // Use MongoDB
      const collection = db.collection('bookings');
      const metaCollection = db.collection('meta');
      
      // Clear existing bookings and insert new ones
      await collection.deleteMany({});
      if (data.bookings.length > 0) {
        await collection.insertMany(data.bookings);
      }
      
      // Update counter
      await metaCollection.updateOne(
        { _id: 'counters' },
        { $set: { nextId: data.nextId } },
        { upsert: true }
      );
      
      console.log(`💾 Saved ${data.bookings.length} bookings to MongoDB`);
    } else {
      // Use fallback storage
      fallbackData = { ...data };
      console.log(`💾 Saved ${data.bookings.length} bookings to fallback storage`);
    }
  } catch (error) {
    console.error('Save error:', error);
    // For fallback, still save to memory
    fallbackData = { ...data };
    console.log('⚠️ MongoDB save failed, using fallback');
  }
}

// SMS Functions
async function sendConfirmationSMS(booking) {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('⚠️ Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const message = `Hi ${booking.name}!

Your trip to ${booking.facility} has been CONFIRMED! ✅

📅 Visit Date: ${new Date(booking.visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
📍 Pickup: ${booking.pickup_location}
👥 Guests: ${booking.guests || booking.visitors || 1}

IMPORTANT: When you arrive, check in using the SAME NAME you used to book: "${booking.name}"

Check In: https://weconnectfam.com (Click Check In in menu)

Questions? Call (646) 226-2433

Reply STOP to unsubscribe.`;

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: booking.phone
    });

    console.log(`📱 SMS sent to ${booking.phone}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS send error:', error.message);
    return { success: false, error: error.message };
  }
}

// Routes

// Health check endpoint for MongoDB
app.get('/api/health', async (req, res) => {
  try {
    const mongoStatus = process.env.MONGODB_URI ? 'configured' : 'not configured';
    
    if (process.env.MONGODB_URI && !db) {
      await initializeMongoDB();
    }
    
    const dbStatus = db ? 'connected' : 'disconnected';
    
    if (db) {
      // Test query
      const collection = db.collection('bookings');
      const count = await collection.countDocuments();
      
      res.json({
        status: 'ok',
        mongodb: {
          uri: mongoStatus,
          connection: dbStatus,
          bookings_count: count
        },
        timestamp: new Date()
      });
    } else {
      res.json({
        status: 'fallback',
        mongodb: {
          uri: mongoStatus,
          connection: dbStatus,
          error: 'Using fallback storage'
        },
        fallback_bookings: fallbackData.bookings.length,
        timestamp: new Date()
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// ==========================================
// PAYMENT ROUTES (STRIPE)
// ==========================================

// GET /api/payment/config - Get Stripe publishable key
app.get('/api/payment/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    available: stripeAvailable
  });
});

// POST /api/payment/create-intent - Create a payment intent
app.post('/api/payment/create-intent', async (req, res) => {
  try {
    if (!stripeAvailable) {
      return res.status(503).json({
        success: false,
        error: 'Payment system not available'
      });
    }

    const { name, email, amount } = req.body;

    // Validate amount (should be in cents)
    const depositAmount = amount || 2000; // Default to $20 if not provided

    // Create a payment intent with dynamic deposit amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: depositAmount, // Amount in cents (passed from frontend)
      currency: 'usd',
      description: 'WE Connect Families - Transportation Deposit',
      metadata: {
        customer_name: name || 'Unknown',
        customer_email: email || 'Not provided'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`💳 Payment intent created: ${paymentIntent.id} for ${name}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment intent'
    });
  }
});

// POST /api/payment/verify - Verify payment status
app.post('/api/payment/verify', async (req, res) => {
  try {
    if (!stripeAvailable) {
      return res.status(503).json({
        success: false,
        error: 'Payment system not available'
      });
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment Intent ID is required'
      });
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log(`💳 Payment verification: ${paymentIntentId} - Status: ${paymentIntent.status}`);

    res.json({
      success: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      verified: paymentIntent.status === 'succeeded'
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify payment'
    });
  }
});

// POST /api/bookings - Create a new booking
app.post('/api/bookings', async (req, res) => {
  const { name, phone, email, facility, visit_date, pickup_location, guests, notes, payment_intent_id, payment_status } = req.body;

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
      confirmed_at: null,
      payment_intent_id: payment_intent_id || null,
      payment_status: payment_status || 'pending',
      payment_amount: 2000 // $20.00 in cents
    };

    data.bookings.push(booking);
    await saveBookings(data);

    console.log(`📝 New booking created: ID ${booking.id} - ${name} for ${facility}`);

    // Send SMS notification to admin about new booking
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER && process.env.ADMIN_PHONE_NUMBER) {
      try {
        const visitDate = new Date(visit_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const adminMessage = `📅 NEW BOOKING #${booking.id}

Name: ${name}
Phone: ${phone}
Facility: ${facility}
Date: ${visitDate}
Pickup: ${pickup_location}
Guests: ${guests || 1}

View: weconnectfam.com`;

        await twilioClient.messages.create({
          body: adminMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.ADMIN_PHONE_NUMBER
        });

        console.log(`📱 Admin notification sent for booking #${booking.id}`);
      } catch (error) {
        console.error('Failed to send admin notification SMS:', error.message);
      }
    }

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

    // Send SMS confirmation
    const smsResult = await sendConfirmationSMS(booking);

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: booking,
      notifications: {
        sms: smsResult,
        email: { success: false, error: 'Email not configured' }
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

    // Send SMS notification for rejection
    let smsResult = { success: false, error: 'SMS not configured' };
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const visitDate = new Date(booking.visit_date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        const message = `❌ BOOKING UPDATE - WE Connect Families

Unfortunately, your transportation booking for ${booking.facility} on ${visitDate} could not be confirmed.

${reason ? `Reason: ${reason}` : ''}

Please call (646) 226-2433 to discuss alternatives or reschedule.

Thank you for understanding.`;

        const result = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: booking.phone
        });

        smsResult = { success: true, sid: result.sid };
        console.log(`📱 Rejection SMS sent to ${booking.phone}: ${result.sid}`);
      } catch (error) {
        console.error('Rejection SMS error:', error.message);
        smsResult = { success: false, error: error.message };
      }
    }

    res.json({
      success: true,
      message: 'Booking rejected successfully',
      booking: booking,
      notifications: {
        sms: smsResult,
        email: { success: false, error: 'Email not configured' }
      }
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

// Delete booking
app.delete('/api/admin/bookings/:id', verifyAdminSession, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const data = await loadBookings();

    const bookingIndex = data.bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = data.bookings[bookingIndex];

    // Remove booking from array
    data.bookings.splice(bookingIndex, 1);

    await saveBookings(data);

    console.log(`🗑️ Booking ${bookingId} deleted by admin - Customer: ${booking.name}, Facility: ${booking.facility}`);

    res.json({
      success: true,
      message: 'Booking deleted successfully',
      deletedBooking: {
        id: bookingId,
        name: booking.name,
        facility: booking.facility
      }
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
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

// Customer check-in endpoint
app.post('/api/checkin', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const data = await loadBookings();

    // Find booking by name (case-insensitive, partial match)
    const normalizedName = name.trim().toLowerCase();
    const booking = data.bookings.find(b =>
      b.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(b.name.toLowerCase())
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found. Please check your name and try again.' });
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        error: 'Your booking must be confirmed before check-in. Please contact us.'
      });
    }

    // Check if already checked in
    if (booking.checked_in_at) {
      return res.json({
        success: true,
        message: `Welcome back, ${booking.name}! You already checked in at ${new Date(booking.checked_in_at).toLocaleTimeString()}.`,
        booking: booking
      });
    }

    // Mark as checked in
    booking.checked_in_at = new Date().toISOString();

    await saveBookings(data);

    console.log(`✅ Check-in successful: ${booking.name} (Booking ID: ${booking.id})`);

    res.json({
      success: true,
      message: `Check-in successful! Welcome, ${booking.name}. Have a meaningful visit.`,
      booking: {
        id: booking.id,
        name: booking.name,
        facility: booking.facility,
        visit_date: booking.visit_date,
        pickup_location: booking.pickup_location,
        checked_in_at: booking.checked_in_at
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Check-in failed. Please try again.' });
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

// Initialize MongoDB connection on startup
initializeMongoDB();

module.exports = app;