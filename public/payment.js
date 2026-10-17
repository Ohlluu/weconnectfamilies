// ==========================================
// STRIPE PAYMENT HANDLER
// Standard approach: clientSecret from server
// Supports: Apple Pay, Google Pay, Card
// ==========================================

let stripe = null;
let elements = null;
let paymentElement = null;

// Default ceiling for any request the booking flow makes. Without this the browser
// will wait minutes on a stalled connection and the customer just sees a spinner.
const REQUEST_TIMEOUT_MS = 25000;

// Wrapper around fetch that (a) can never hang forever and (b) never shows the
// customer a raw JSON parse error when the server returns an HTML error page.
async function fetchJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });

        // Read as text first. A gateway timeout returns an HTML page, and calling
        // response.json() on that surfaces "Unexpected token '<'" to the customer.
        const body = await response.text();
        let data = null;

        if (body) {
            try {
                data = JSON.parse(body);
            } catch {
                throw new Error(response.ok
                    ? 'The server sent back an unreadable response. Please try again.'
                    : `The server is busy right now (error ${response.status}). Please wait a moment and try again, or call (646) 226-2433.`);
            }
        }

        return { response, data };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('The server took too long to respond. Please check your connection and try again, or call (646) 226-2433.');
        }
        if (error instanceof TypeError) {
            throw new Error('Could not reach the server. Please check your internet connection and try again.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function initializeStripe() {
    try {
        const response = await fetch(`${window.location.origin}/api/payment/config`);
        const config = await response.json();
        if (!config.publishableKey || !config.available) {
            showPaymentError('Payment system not available. Please call (646) 226-2433 to book.');
            return false;
        }
        stripe = Stripe(config.publishableKey);
        console.log('💳 Stripe ready');
        return true;
    } catch (error) {
        console.error('Stripe init error:', error);
        showPaymentError('Failed to load payment system. Please refresh the page.');
        return false;
    }
}

// Step 1: create PaymentIntent on server and get clientSecret
async function createPaymentIntent(bookingData, depositAmount) {
    const { response, data } = await fetchJson(`${window.location.origin}/api/payment/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: bookingData.name,
            email: bookingData.email,
            amount: Math.round(depositAmount * 100)
        })
    });
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to initialize payment');
    return { clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId };
}

// Step 2: mount Payment Element using the clientSecret
async function mountPaymentElement(clientSecret) {
    if (!stripe) throw new Error('Payment system not ready. Please refresh.');

    if (paymentElement) {
        paymentElement.destroy();
        paymentElement = null;
        elements = null;
    }

    elements = stripe.elements({
        clientSecret,
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

// Step 3: confirm payment
async function confirmPayment(bookingData) {
    if (!stripe || !elements) {
        throw new Error('Payment system not ready. Please refresh and try again.');
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
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
        return { success: true, paymentIntentId: paymentIntent.id };
    }

    throw new Error(`Payment not completed. Status: ${paymentIntent?.status}. Please try again.`);
}

// Handle return from 3D Secure bank redirect
function checkRedirectReturn() {
    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get('payment_intent');
    const redirectStatus = params.get('redirect_status');
    if (!paymentIntentId) return null;
    return { paymentIntentId, redirectStatus };
}

function showPaymentError(message) {
    const el = document.getElementById('card-errors');
    if (!el) return;
    el.textContent = '⚠️ ' + message;
    el.classList.add('visible');
    // Scroll to error so user cannot miss it
    setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function clearPaymentError() {
    const el = document.getElementById('card-errors');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visible');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStripe);
} else {
    initializeStripe();
}
