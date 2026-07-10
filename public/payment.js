// ==========================================
// STRIPE PAYMENT ELEMENT HANDLER
// Supports: Apple Pay, Google Pay, Card
// ==========================================

let stripe = null;
let elements = null;
let paymentElement = null;

async function initializeStripe() {
    try {
        const response = await fetch(`${window.location.origin}/api/payment/config`);
        const config = await response.json();

        if (!config.publishableKey || !config.available) {
            console.error('Stripe not configured');
            showPaymentError('Payment system not available. Please contact us to complete your booking.');
            return false;
        }

        stripe = Stripe(config.publishableKey);

        // Mount with default $20 deposit — updated when user selects seats
        mountPaymentElement(2000);

        console.log('💳 Stripe Payment Element initialized (Apple Pay / Google Pay / Card)');
        return true;
    } catch (error) {
        console.error('Stripe initialization error:', error);
        showPaymentError('Failed to initialize payment system. Please refresh the page.');
        return false;
    }
}

function mountPaymentElement(amountInCents) {
    if (!stripe) return;

    if (paymentElement) {
        paymentElement.destroy();
        paymentElement = null;
    }

    elements = stripe.elements({
        mode: 'payment',
        amount: amountInCents,
        currency: 'usd',
        appearance: {
            theme: 'stripe',
            variables: {
                colorPrimary: '#2c5282',
                colorBackground: '#ffffff',
                colorText: '#1a202c',
                colorDanger: '#dc3545',
                fontFamily: 'Inter, system-ui, sans-serif',
                borderRadius: '8px',
                spacingUnit: '4px',
            },
            rules: {
                '.Tab': { border: '1px solid #e2e8f0', boxShadow: 'none' },
                '.Tab:hover': { color: '#2c5282' },
                '.Tab--selected': { borderColor: '#2c5282', boxShadow: '0 0 0 2px #2c5282' },
                '.Input': { border: '1px solid #e2e8f0', boxShadow: 'none' },
                '.Input:focus': { border: '1px solid #2c5282', boxShadow: '0 0 0 2px rgba(44,82,130,0.15)' },
            }
        }
    });

    paymentElement = elements.create('payment', { layout: 'tabs' });
    paymentElement.mount('#payment-element');
}

// Called by calculatePrice() whenever deposit amount changes
function updatePaymentAmount(amountInCents) {
    if (elements) {
        elements.update({ amount: amountInCents });
    }
}

// Main payment function — validates element, creates intent, confirms payment
async function processPayment(bookingData, depositAmount) {
    try {
        // Step 1: Validate the Payment Element fields
        const { error: submitError } = await elements.submit();
        if (submitError) throw new Error(submitError.message);

        // Step 2: Create PaymentIntent on server
        const intentResponse = await fetch(`${window.location.origin}/api/payment/create-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: bookingData.name,
                email: bookingData.email,
                amount: Math.round(depositAmount * 100)
            })
        });

        const intentData = await intentResponse.json();
        if (!intentResponse.ok || !intentData.success) {
            throw new Error(intentData.error || 'Failed to create payment');
        }

        // Step 3: Confirm payment — no redirect for Apple Pay / Google Pay / most cards
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            clientSecret: intentData.clientSecret,
            redirect: 'if_required',
            confirmParams: {
                return_url: window.location.href,
                payment_method_data: {
                    billing_details: {
                        name: bookingData.name,
                        email: bookingData.email || undefined,
                        phone: bookingData.phone || undefined
                    }
                }
            }
        });

        if (error) throw new Error(error.message);

        if (paymentIntent && paymentIntent.status === 'succeeded') {
            console.log('💳 Payment succeeded:', paymentIntent.id);
            return { success: true, paymentIntentId: paymentIntent.id, status: 'succeeded' };
        }

        throw new Error(`Payment incomplete. Status: ${paymentIntent?.status}`);
    } catch (error) {
        console.error('Payment processing error:', error);
        throw error;
    }
}

// Check if customer was redirected back after 3D Secure bank verification
function checkRedirectReturn() {
    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get('payment_intent');
    const redirectStatus = params.get('redirect_status');
    if (!paymentIntentId) return null;
    return { paymentIntentId, redirectStatus };
}

function showPaymentError(message) {
    const el = document.getElementById('card-errors');
    if (el) {
        el.textContent = message;
        el.classList.add('visible');
    }
}

function clearPaymentError() {
    const el = document.getElementById('card-errors');
    if (el) {
        el.textContent = '';
        el.classList.remove('visible');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStripe);
} else {
    initializeStripe();
}
