const express = require('express');
const router = express.Router();
const { sendAdminBookingNotification, sendCustomerConfirmation } = require('../services/notificationService');

// POST /api/bookings - Create a new booking
router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const { name, phone, email, facility, visit_date, pickup_location, guests, notes, payment_intent_id, payment_status, adults, children, total_cost, balance_due } = req.body;

    // Validation
    if (!name || !phone || !facility || !visit_date || !pickup_location) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['name', 'phone', 'facility', 'visit_date', 'pickup_location']
        });
    }

    // Insert booking into database with payment info
    const stmt = db.prepare(`
        INSERT INTO bookings (name, phone, email, facility, visit_date, pickup_location, guests, notes, payment_intent_id, payment_status, payment_amount, adults, children, total_cost, balance_due)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const depositAmount = ((adults || 1) + (children || 0)) * 2000; // $20 per seat in cents
    stmt.run([name, phone, email || null, facility, visit_date, pickup_location, guests || 1, notes || null, payment_intent_id || null, payment_status || 'pending', depositAmount, adults || 1, children || 0, total_cost || 0, balance_due || 0], async function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save booking' });
        }

        const bookingId = this.lastID;
        console.log(`📝 New booking created: ID ${bookingId} - ${name} for ${facility}`);

        // Send SMS notification to admin and customer
        const booking = {
            id: bookingId,
            name,
            phone,
            email,
            facility,
            visit_date,
            pickup_location,
            guests: guests || 1,
            notes,
            adults: adults || 1,
            children: children || 0,
            total_cost: total_cost || 0,
            balance_due: balance_due || 0,
            deposit_amount: depositAmount
        };

        // Send SMS notifications (don't wait for them, run in background)
        sendAdminBookingNotification(booking).catch(error => {
            console.error('Failed to send admin SMS notification:', error);
        });

        sendCustomerConfirmation(booking).catch(error => {
            console.error('Failed to send customer SMS notification:', error);
        });

        res.status(201).json({
            success: true,
            bookingId: bookingId,
            message: 'Booking submitted successfully! We will contact you soon to confirm.',
            booking: {
                id: bookingId,
                name,
                phone,
                facility,
                visit_date,
                status: 'pending'
            }
        });
    });

    stmt.finalize();
});

// GET /api/bookings - Get all bookings (admin only - we'll add auth later)
router.get('/', (req, res) => {
    const db = req.app.locals.db;

    db.all(`
        SELECT * FROM bookings 
        ORDER BY visit_date DESC, created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch bookings' });
        }

        res.json({
            success: true,
            bookings: rows,
            total: rows.length
        });
    });
});

// GET /api/bookings/:id - Get specific booking
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    const bookingId = req.params.id;

    db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch booking' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({
            success: true,
            booking: row
        });
    });
});

module.exports = router;