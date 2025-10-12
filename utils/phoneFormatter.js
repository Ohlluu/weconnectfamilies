/**
 * Format phone number to E.164 format for Twilio
 * Handles various input formats and converts to +1XXXXXXXXXX
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // If it's 10 digits, assume US number and add +1
    if (digitsOnly.length === 10) {
        return `+1${digitsOnly}`;
    }

    // If it's 11 digits starting with 1, add +
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+${digitsOnly}`;
    }

    // If it already starts with +, return as is
    if (phone.startsWith('+')) {
        return phone;
    }

    // Default: try to format it
    return `+${digitsOnly}`;
}

module.exports = { formatPhoneNumber };
