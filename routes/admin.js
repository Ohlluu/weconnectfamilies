const express = require('express');
const crypto = require('crypto');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const router = express.Router();

// Twilio client (will be initialized when credentials are provided)
let twilioClient = null;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('📱 Twilio SMS service initialized');
    } else {
        console.log('📱 Twilio credentials not configured - SMS notifications disabled');
    }
} catch (error) {
    console.log('📱 Twilio initialization failed - SMS notifications disabled:', error.message);
}

// Email transporter (Gmail)
let emailTransporter = null;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('📧 Email service initialized');
    } else {
        console.log('📧 Email credentials not configured - Email notifications disabled');
    }
} catch (error) {
    console.log('📧 Email initialization failed - Email notifications disabled:', error.message);
}

// Simple session store (in production, use Redis or database)
const adminSessions = new Map();

// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
        console.log(`🚨 Failed admin login attempt with password: "${password}"`);
        return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session
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

// GET /api/admin/bookings - Get all bookings for admin dashboard
router.get('/bookings', verifyAdminSession, (req, res) => {
    const db = req.app.locals.db;

    db.all(`
        SELECT 
            id,
            name,
            phone,
            email,
            facility,
            visit_date,
            pickup_location,
            guests,
            status,
            created_at,
            confirmed_at,
            notes
        FROM bookings 
        ORDER BY 
            CASE status 
                WHEN 'pending' THEN 1 
                WHEN 'confirmed' THEN 2 
                WHEN 'rejected' THEN 3 
            END,
            visit_date ASC,
            created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch bookings' });
        }

        // Group by status for easier frontend handling
        const groupedBookings = {
            pending: rows.filter(b => b.status === 'pending'),
            confirmed: rows.filter(b => b.status === 'confirmed'),
            rejected: rows.filter(b => b.status === 'rejected')
        };

        res.json({
            success: true,
            bookings: rows,
            grouped: groupedBookings,
            total: rows.length,
            counts: {
                pending: groupedBookings.pending.length,
                confirmed: groupedBookings.confirmed.length,
                rejected: groupedBookings.rejected.length
            }
        });
    });
});

// POST /api/admin/bookings/:id/confirm - Confirm a booking
router.post('/bookings/:id/confirm', verifyAdminSession, async (req, res) => {
    const db = req.app.locals.db;
    const bookingId = req.params.id;

    // Get booking details
    db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], async (err, booking) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch booking' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status === 'confirmed') {
            return res.status(400).json({ error: 'Booking already confirmed' });
        }

        // Update booking status
        db.run(`
            UPDATE bookings 
            SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [bookingId], async function(updateErr) {
            if (updateErr) {
                console.error('Database error:', updateErr);
                return res.status(500).json({ error: 'Failed to confirm booking' });
            }

            console.log(`✅ Booking ${bookingId} confirmed for ${booking.name}`);

            // Send notifications
            const notifications = await sendBookingNotifications(booking, 'confirmed');

            res.json({
                success: true,
                message: 'Booking confirmed successfully',
                booking: { ...booking, status: 'confirmed', confirmed_at: new Date() },
                notifications: notifications
            });
        });
    });
});

// POST /api/admin/bookings/:id/reject - Reject a booking
router.post('/bookings/:id/reject', verifyAdminSession, async (req, res) => {
    const db = req.app.locals.db;
    const bookingId = req.params.id;
    const { reason } = req.body;

    // Get booking details
    db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], async (err, booking) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch booking' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status === 'rejected') {
            return res.status(400).json({ error: 'Booking already rejected' });
        }

        // Update booking status
        db.run(`
            UPDATE bookings 
            SET status = 'rejected', notes = ? 
            WHERE id = ?
        `, [reason || 'Booking rejected by admin', bookingId], async function(updateErr) {
            if (updateErr) {
                console.error('Database error:', updateErr);
                return res.status(500).json({ error: 'Failed to reject booking' });
            }

            console.log(`❌ Booking ${bookingId} rejected for ${booking.name}`);

            // Send notifications
            const notifications = await sendBookingNotifications(booking, 'rejected', reason);

            res.json({
                success: true,
                message: 'Booking rejected successfully',
                booking: { ...booking, status: 'rejected' },
                notifications: notifications
            });
        });
    });
});

// Function to send SMS and Email notifications
async function sendBookingNotifications(booking, action, reason = null) {
    const notifications = { sms: null, email: null };
    
    // Format date nicely
    const visitDate = new Date(booking.visit_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (action === 'confirmed') {
        // SMS Notification
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const smsMessage = `✅ BOOKING CONFIRMED - WE Connect Families

Your transportation to ${booking.facility} on ${visitDate} has been CONFIRMED!

📍 Pickup: ${booking.pickup_location}
👥 Guests: ${booking.guests}

Questions? Call (646) 226-2433
Thank you for choosing WE Connect Families!`;

                const smsResult = await twilioClient.messages.create({
                    body: smsMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: booking.phone
                });

                notifications.sms = { success: true, sid: smsResult.sid };
                console.log(`📱 Confirmation SMS sent to ${booking.phone}`);
            } catch (smsError) {
                console.error('SMS Error:', smsError);
                notifications.sms = { success: false, error: smsError.message };
            }
        }

        // Email Notification
        if (emailTransporter && booking.email) {
            try {
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #0DB7BB, #4ECDC4); color: white; padding: 20px; text-align: center;">
                            <h1>✅ Booking Confirmed!</h1>
                            <p>WE Connect Families Transportation</p>
                        </div>
                        
                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2>Hello ${booking.name},</h2>
                            <p>Great news! Your transportation booking has been <strong>CONFIRMED</strong>.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                <h3>📋 Booking Details:</h3>
                                <ul style="list-style: none; padding: 0;">
                                    <li><strong>📍 Facility:</strong> ${booking.facility}</li>
                                    <li><strong>📅 Date:</strong> ${visitDate}</li>
                                    <li><strong>🚐 Pickup Location:</strong> ${booking.pickup_location}</li>
                                    <li><strong>👥 Number of Guests:</strong> ${booking.guests}</li>
                                </ul>
                            </div>
                            
                            <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Important:</strong> Please arrive 15 minutes early at your pickup location.</p>
                                <p>Questions or need to make changes? Call us at <strong>(646) 226-2433</strong></p>
                            </div>
                            
                            <p>Thank you for choosing WE Connect Families. We look forward to serving you!</p>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <p><strong>WE Connect Families</strong><br>
                                Connecting families since 2014<br>
                                📞 (646) 226-2433</p>
                            </div>
                        </div>
                    </div>
                `;

                await emailTransporter.sendMail({
                    from: `"WE Connect Families" <${process.env.EMAIL_USER}>`,
                    to: booking.email,
                    subject: `✅ Booking Confirmed - ${booking.facility} on ${visitDate}`,
                    html: emailHtml
                });

                notifications.email = { success: true };
                console.log(`📧 Confirmation email sent to ${booking.email}`);
            } catch (emailError) {
                console.error('Email Error:', emailError);
                notifications.email = { success: false, error: emailError.message };
            }
        }
    } else if (action === 'rejected') {
        // SMS Notification for rejection
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const smsMessage = `❌ BOOKING UPDATE - WE Connect Families

Unfortunately, your transportation booking for ${booking.facility} on ${visitDate} could not be confirmed.

${reason ? `Reason: ${reason}` : ''}

Please call (646) 226-2433 to discuss alternatives or reschedule.

Thank you for understanding.`;

                const smsResult = await twilioClient.messages.create({
                    body: smsMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: booking.phone
                });

                notifications.sms = { success: true, sid: smsResult.sid };
                console.log(`📱 Rejection SMS sent to ${booking.phone}`);
            } catch (smsError) {
                console.error('SMS Error:', smsError);
                notifications.sms = { success: false, error: smsError.message };
            }
        }

        // Email Notification for rejection
        if (emailTransporter && booking.email) {
            try {
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; text-align: center;">
                            <h1>Booking Update</h1>
                            <p>WE Connect Families Transportation</p>
                        </div>
                        
                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2>Hello ${booking.name},</h2>
                            <p>We regret to inform you that your transportation booking could not be confirmed at this time.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                <h3>📋 Booking Details:</h3>
                                <ul style="list-style: none; padding: 0;">
                                    <li><strong>📍 Facility:</strong> ${booking.facility}</li>
                                    <li><strong>📅 Date:</strong> ${visitDate}</li>
                                    <li><strong>🚐 Pickup Location:</strong> ${booking.pickup_location}</li>
                                </ul>
                                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                            </div>
                            
                            <div style="background: #fef3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Next Steps:</strong></p>
                                <p>Please call us at <strong>(646) 226-2433</strong> to:</p>
                                <ul>
                                    <li>Discuss alternative dates</li>
                                    <li>Explore other pickup options</li>
                                    <li>Get on our waitlist for cancellations</li>
                                </ul>
                            </div>
                            
                            <p>We apologize for any inconvenience and appreciate your understanding.</p>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <p><strong>WE Connect Families</strong><br>
                                Connecting families since 2014<br>
                                📞 (646) 226-2433</p>
                            </div>
                        </div>
                    </div>
                `;

                await emailTransporter.sendMail({
                    from: `"WE Connect Families" <${process.env.EMAIL_USER}>`,
                    to: booking.email,
                    subject: `Booking Update - ${booking.facility} on ${visitDate}`,
                    html: emailHtml
                });

                notifications.email = { success: true };
                console.log(`📧 Rejection email sent to ${booking.email}`);
            } catch (emailError) {
                console.error('Email Error:', emailError);
                notifications.email = { success: false, error: emailError.message };
            }
        }
    }

    return notifications;
}

// POST /api/admin/logout - Logout admin
router.post('/logout', verifyAdminSession, (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (sessionToken && adminSessions.has(sessionToken)) {
        adminSessions.delete(sessionToken);
    }

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// GET /api/admin/stats - Get booking statistics
router.get('/stats', verifyAdminSession, (req, res) => {
    const db = req.app.locals.db;

    const queries = [
        { name: 'total', sql: 'SELECT COUNT(*) as count FROM bookings' },
        { name: 'pending', sql: 'SELECT COUNT(*) as count FROM bookings WHERE status = "pending"' },
        { name: 'confirmed', sql: 'SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"' },
        { name: 'rejected', sql: 'SELECT COUNT(*) as count FROM bookings WHERE status = "rejected"' },
        { name: 'thisMonth', sql: 'SELECT COUNT(*) as count FROM bookings WHERE date(created_at) >= date("now", "start of month")' },
        { name: 'today', sql: 'SELECT COUNT(*) as count FROM bookings WHERE date(created_at) = date("now")' }
    ];

    const stats = {};
    let completed = 0;

    queries.forEach(query => {
        db.get(query.sql, (err, row) => {
            if (err) {
                console.error(`Stats query error for ${query.name}:`, err);
                stats[query.name] = 0;
            } else {
                stats[query.name] = row.count;
            }

            completed++;
            if (completed === queries.length) {
                res.json({
                    success: true,
                    stats: stats,
                    timestamp: new Date()
                });
            }
        });
    });
});

module.exports = router;