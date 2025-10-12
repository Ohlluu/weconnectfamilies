const express = require('express');
const router = express.Router();
const { sendAdminBookingNotification } = require('../services/notificationService');

// POST /api/bookings - Create a new booking
router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const { name, phone, email, facility, visit_date, pickup_location, guests, notes } = req.body;

    // Validation
    if (!name || !phone || !facility || !visit_date || !pickup_location) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['name', 'phone', 'facility', 'visit_date', 'pickup_location']
        });
    }

    // Insert booking into database
    const stmt = db.prepare(`
        INSERT INTO bookings (name, phone, email, facility, visit_date, pickup_location, guests, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([name, phone, email || null, facility, visit_date, pickup_location, guests || 1, notes || null], async function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save booking' });
        }

        const bookingId = this.lastID;
        console.log(`📝 New booking created: ID ${bookingId} - ${name} for ${facility}`);

        // Send SMS notification to admin
        const booking = {
            id: bookingId,
            name,
            phone,
            email,
            facility,
            visit_date,
            pickup_location,
            guests: guests || 1,
            notes
        };

        // Send SMS notification (don't wait for it, run in background)
        sendAdminBookingNotification(booking).catch(error => {
            console.error('Failed to send admin SMS notification:', error);
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