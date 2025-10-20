const express = require('express');
const router = express.Router();

// Initialize Stripe
let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('💳 Stripe payment service initialized');
    } else {
        console.log('💳 Stripe not configured - payment processing disabled');
    }
} catch (error) {
    console.log('💳 Stripe initialization failed:', error.message);
}

// POST /api/payment/create-intent - Create a payment intent for $20 deposit
router.post('/create-intent', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({
            error: 'Payment service not available',
            message: 'Stripe is not configured'
        });
    }

    try {
        const { name, email } = req.body;

        // Create a PaymentIntent with $20 amount (2000 cents)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 2000, // $20.00 in cents
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
            error: 'Failed to create payment intent',
            message: error.message
        });
    }
});

// POST /api/payment/verify - Verify payment was successful
router.post('/verify', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({
            error: 'Payment service not available'
        });
    }

    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment intent ID required' });
        }

        // Retrieve the payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        console.log(`💳 Payment verification: ${paymentIntentId} - Status: ${paymentIntent.status}`);

        res.json({
            success: true,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            paid: paymentIntent.status === 'succeeded'
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            error: 'Failed to verify payment',
            message: error.message
        });
    }
});

// GET /api/payment/config - Get publishable key for frontend
router.get('/config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        available: !!stripe
    });
});

module.exports = router;
