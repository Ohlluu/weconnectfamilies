const twilio = require('twilio');
const { formatPhoneNumber } = require('../utils/phoneFormatter');

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
    console.log('🔔 Attempting to send admin notification for booking:', booking.id);

    if (!twilioClient) {
        const initialized = initializeTwilio();
        if (!initialized) {
            console.log('❌ Cannot send SMS - Twilio not configured');
            return { success: false, error: 'Twilio not configured' };
        }
    }

    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    console.log('📱 Admin phone:', adminPhone);
    console.log('📱 Twilio phone:', twilioPhone);

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
        // Format phone numbers to E.164
        const formattedAdminPhone = formatPhoneNumber(adminPhone);
        const formattedTwilioPhone = formatPhoneNumber(twilioPhone);

        console.log('📱 Formatted admin phone:', formattedAdminPhone);
        console.log('📱 Formatted Twilio phone:', formattedTwilioPhone);

        const result = await twilioClient.messages.create({
            body: message,
            from: formattedTwilioPhone,
            to: formattedAdminPhone
        });

        console.log(`✅ Admin SMS sent for booking #${booking.id} - SID: ${result.sid}`);
        return { success: true, messageSid: result.sid };
    } catch (error) {
        console.error('❌ Failed to send admin SMS:', error.message);
        console.error('Full error:', error);
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

    // Format payment amounts (convert from cents to dollars)
    const totalCost = (booking.total_cost / 100).toFixed(2);
    const depositPaid = (booking.deposit_amount / 100).toFixed(2);
    const balanceDue = (booking.balance_due / 100).toFixed(2);

    const message = `✅ WE Connect Families - Booking Confirmed!

Booking #${booking.id}
${booking.facility}
${formattedDate}
Pickup: ${booking.pickup_location}

💰 PAYMENT DETAILS:
Total Trip Contribution: $${totalCost}
Deposit Paid: $${depositPaid}
Balance Due on Trip: $${balanceDue}

⚠️ IMPORTANT: Remaining balance must be paid in CASH on the day of your trip.

Questions? Call (646) 226-2433`;

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
