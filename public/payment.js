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
        const { response, data: config } = await fetchJson(`${window.location.origin}/api/payment/config`, {}, 15000);
        if (!response.ok || !config) throw new Error('Payment configuration unavailable');
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

// Tear the Payment Element down properly. Clearing the container with innerHTML
// instead of this leaves `elements` pointing at a dead iframe, and the next
// confirmPayment() call then hangs forever against a form that is no longer there.
function teardownPaymentElement() {
    if (paymentElement) {
        try {
            paymentElement.destroy();
        } catch (error) {
            console.warn('Payment element teardown:', error.message);
        }
    }
    paymentElement = null;
    elements = null;

    const container = document.getElementById('payment-element');
    if (container) container.innerHTML = '';
}

// Step 2: mount Payment Element using the clientSecret
async function mountPaymentElement(clientSecret) {
    if (!stripe) throw new Error('Payment system not ready. Please refresh.');

    teardownPaymentElement();

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

// How long to let confirmPayment run before asking Stripe what is actually going on,
// and the absolute ceiling before we stop waiting entirely. These are deliberately
// generous: a customer typing a 3D Secure code from their bank is a legitimate wait.
const CONFIRM_POLL_MS = 45000;
const CONFIRM_MAX_WAIT_MS = 240000;

// Ask our server to read the real status straight from Stripe. Returns null if we
// cannot find out, which the caller must treat as "unknown", never as "failed".
async function verifyPaymentStatus(paymentIntentId) {
    if (!paymentIntentId) return null;
    try {
        const { response, data } = await fetchJson(`${window.location.origin}/api/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId })
        }, 15000);

        if (!response.ok || !data?.success) return null;
        return {
            status: data.status,
            succeeded: data.verified ?? data.paid ?? (data.status === 'succeeded')
        };
    } catch (error) {
        console.warn('Payment status check failed:', error.message);
        return null;
    }
}

// Wait for confirmPayment, but never indefinitely. If it stalls we ask Stripe for the
// truth rather than guessing: a real charge is honoured, a real failure is reported as
// one, and a customer still mid-authentication is left alone to finish.
async function awaitPaymentConfirmation(bookingData, paymentIntentId) {
    const confirmPromise = confirmPayment(bookingData);
    // Keep a rejection from going unhandled while we are between races below.
    confirmPromise.catch(() => {});

    const TIMED_OUT = Symbol('timed-out');
    let waited = 0;

    while (waited < CONFIRM_MAX_WAIT_MS) {
        const outcome = await Promise.race([
            confirmPromise,
            new Promise(resolve => setTimeout(() => resolve(TIMED_OUT), CONFIRM_POLL_MS))
        ]);

        // Stripe answered (success, decline, or any other error) — use that.
        if (outcome !== TIMED_OUT) return outcome;

        waited += CONFIRM_POLL_MS;

        const result = await verifyPaymentStatus(paymentIntentId);

        if (result?.succeeded) {
            return { success: true, paymentIntentId };
        }
        if (result && ['requires_payment_method', 'canceled'].includes(result.status)) {
            throw new Error('No payment was taken. Please check your card details and try again.');
        }
        // 'requires_action' or 'processing' means the customer is still authenticating
        // with their bank, so keep waiting rather than interrupting them.
    }

    // Hit the ceiling. One final check decides what the customer is told.
    const final = await verifyPaymentStatus(paymentIntentId);
    if (final?.succeeded) return { success: true, paymentIntentId };
    throw new Error('No payment was taken. Please check your card details and try again.');
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
