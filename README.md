# WE Connect Families - Admin Booking System

A complete booking management system for WE Connect Families transportation service with admin dashboard, SMS/Email notifications, and database storage.

## 🚀 Features

- **Customer Booking Form**: Easy-to-use form with facility selection and date validation
- **Admin Dashboard**: Secure admin interface to view, confirm, and reject bookings
- **SMS Notifications**: Automatic SMS alerts via Twilio (optional)
- **Email Notifications**: Professional email confirmations via Gmail
- **Database Storage**: SQLite database for reliable booking storage
- **Real-time Updates**: Live booking status updates in admin dashboard
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🛠 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   # Copy the example and edit with your credentials
   cp .env.example .env
   nano .env
   ```

3. **Start the server**
   ```bash
   npm start
   # or for development with auto-restart
   npm run dev
   ```

4. **Access the website**
   - Website: http://localhost:3000
   - Admin login: Click the 🔐 icon in the top navigation

## ⚙️ Configuration

### Environment Variables (.env)

```env
# Admin Configuration
ADMIN_PASSWORD=hgt-ASgf83-jkdGS1@
JWT_SECRET=your-super-secret-jwt-key-here

# Twilio SMS Configuration (Optional - ~$2/month)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Email Configuration (Free with Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Setting Up SMS (Twilio) - Optional

1. **Create Twilio Account**
   - Go to [Twilio.com](https://twilio.com)
   - Sign up (free $15 credit included)
   - Get your Account SID and Auth Token from the dashboard

2. **Get Phone Number**
   - Purchase a phone number (~$1.15/month)
   - Add it to your .env file

3. **Costs**: ~$2-3/month total (very affordable)

### Setting Up Email (Gmail) - Free

1. **Enable App Passwords**
   - Go to Google Account Settings
   - Security → 2-Step Verification → App Passwords
   - Generate password for "Mail"

2. **Add to .env file**
   ```env
   EMAIL_USER=youremail@gmail.com
   EMAIL_PASS=your_16_character_app_password
   ```

## 🔐 Admin Usage

### Admin Login
- **URL**: Click the 🔐 icon in navigation
- **Password**: `hgt-ASgf83-jkdGS1@` (configurable in .env)

### Admin Features
- View all bookings sorted by date
- Filter by status (All, Pending, Confirmed, Rejected)
- One-click confirm/reject with automatic notifications
- Real-time statistics dashboard
- Export booking data (coming soon)

### Booking Management
1. **New Booking**: Appears in "Pending" status
2. **Confirm**: Sends SMS + Email confirmation to customer
3. **Reject**: Sends SMS + Email with rejection notice
4. **Status Tracking**: Visual indicators for all booking states

## 📱 Customer Experience

### Booking Process
1. Select correctional facility
2. Choose visit date (weekends + federal holidays only)
3. Pick pickup location (auto-populated based on facility)
4. Enter contact details
5. Submit booking
6. Receive booking ID and confirmation promise

### Notifications
- **Confirmation**: "Your booking is CONFIRMED! Here are your details..."
- **Rejection**: "Unfortunately your booking couldn't be confirmed. Please call..."
- **Both SMS and Email** sent simultaneously (if configured)

## 🗄️ Database

### SQLite Database (database.db)
- **bookings**: Customer booking data
- **admin_sessions**: Admin login sessions

### Booking Fields
- ID, Name, Phone, Email
- Facility, Visit Date, Pickup Location
- Number of Guests, Status, Timestamps
- Admin Notes, Confirmation Date

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Auto-restart on changes
```

### Production Deployment

#### Option 1: Railway (Free Hosting)
1. Push code to GitHub
2. Connect Railway to your GitHub repo
3. Add environment variables in Railway dashboard
4. Deploy automatically

#### Option 2: Render (Free Hosting)
1. Connect GitHub repo to Render
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables

#### Option 3: Your Own Server
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server.js --name "weconnect"

# Setup auto-restart
pm2 startup
pm2 save
```

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 npm start
```

### Database Issues
```bash
# Reset database (WARNING: Deletes all data)
rm database.db
npm start  # Will recreate tables
```

### SMS Not Working
- Check Twilio credentials in .env
- Verify phone number format (+1XXXXXXXXXX)
- Check Twilio account balance

### Email Not Working
- Use Gmail App Password (not regular password)
- Enable 2-Factor Authentication first
- Check Gmail "Less secure apps" setting

## 🎨 Customization

### Branding
- Edit `public/index.html` for content
- Modify `public/styles.css` for styling
- Update logo and colors as needed

### Notification Templates
- Edit templates in `routes/admin.js`
- Customize SMS/Email messages
- Add company branding

### Facility Management
- Add/remove facilities in `public/script.js`
- Update pickup locations and schedules
- Modify validation rules

## 📊 Analytics

### Built-in Tracking
- Booking submissions
- Admin login attempts
- Form interactions
- Error monitoring

### External Analytics (Optional)
- Add Google Analytics to `public/index.html`
- Integrate with your preferred analytics platform

## 🛡️ Security

### Features
- Admin password protection
- Session-based authentication
- Input validation and sanitization
- Rate limiting on admin login
- Environment variable protection

### Best Practices
- Change default admin password
- Use strong JWT secret
- Enable HTTPS in production
- Regular security updates
- Monitor access logs

## 📞 Support

### Common Issues
1. **Can't access admin**: Check admin password in .env
2. **Notifications not sending**: Verify Twilio/Gmail credentials
3. **Database errors**: Check file permissions
4. **Port conflicts**: Use different PORT in .env

### Getting Help
- Check server logs for error messages
- Test API endpoints with Postman
- Verify environment variables are loaded
- Review browser console for frontend errors

## 📈 Scaling

### Performance Tips
- Use PostgreSQL instead of SQLite for higher loads
- Implement Redis for session storage
- Add database indexing
- Use CDN for static assets

### Feature Roadmap
- [ ] Multi-admin support
- [ ] Booking calendar view
- [ ] Customer booking history
- [ ] Payment integration
- [ ] Advanced reporting
- [ ] Mobile app

---

## 💻 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# View logs
pm2 logs weconnect
```

**Need help?** Contact the development team or check the server logs for detailed error information.