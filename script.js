// Mobile Navigation Toggle
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Close mobile menu when clicking on links
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = target.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Form handling
const bookingForm = document.getElementById('booking-form');
const checkinForm = document.getElementById('checkin-form');

// Booking form submission
if (bookingForm) {
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const bookingData = Object.fromEntries(formData);
        
        // Validate form
        if (!validateBookingForm(bookingData)) {
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Processing...</span>';
        submitBtn.disabled = true;
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate booking ID
            const bookingId = 'WCF-' + Date.now().toString().slice(-6);
            
            // Store booking data
            const booking = {
                id: bookingId,
                ...bookingData,
                timestamp: new Date().toISOString(),
                status: 'confirmed'
            };
            
            storeBooking(booking);
            
            // Send owner notification
            sendOwnerNotification(booking);
            
            // Show success message
            showNotification(
                `Booking confirmed! Your booking ID is ${bookingId}. You will receive confirmation details shortly.`,
                'success'
            );
            
            // Reset form
            this.reset();
            
            // Scroll to check-in section
            setTimeout(() => {
                document.querySelector('.checkin-box').scrollIntoView({
                    behavior: 'smooth'
                });
            }, 1000);
            
        } catch (error) {
            showNotification('Booking failed. Please try again or call (646) 226-2433.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Check-in form submission
if (checkinForm) {
    checkinForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const bookingId = document.getElementById('booking-id').value.trim();
        
        if (!bookingId) {
            showNotification('Please enter your booking ID', 'error');
            return;
        }
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Checking In...';
        submitBtn.disabled = true;
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const booking = getBooking(bookingId);
            
            if (booking) {
                // Update booking status
                updateBookingStatus(bookingId, 'checked-in');
                
                // Send notification
                sendOwnerNotification({
                    ...booking,
                    action: 'checked_in',
                    checkinTime: new Date().toISOString()
                });
                
                showNotification(
                    `Check-in successful! Welcome, ${booking.name}. Have a meaningful visit.`,
                    'success'
                );
                
                // Clear form
                document.getElementById('booking-id').value = '';
            } else {
                showNotification('Booking ID not found. Please check and try again.', 'error');
            }
            
        } catch (error) {
            showNotification('Check-in failed. Please try again or contact us.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Form validation
function validateBookingForm(data) {
    const requiredFields = ['name', 'phone', 'email', 'visitors', 'facility', 'visit-date'];
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
        el.style.borderColor = '#e5e7eb';
    });
    
    requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
            isValid = false;
            showFieldError(field, 'This field is required');
        }
    });
    
    // Email validation
    if (data.email && !isValidEmail(data.email)) {
        isValid = false;
        showFieldError('email', 'Please enter a valid email address');
    }
    
    // Phone validation
    if (data.phone && !isValidPhone(data.phone)) {
        isValid = false;
        showFieldError('phone', 'Please enter a valid phone number');
    }
    
    // Date validation
    if (data['visit-date']) {
        const visitDate = new Date(data['visit-date']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = visitDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        if (visitDate < today) {
            isValid = false;
            showFieldError('visit-date', 'Visit date cannot be in the past');
        } else if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            isValid = false;
            showFieldError('visit-date', 'We only provide transportation on weekends (Saturday and Sunday)');
        } else if (isFederalHoliday(visitDate)) {
            isValid = false;
            showFieldError('visit-date', 'Service not available on federal holidays. Please choose another weekend.');
        }
    }
    
    return isValid;
}

function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    
    field.style.borderColor = '#ef4444';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        font-weight: 500;
    `;
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Booking storage and management
function storeBooking(booking) {
    let bookings = JSON.parse(localStorage.getItem('wcf-bookings') || '[]');
    bookings.push(booking);
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

// Owner notification system
function sendOwnerNotification(booking) {
    const notificationType = booking.notifications || 'email';
    const message = formatOwnerNotification(booking);
    
    // Store notification
    storeNotification({
        type: notificationType,
        message: message,
        booking: booking,
        timestamp: new Date().toISOString()
    });
    
    // In production, send actual SMS/email here
    console.log(`${notificationType.toUpperCase()} Notification:`, message);
}

function formatOwnerNotification(booking) {
    if (booking.action === 'checked_in') {
        return `✅ ${booking.name} has checked in for their visit to ${booking.facility}. Contact: ${booking.phone}`;
    } else {
        return `📅 New booking: ${booking.name} scheduled for ${booking.facility} on ${booking['visit-date']}. Visitors: ${booking.visitors}. Contact: ${booking.phone}. Notifications: ${booking.notifications === 'sms' ? 'SMS' : 'Email'}`;
    }
}

function storeNotification(notification) {
    let notifications = JSON.parse(localStorage.getItem('wcf-notifications') || '[]');
    notifications.unshift(notification);
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
        notifications = notifications.slice(0, 100);
    }
    
    localStorage.setItem('wcf-notifications', JSON.stringify(notifications));
}


// Facility Details Modal (Southern facilities)
const facilityModal = document.getElementById('facility-modal');
const facilityModalClose = document.getElementById('facility-modal-close');

// Northern Facilities Modal
const northernFacilityModal = document.getElementById('northern-facility-modal');
const northernFacilityModalClose = document.getElementById('northern-facility-modal-close');

// Central Facilities Modal
const centralFacilityModal = document.getElementById('central-facility-modal');
const centralFacilityModalClose = document.getElementById('central-facility-modal-close');

// Western Facilities Modal
const westernFacilityModal = document.getElementById('western-facility-modal');
const westernFacilityModalClose = document.getElementById('western-facility-modal-close');

const facilityDetailsButtons = document.querySelectorAll('.facility-details-btn');

// Add click event listeners to all facility detail buttons
facilityDetailsButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        const facility = button.getAttribute('data-facility');
        
        // Show southern facilities modal
        if (facility === 'coxsackie' || facility === 'greene' || facility === 'washington') {
            facilityModal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
        // Show northern facilities modal
        else if (facility === 'clinton' || facility === 'altona' || facility === 'franklin' || 
                 facility === 'barehill' || facility === 'upstate') {
            northernFacilityModal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
        // Show central facilities modal
        else if (facility === 'mohawk' || facility === 'midstate' || facility === 'marcy') {
            centralFacilityModal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
        // Show western facilities modal
        else if (facility === 'collins' || facility === 'lakeview') {
            westernFacilityModal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
    });
});

// Close southern facility modal when clicking X button
if (facilityModalClose) {
    facilityModalClose.addEventListener('click', () => {
        facilityModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scroll
    });
}

// Close northern facility modal when clicking X button
if (northernFacilityModalClose) {
    northernFacilityModalClose.addEventListener('click', () => {
        northernFacilityModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scroll
    });
}

// Close central facility modal when clicking X button
if (centralFacilityModalClose) {
    centralFacilityModalClose.addEventListener('click', () => {
        centralFacilityModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scroll
    });
}

// Close western facility modal when clicking X button
if (westernFacilityModalClose) {
    westernFacilityModalClose.addEventListener('click', () => {
        westernFacilityModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scroll
    });
}

// Close southern facility modal when clicking outside of it
if (facilityModal) {
    facilityModal.addEventListener('click', (e) => {
        if (e.target === facilityModal) {
            facilityModal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scroll
        }
    });
}

// Close northern facility modal when clicking outside of it
if (northernFacilityModal) {
    northernFacilityModal.addEventListener('click', (e) => {
        if (e.target === northernFacilityModal) {
            northernFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scroll
        }
    });
}

// Close central facility modal when clicking outside of it
if (centralFacilityModal) {
    centralFacilityModal.addEventListener('click', (e) => {
        if (e.target === centralFacilityModal) {
            centralFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scroll
        }
    });
}

// Close western facility modal when clicking outside of it
if (westernFacilityModal) {
    westernFacilityModal.addEventListener('click', (e) => {
        if (e.target === westernFacilityModal) {
            westernFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scroll
        }
    });
}


// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const colors = {
        success: '#059669',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 3000;
        max-width: 400px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 1.2rem;">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 6 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 6000);
}

// Animation on scroll
function animateOnScroll() {
    const elements = document.querySelectorAll('.booking-form, .checkin-box, .facility-card, .about-content');
    
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

// Enhanced form interactions
function enhanceFormExperience() {
    // Auto-format phone number
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
            } else if (value.length >= 3) {
                value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
            }
            e.target.value = value;
        });
    }
    
    // Set minimum date for visit date and restrict to weekends only
    const visitDateInput = document.getElementById('visit-date');
    if (visitDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        visitDateInput.min = tomorrow.toISOString().split('T')[0];
        
        // Create a custom date picker that only allows weekends
        setupWeekendOnlyDatePicker(visitDateInput);
    }
    
    // Function to set up weekend-only date picker
    function setupWeekendOnlyDatePicker(input) {
        // Use input event to validate and potentially block invalid selections
        input.addEventListener('input', function() {
            const selectedDate = new Date(this.value + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
            
            if (selectedDate < today) {
                this.value = ''; // Clear invalid selection
                this.setCustomValidity('Visit date cannot be in the past.');
                showFieldError('visit-date', 'Please select a future date');
            } else if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                this.value = ''; // Clear invalid selection
                this.setCustomValidity('We only provide transportation services on weekends (Saturday and Sunday).');
                showFieldError('visit-date', 'Please select a weekend date (Saturday or Sunday)');
            } else if (isFederalHoliday(selectedDate)) {
                this.value = ''; // Clear invalid selection
                this.setCustomValidity('We do not provide services on federal holidays.');
                showFieldError('visit-date', 'Service not available on federal holidays. Please choose another weekend.');
            } else {
                this.setCustomValidity('');
                // Clear any existing error
                const errorMessage = this.parentNode.querySelector('.error-message');
                if (errorMessage) {
                    errorMessage.remove();
                }
                this.style.borderColor = 'rgba(129, 212, 217, 0.3)';
            }
        });
        
        // Add change event as backup
        input.addEventListener('change', function() {
            this.dispatchEvent(new Event('input'));
        });
        
        // Add click event to show helpful message
        input.addEventListener('focus', function() {
            if (!this.value) {
                showTemporaryMessage(this, 'Select any weekend date. Weekdays and holidays will be automatically filtered out.');
            }
        });
    }
    
    // Show temporary helper message
    function showTemporaryMessage(input, message) {
        // Remove existing message
        const existingMessage = input.parentNode.querySelector('.temp-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'temp-message';
        messageDiv.style.cssText = `
            color: #0DB7BB;
            font-size: 0.85rem;
            margin-top: 0.5rem;
            padding: 0.5rem;
            background: rgba(13, 183, 187, 0.1);
            border-radius: 8px;
            border-left: 3px solid #0DB7BB;
        `;
        messageDiv.textContent = message;
        
        input.parentNode.appendChild(messageDiv);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 4000);
    }
    
    // Clear errors on input
    document.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => {
            input.style.borderColor = '#e5e7eb';
            const errorMessage = input.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
    });
}

// Initialize demo data
function initializeDemoData() {
    if (localStorage.getItem('wcf-bookings') === null) {
        const demoBookings = [
            {
                id: 'WCF-001234',
                name: 'Sarah Johnson',
                email: 'sarah.j@email.com',
                phone: '(555) 123-4567',
                facility: 'Clinton Correctional Facility',
                'visit-date': '2025-09-25',
                visitors: '2',
                notifications: 'sms',
                status: 'confirmed',
                timestamp: new Date(Date.now() - 86400000).toISOString() // Yesterday
            },
            {
                id: 'WCF-001235',
                name: 'Michael Rodriguez',
                email: 'mrod@email.com',
                phone: '(555) 987-6543',
                facility: 'Washington Correctional Facility',
                'visit-date': '2025-09-22',
                visitors: '1',
                notifications: 'email',
                status: 'checked-in',
                timestamp: new Date(Date.now() - 172800000).toISOString() // 2 days ago
            },
            {
                id: 'WCF-001236',
                name: 'Jennifer Chen',
                email: 'jchen@email.com',
                phone: '(555) 456-7890',
                facility: 'Coxsackie Correctional Facility',
                'visit-date': '2025-09-28',
                visitors: '3',
                notifications: 'sms',
                status: 'confirmed',
                timestamp: new Date().toISOString() // Today
            }
        ];
        
        localStorage.setItem('wcf-bookings', JSON.stringify(demoBookings));
    }
}

// Pickup locations data based on facilities
const pickupLocationData = {
    // Southern Facilities (4am-5am)
    'Coxsackie Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '4:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '4:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '5:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Greene Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '4:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '4:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '5:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Washington Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '4:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '4:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '5:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    
    // Northern Facilities (12am-12:30am)
    'Clinton Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Altona Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Franklin Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Barehill Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Upstate Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    
    // Central Facilities (2am-3am)
    'Mohawk Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '2:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '2:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '3:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Mid-State Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '2:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '2:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '3:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    'Marcy Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '2:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm' },
        { name: 'Queens: Jamaica Station LIRR', time: '2:15 AM', address: 'Corner of Sutphin BLVD', value: 'queens-jamaica' },
        { name: 'Bronx: 161 McDonald\'s - Yankee Stadium', time: '3:00 AM', address: '51-67 161st St', value: 'bronx-yankee' }
    ],
    
    // Western Facilities (12am-12:30am Sunday Only)
    'Collins Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm', note: 'Sunday Only' },
        { name: 'Bronx: 161 Yankee Stadium Gate 6', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-gate6', note: 'Sunday Only' }
    ],
    'Lakeview Correctional Facility': [
        { name: 'Brooklyn: East New York McDonald\'s', time: '12:00 AM', address: '12 Pennsylvania Avenue', value: 'brooklyn-enm', note: 'Sunday Only' },
        { name: 'Bronx: 161 Yankee Stadium Gate 6', time: '12:30 AM', address: '51-67 161st St', value: 'bronx-gate6', note: 'Sunday Only' }
    ],
    
    // Default for other facilities
    'Riverview Correctional Facility': [
        { name: 'Contact us for pickup information', time: 'TBD', address: 'Call (646) 226-2433', value: 'contact-us' }
    ],
    'Gouverneur Correctional Facility': [
        { name: 'Contact us for pickup information', time: 'TBD', address: 'Call (646) 226-2433', value: 'contact-us' }
    ],
    'Cape Vincent Correctional Facility': [
        { name: 'Contact us for pickup information', time: 'TBD', address: 'Call (646) 226-2433', value: 'contact-us' }
    ]
};

// Function to update pickup locations based on selected facility
function updatePickupLocations() {
    const facilitySelect = document.getElementById('facility');
    const pickupLocationSelect = document.getElementById('pickup-location');
    const pickupTimeInfo = document.getElementById('pickup-time-info');
    
    if (!facilitySelect || !pickupLocationSelect || !pickupTimeInfo) return;
    
    const selectedFacility = facilitySelect.value;
    
    if (!selectedFacility) {
        pickupLocationSelect.disabled = true;
        pickupLocationSelect.innerHTML = '<option value="">First select a facility above...</option>';
        pickupTimeInfo.innerHTML = '<p class="pickup-time-text">Select a facility to see available pickup locations and times</p>';
        return;
    }
    
    const locations = pickupLocationData[selectedFacility] || [];
    
    // Clear and populate pickup location dropdown
    pickupLocationSelect.innerHTML = '<option value="">Choose pickup location...</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.value;
        option.textContent = `${location.name} - ${location.time}`;
        pickupLocationSelect.appendChild(option);
    });
    
    // Enable the dropdown
    pickupLocationSelect.disabled = false;
    
    // Update the time info display
    if (locations.length > 0) {
        let infoHTML = '<div class="pickup-locations-list">';
        infoHTML += '<h4 style="margin: 0 0 0.5rem 0; color: #1f2937; font-size: 1rem;">Available Pickup Locations & Times:</h4>';
        infoHTML += '<p style="margin: 0 0 1rem 0; color: #6b7280; font-size: 0.9rem; font-style: italic;">ℹ️ For reference only - select your pickup location using the dropdown above</p>';
        
        locations.forEach(location => {
            infoHTML += `
                <div class="pickup-location-item">
                    <div>
                        <div class="pickup-location-name">${location.name}</div>
                        <div class="pickup-location-address">📍 ${location.address}</div>
                        ${location.note ? `<div style="color: #f59e0b; font-weight: 600; font-size: 0.8rem; margin-top: 0.25rem;">⚠️ ${location.note}</div>` : ''}
                    </div>
                    <div class="pickup-location-time">${location.time}</div>
                </div>
            `;
        });
        
        infoHTML += '</div>';
        pickupTimeInfo.innerHTML = infoHTML;
    } else {
        pickupTimeInfo.innerHTML = '<p class="pickup-time-text">No pickup locations available for this facility. Please contact us.</p>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDemoData();
    enhanceFormExperience();
    animateOnScroll();
    
    // Set up facility change listener for pickup locations
    const facilitySelect = document.getElementById('facility');
    if (facilitySelect) {
        facilitySelect.addEventListener('change', updatePickupLocations);
    }
    
    // Add loading states to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.type === 'submit') {
                // Let form handler deal with loading state
                return;
            }
        });
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        if (facilityModal && facilityModal.style.display === 'block') {
            facilityModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        if (northernFacilityModal && northernFacilityModal.style.display === 'block') {
            northernFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        if (centralFacilityModal && centralFacilityModal.style.display === 'block') {
            centralFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        if (westernFacilityModal && westernFacilityModal.style.display === 'block') {
            westernFacilityModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
});

// Performance optimization
function optimizePerformance() {
    // Lazy load images if any are added later
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Debounce scroll events
    let scrollTimer;
    const originalScrollHandler = window.onscroll;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            if (originalScrollHandler) originalScrollHandler();
        }, 10);
    });
}

// Federal Holiday Checker
function isFederalHoliday(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const day = date.getDate();
    
    // List of federal holidays that don't change dates
    const fixedHolidays = [
        { month: 0, day: 1 },   // New Year's Day
        { month: 6, day: 4 },   // Independence Day
        { month: 10, day: 11 }, // Veterans Day
        { month: 11, day: 25 }  // Christmas Day
    ];
    
    // Check fixed holidays
    for (const holiday of fixedHolidays) {
        if (month === holiday.month && day === holiday.day) {
            return true;
        }
    }
    
    // Martin Luther King Jr. Day (3rd Monday in January)
    if (month === 0 && isNthWeekdayOfMonth(date, 1, 3)) {
        return true;
    }
    
    // Presidents Day (3rd Monday in February)
    if (month === 1 && isNthWeekdayOfMonth(date, 1, 3)) {
        return true;
    }
    
    // Memorial Day (Last Monday in May)
    if (month === 4 && isLastWeekdayOfMonth(date, 1)) {
        return true;
    }
    
    // Labor Day (1st Monday in September)
    if (month === 8 && isNthWeekdayOfMonth(date, 1, 1)) {
        return true;
    }
    
    // Columbus Day (2nd Monday in October)
    if (month === 9 && isNthWeekdayOfMonth(date, 1, 2)) {
        return true;
    }
    
    // Thanksgiving (4th Thursday in November)
    if (month === 10 && isNthWeekdayOfMonth(date, 4, 4)) {
        return true;
    }
    
    return false;
}

// Helper function to check if date is nth weekday of month
function isNthWeekdayOfMonth(date, weekday, nth) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    
    let daysToAdd = weekday - firstWeekday;
    if (daysToAdd < 0) daysToAdd += 7;
    
    const nthWeekdayDate = 1 + daysToAdd + (nth - 1) * 7;
    return date.getDate() === nthWeekdayDate;
}

// Helper function to check if date is last weekday of month
function isLastWeekdayOfMonth(date, weekday) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    
    let daysToSubtract = lastWeekday - weekday;
    if (daysToSubtract < 0) daysToSubtract += 7;
    
    const lastWeekdayDate = lastDay.getDate() - daysToSubtract;
    return date.getDate() === lastWeekdayDate;
}

// Initialize performance optimizations
optimizePerformance();