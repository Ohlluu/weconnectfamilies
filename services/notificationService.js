const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;

function initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && accountSid !== 'your_twilio_account_sid_here') {
        twilioClient = twilio(accountSid, authToken);
        console.log('✅ Twilio SMS service initialized');
        return true;
    } else {
        console.log('⚠️ Twilio credentials not configured');
        return false;
    }
}

// Send SMS notification to admin about new booking
async function sendAdminBookingNotification(booking) {
    if (!twilioClient) {
        const initialized = initializeTwilio();
        if (!initialized) {
            console.log('❌ Cannot send SMS - Twilio not configured');
            return { success: false, error: 'Twilio not configured' };
        }
    }

    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!adminPhone || !twilioPhone) {
        console.log('❌ Admin phone or Twilio phone not configured');
        return { success: false, error: 'Phone numbers not configured' };
    }

    // Format the visit date
    const visitDate = new Date(booking.visit_date + 'T00:00:00');
    const formattedDate = visitDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    // Create detailed message
    const message = `📅 NEW BOOKING #${booking.id}

Name: ${booking.name}
Phone: ${booking.phone}
Facility: ${booking.facility}
Date: ${formattedDate}
Pickup: ${booking.pickup_location}
Guests: ${booking.guests || 1}

View: weconnectfam.com`;

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: twilioPhone,
            to: adminPhone
        });

        console.log(`📱 SMS sent to admin for booking #${booking.id} - SID: ${result.sid}`);
        return { success: true, messageSid: result.sid };
    } catch (error) {
        console.error('❌ Failed to send SMS:', error.message);
        return { success: false, error: error.message };
    }
}

// Send SMS confirmation to customer
async function sendCustomerConfirmation(booking) {
    if (!twilioClient) {
        const initialized = initializeTwilio();
        if (!initialized) {
            return { success: false, error: 'Twilio not configured' };
        }
    }

    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioPhone) {
        return { success: false, error: 'Twilio phone not configured' };
    }

    // Format the visit date
    const visitDate = new Date(booking.visit_date + 'T00:00:00');
    const formattedDate = visitDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const message = `✅ WE Connect Families - Booking Confirmed!

Booking #${booking.id}
${booking.facility}
${formattedDate}
Pickup: ${booking.pickup_location}

We'll see you soon! Questions? Call (646) 226-2433`;

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: twilioPhone,
            to: booking.phone
        });

        console.log(`📱 Confirmation SMS sent to ${booking.phone} - SID: ${result.sid}`);
        return { success: true, messageSid: result.sid };
    } catch (error) {
        console.error('❌ Failed to send customer SMS:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initializeTwilio,
    sendAdminBookingNotification,
    sendCustomerConfirmation
};
