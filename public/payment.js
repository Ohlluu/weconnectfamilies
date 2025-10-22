// ==========================================
// STRIPE PAYMENT HANDLER
// ==========================================

let stripe = null;
let elements = null;
let cardElement = null;
let currentPaymentIntent = null;

// Initialize Stripe when page loads
async function initializeStripe() {
    try {
        // Get Stripe publishable key from backend
        const response = await fetch(`${API_BASE}/api/payment/config`);
        const config = await response.json();

        if (!config.publishableKey || !config.available) {
            console.error('Stripe not configured');
            showPaymentError('Payment system not available. Please contact us to complete your booking.');
            return false;
        }

        // Initialize Stripe
        stripe = Stripe(config.publishableKey);

        // Create Stripe Elements
        elements = stripe.elements();

        // Create and mount Card Element
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '"Inter", sans-serif',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                },
                invalid: {
                    color: '#dc3545',
                },
            },
        });

        cardElement.mount('#card-element');

        // Handle real-time validation errors from the card Element
        cardElement.on('change', function(event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
                displayError.classList.add('visible');
            } else {
                displayError.textContent = '';
                displayError.classList.remove('visible');
            }
        });

        console.log('💳 Stripe initialized successfully');
        return true;
    } catch (error) {
        console.error('Stripe initialization error:', error);
        showPaymentError('Failed to initialize payment system. Please refresh the page.');
        return false;
    }
}

// Create Payment Intent
async function createPaymentIntent(bookingData, depositAmount) {
    try {
        const response = await fetch(`${API_BASE}/api/payment/create-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: bookingData.name,
                email: bookingData.email,
                amount: depositAmount * 100 // Convert dollars to cents
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to create payment intent');
        }

        currentPaymentIntent = {
            clientSecret: data.clientSecret,
            paymentIntentId: data.paymentIntentId,
        };

        return currentPaymentIntent;
    } catch (error) {
        console.error('Payment intent creation error:', error);
        throw error;
    }
}

// Process Payment
async function processPayment(clientSecret) {
    try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
            },
        });

        if (error) {
            throw new Error(error.message);
        }

        if (paymentIntent.status === 'succeeded') {
            console.log('💳 Payment succeeded:', paymentIntent.id);
            return {
                success: true,
                paymentIntentId: paymentIntent.id,
                status: 'succeeded',
            };
        } else {
            throw new Error(`Payment status: ${paymentIntent.status}`);
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        throw error;
    }
}

// Show payment error
function showPaymentError(message) {
    const displayError = document.getElementById('card-errors');
    displayError.textContent = message;
    displayError.classList.add('visible');
}

// Clear payment error
function clearPaymentError() {
    const displayError = document.getElementById('card-errors');
    displayError.textContent = '';
    displayError.classList.remove('visible');
}

// Initialize Stripe when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStripe);
} else {
    initializeStripe();
}
