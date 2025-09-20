// Mobile Menu Toggle
const mobileMenu = document.querySelector('.mobile-menu');
const navLinks = document.querySelector('.nav-links');

if (mobileMenu && navLinks) {
    mobileMenu.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        mobileMenu.classList.toggle('active');
    });
}

// Smooth Scrolling for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Booking Form Handler
const bookingForm = document.getElementById('booking-form');
if (bookingForm) {
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const bookingData = Object.fromEntries(formData);
        
        // Validate required fields
        const requiredFields = ['name', 'email', 'phone', 'facility', 'visit-date', 'visitor-count'];
        let isValid = true;
        
        requiredFields.forEach(field => {
            const input = document.querySelector(`[name="${field}"]`);
            if (!input || !input.value.trim()) {
                isValid = false;
                if (input) {
                    input.style.borderColor = '#ff6b6b';
                    setTimeout(() => {
                        input.style.borderColor = '#e1e5e9';
                    }, 3000);
                }
            }
        });
        
        if (!isValid) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Simulate booking submission
        showNotification('Processing your booking...', 'info');
        
        setTimeout(() => {
            // Simulate successful booking
            const bookingId = 'WCF-' + Date.now().toString().slice(-6);
            bookingData.id = bookingId;
            bookingData.status = 'confirmed';
            bookingData.timestamp = new Date().toISOString();
            
            // Store booking (in real app, this would go to backend)
            storeBooking(bookingData);
            
            // Send owner notification
            sendOwnerNotification(bookingData);
            
            // Show success message
            showNotification(
                `Booking confirmed! Your booking ID is ${bookingId}. You will receive confirmation details shortly.`, 
                'success'
            );
            
            // Reset form
            bookingForm.reset();
            
            // Scroll to check-in section
            document.querySelector('#check-in').scrollIntoView({
                behavior: 'smooth'
            });
        }, 2000);
    });
}

// Check-in Form Handler
const checkinForm = document.getElementById('checkin-form');
if (checkinForm) {
    checkinForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const bookingId = document.getElementById('booking-id').value.trim();
        
        if (!bookingId) {
            showNotification('Please enter your booking ID', 'error');
            return;
        }
        
        // Simulate check-in process
        showNotification('Checking in...', 'info');
        
        setTimeout(() => {
            // Simulate successful check-in
            const booking = getBooking(bookingId);
            
            if (booking) {
                updateBookingStatus(bookingId, 'completed');
                showNotification(
                    `Check-in successful! Welcome, ${booking.name}. Have a meaningful visit.`, 
                    'success'
                );
                
                // Send owner notification
                sendOwnerNotification({
                    ...booking,
                    action: 'checked_in',
                    checkinTime: new Date().toISOString()
                });
            } else {
                showNotification('Booking ID not found. Please check and try again.', 'error');
            }
            
            // Clear form
            document.getElementById('booking-id').value = '';
        }, 1500);
    });
}

// Admin Dashboard
const adminBtn = document.querySelector('.admin-btn');
const adminModal = document.getElementById('admin-modal');
const closeModal = document.querySelector('.close');

if (adminBtn && adminModal) {
    adminBtn.addEventListener('click', () => {
        updateAdminDashboard();
        adminModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });
}

if (closeModal && adminModal) {
    closeModal.addEventListener('click', () => {
        adminModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
}

// Close modal when clicking outside
if (adminModal) {
    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) {
            adminModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Booking Management Functions
function storeBooking(bookingData) {
    let bookings = JSON.parse(localStorage.getItem('wcf-bookings') || '[]');
    bookings.push(bookingData);
    localStorage.setItem('wcf-bookings', JSON.stringify(bookings));
}

function getBooking(bookingId) {
    const bookings = JSON.parse(localStorage.getItem('wcf-bookings') || '[]');
    return bookings.find(booking => booking.id === bookingId);
}

function updateBookingStatus(bookingId, status) {
    let bookings = JSON.parse(localStorage.getItem('wcf-bookings') || '[]');
    const bookingIndex = bookings.findIndex(booking => booking.id === bookingId);
    
    if (bookingIndex !== -1) {
        bookings[bookingIndex].status = status;
        localStorage.setItem('wcf-bookings', JSON.stringify(bookings));
    }
}

function getAllBookings() {
    return JSON.parse(localStorage.getItem('wcf-bookings') || '[]');
}

// Owner Notification System
function sendOwnerNotification(bookingData) {
    // In a real application, this would send actual notifications
    // For demo purposes, we'll simulate different notification types
    
    const notificationType = bookingData.notifications || 'email';
    const message = formatOwnerNotification(bookingData);
    
    if (notificationType === 'sms') {
        simulateSMSNotification(message);
    } else {
        simulateEmailNotification(message);
    }
    
    // Store notification for admin dashboard
    storeNotification({
        type: notificationType,
        message: message,
        booking: bookingData,
        timestamp: new Date().toISOString()
    });
}

function formatOwnerNotification(bookingData) {
    const action = bookingData.action || 'booked';
    const actionText = action === 'checked_in' ? 'checked in for' : 'booked';
    
    return `New activity: ${bookingData.name} has ${actionText} transportation to ${bookingData.facility} on ${bookingData['visit-date']}. Contact: ${bookingData.phone}`;
}

function simulateSMSNotification(message) {
    console.log('📱 SMS Notification Sent:', message);
    // In production, integrate with Twilio or similar SMS service
}

function simulateEmailNotification(message) {
    console.log('📧 Email Notification Sent:', message);
    // In production, integrate with email service like SendGrid or Mailgun
}

function storeNotification(notification) {
    let notifications = JSON.parse(localStorage.getItem('wcf-notifications') || '[]');
    notifications.unshift(notification); // Add to beginning
    // Keep only last 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    localStorage.setItem('wcf-notifications', JSON.stringify(notifications));
}

// Admin Dashboard Functions
function updateAdminDashboard() {
    const bookings = getAllBookings();
    const notifications = JSON.parse(localStorage.getItem('wcf-notifications') || '[]');
    
    // Update statistics
    const totalBookings = bookings.length;
    const todayBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.timestamp);
        const today = new Date();
        return bookingDate.toDateString() === today.toDateString();
    }).length;
    
    const confirmedBookings = bookings.filter(booking => booking.status === 'confirmed').length;
    const completedVisits = bookings.filter(booking => booking.status === 'completed').length;
    
    // Update dashboard cards
    document.querySelector('#total-bookings .number').textContent = totalBookings;
    document.querySelector('#today-bookings .number').textContent = todayBookings;
    document.querySelector('#confirmed-bookings .number').textContent = confirmedBookings;
    document.querySelector('#completed-visits .number').textContent = completedVisits;
    
    // Update recent bookings list
    updateRecentBookingsList(bookings.slice(0, 10));
}

function updateRecentBookingsList(recentBookings) {
    const bookingsList = document.getElementById('recent-bookings');
    if (!bookingsList) return;
    
    bookingsList.innerHTML = '';
    
    if (recentBookings.length === 0) {
        bookingsList.innerHTML = '<p>No bookings yet.</p>';
        return;
    }
    
    recentBookings.forEach(booking => {
        const bookingItem = document.createElement('div');
        bookingItem.className = 'booking-item';
        
        const notificationType = booking.notifications === 'sms' ? 'SMS 📱' : 'Email 📧';
        
        bookingItem.innerHTML = `
            <h5>${booking.name}</h5>
            <p><strong>Facility:</strong> ${booking.facility}</p>
            <p><strong>Visit Date:</strong> ${booking['visit-date']}</p>
            <p><strong>Visitors:</strong> ${booking['visitor-count']}</p>
            <p><strong>Contact:</strong> ${booking.phone}</p>
            <p><strong>Notifications:</strong> ${notificationType}</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <span class="status ${booking.status}">${booking.status}</span>
        `;
        
        bookingsList.appendChild(bookingItem);
    });
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 3000;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Form Validation Enhancement
function enhanceFormValidation() {
    const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    if (!value) {
        showFieldError(field, 'This field is required');
    } else if (field.type === 'email' && !isValidEmail(value)) {
        showFieldError(field, 'Please enter a valid email address');
    } else if (field.type === 'tel' && !isValidPhone(value)) {
        showFieldError(field, 'Please enter a valid phone number');
    }
}

function showFieldError(field, message) {
    clearFieldError({ target: field });
    
    field.style.borderColor = '#ef4444';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = `
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    `;
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(e) {
    const field = e.target;
    field.style.borderColor = '#e1e5e9';
    
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Animation on Scroll
function animateOnScroll() {
    const elements = document.querySelectorAll('.booking, .facility-card, .about-content');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach(element => {
        observer.observe(element);
    });
}

// PWA-like features for mobile
function initMobileFeatures() {
    // Add to home screen prompt for mobile
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show custom install prompt after user interaction
        setTimeout(() => {
            showInstallPrompt();
        }, 30000); // Show after 30 seconds
    });
    
    // Offline support indication
    window.addEventListener('online', () => {
        showNotification('You are back online!', 'success');
    });
    
    window.addEventListener('offline', () => {
        showNotification('You are currently offline. Some features may not work.', 'warning');
    });
}

function showInstallPrompt() {
    if (deferredPrompt) {
        const installBanner = document.createElement('div');
        installBanner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            text-align: center;
            z-index: 1000;
            transform: translateY(100%);
            transition: transform 0.3s ease;
        `;
        
        installBanner.innerHTML = `
            <p style="margin: 0 0 1rem 0;">Add We Connect Families to your home screen for quick access!</p>
            <button onclick="installApp()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; margin-right: 1rem;">Install</button>
            <button onclick="dismissInstallPrompt()" style="background: transparent; color: white; border: 1px solid rgba(255,255,255,0.3); padding: 0.5rem 1rem; border-radius: 8px;">Not now</button>
        `;
        
        document.body.appendChild(installBanner);
        
        setTimeout(() => {
            installBanner.style.transform = 'translateY(0)';
        }, 100);
        
        // Auto dismiss after 10 seconds
        setTimeout(() => {
            dismissInstallPrompt();
        }, 10000);
    }
}

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') {
                showNotification('App installed successfully!', 'success');
            }
            deferredPrompt = null;
        });
    }
    dismissInstallPrompt();
}

function dismissInstallPrompt() {
    const installBanner = document.querySelector('div[style*="translateY(0)"]');
    if (installBanner) {
        installBanner.style.transform = 'translateY(100%)';
        setTimeout(() => {
            installBanner.remove();
        }, 300);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    enhanceFormValidation();
    animateOnScroll();
    initMobileFeatures();
    
    // Add some demo data for testing
    if (localStorage.getItem('wcf-bookings') === null) {
        const demoBookings = [
            {
                id: 'WCF-001234',
                name: 'Sarah Johnson',
                email: 'sarah.j@email.com',
                phone: '(555) 123-4567',
                facility: 'Sing Sing Correctional Facility',
                'visit-date': '2025-09-25',
                'visitor-count': '2',
                notifications: 'sms',
                status: 'confirmed',
                timestamp: new Date(Date.now() - 86400000).toISOString() // Yesterday
            },
            {
                id: 'WCF-001235',
                name: 'Michael Torres',
                email: 'mik.torres@email.com',
                phone: '(555) 987-6543',
                facility: 'Attica Correctional Facility',
                'visit-date': '2025-09-22',
                'visitor-count': '1',
                notifications: 'email',
                status: 'completed',
                timestamp: new Date(Date.now() - 172800000).toISOString() // 2 days ago
            }
        ];
        
        localStorage.setItem('wcf-bookings', JSON.stringify(demoBookings));
    }
});

// Error handling for the entire application
window.addEventListener('error', function(e) {
    console.error('Application error:', e);
    showNotification('An error occurred. Please refresh the page if problems persist.', 'error');
});

// Smooth performance optimizations
function optimizePerformance() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Debounce scroll events
    let scrollTimer;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            // Handle scroll events here if needed
        }, 100);
    });
}