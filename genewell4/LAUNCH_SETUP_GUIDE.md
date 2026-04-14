# GeneWell Launch Setup Guide

This guide will help you configure all necessary services for launching GeneWell to production.

## 📋 Prerequisites

Before starting, you'll need:
- A PostgreSQL database (we recommend Neon for serverless deployment)
- An Instamojo account with API credentials
- A Gmail account with an app-specific password
- Node.js 18+ installed

---

## 1. Database Setup (PostgreSQL with Neon)

### Step 1: Create Neon Account and Database

1. Go to [neon.tech](https://neon.tech) and sign up for a free account
2. Create a new project and database
3. Copy your connection string, which will look like:
   ```
   postgresql://username:password@neon.tech:5432/database_name?sslmode=require
   ```

### Step 2: Add DATABASE_URL to Environment

Create a `.env` file in `code/code/genewell-main/`:

```bash
DATABASE_URL=postgresql://username:password@neon.tech:5432/database_name?sslmode=require
```

The database schema will be created automatically when the server starts for the first time.

---

## 2. Instamojo Payment Gateway Setup

### Step 1: Create Instamojo Account

1. Go to [instamojo.com](https://instamojo.com)
2. Sign up for a business account
3. Verify your business information
4. Go to Settings → API & Webhooks

### Step 2: Get Your API Credentials

1. In the API & Webhooks section, you'll find:
   - **Auth Token** (looks like: 8a8xxxxxxxxxxxxxxx)
   - **API Key** (looks like: xxxxxxxxxxxxxxxx)

2. For webhooks:
   - Create a webhook URL: `https://yourdomain.com/api/payments/webhook`
   - Note the **Webhook Secret** (you'll need this)

### Step 3: Add Credentials to .env

Update your `.env` file with:

```bash
INSTAMOJO_AUTH_KEY=your_api_key_here
INSTAMOJO_AUTH_TOKEN=your_auth_token_here
INSTAMOJO_WEBHOOK_SECRET=your_webhook_secret_here
```

### Step 4: Configure Payment Link

In the Instamojo dashboard:
1. Go to "Payment Requests"
2. Set up your payment link: `www.instamojo.com/@yourhandle`
3. This is what users will see when redirected for payment

---

## 3. Gmail Email Service Setup

### Step 1: Enable Gmail App Passwords

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification (enable if not already)
3. Go to Security → App passwords
4. Select "Mail" and "Windows Computer" (or your device)
5. Google will generate a 16-character app password

### Step 2: Add Email Credentials to .env

```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-password
```

**Important:** This is an app-specific password, NOT your regular Gmail password.

### Step 3: Test Email Configuration

Once the server is running, test by making a request to:

```bash
curl -X POST http://localhost:8080/api/payments/send-report-email \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{
    "userId": 1,
    "email": "test@example.com",
    "userName": "John Doe",
    "planName": "Premium Plan",
    "downloadLink": "https://yourdomain.com/download"
  }'
```

---

## 4. Admin Panel Setup

### Step 1: Set Admin Token

Create a secure admin token and add to `.env`:

```bash
ADMIN_TOKEN=your_very_secure_random_token_here
```

Generate a secure token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Access Admin Dashboard

1. Navigate to: `https://yourdomain.com/admin`
2. Enter your `ADMIN_TOKEN`
3. You can now:
   - View all users and their quiz responses
   - Monitor purchases and payments
   - View email logs
   - Export user data as CSV

---

## 5. Application URLs Configuration

Update your `.env` with your deployment URLs:

```bash
# For local development:
APP_URL=http://localhost:5173
SERVER_URL=http://localhost:8080

# For production (replace with your domain):
APP_URL=https://yourdomain.com
SERVER_URL=https://api.yourdomain.com
NODE_ENV=production
```

---

## 6. Complete .env File Example

Here's a complete example of all required environment variables:

```bash
# Database
DATABASE_URL=postgresql://username:password@neon.tech:5432/database_name?sslmode=require

# Instamojo Payment Gateway
INSTAMOJO_AUTH_KEY=your_api_key
INSTAMOJO_AUTH_TOKEN=your_auth_token
INSTAMOJO_WEBHOOK_SECRET=your_webhook_secret

# Gmail Email Service
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_password

# Admin Panel
ADMIN_TOKEN=your_secure_admin_token

# Application URLs
APP_URL=https://yourdomain.com
SERVER_URL=https://api.yourdomain.com
NODE_ENV=production
```

---

## 7. Testing the Complete Flow

### User Journey Test

1. **Quiz Completion**
   - Go to `/quiz`
   - Complete all questions
   - Verify data is stored in database

2. **Plan Selection**
   - Click on a paid plan (requires quiz completion)
   - Select any add-ons
   - Proceed to checkout

3. **Payment Process**
   - Enter email and user information
   - Redirected to Instamojo payment page
   - Complete test payment (Instamojo provides test card: 4111 1111 1111 1111)

4. **Post-Payment**
   - Should redirect to `/payment-success`
   - Verify payment status
   - Download PDF report
   - Check email for confirmation

5. **Admin Dashboard**
   - Go to `/admin`
   - Login with your `ADMIN_TOKEN`
   - Verify user appears in "Users" tab
   - Check "Purchases" tab for order
   - Check "Overview" for updated statistics

---

## 8. Deployment Checklist

Before going live:

- [ ] Database credentials configured and tested
- [ ] Instamojo credentials added and tested with test payments
- [ ] Gmail SMTP credentials working (test email sends)
- [ ] Admin token set to a strong, random value
- [ ] APP_URL and SERVER_URL updated for production
- [ ] NODE_ENV set to "production"
- [ ] SSL certificate configured on domain
- [ ] Webhook URL registered in Instamojo
- [ ] All environment variables added to hosting platform
- [ ] Test full user journey with real payment

---

## 9. Troubleshooting

### Email Not Sending
- Check Gmail app password is correct (not your regular password)
- Verify "Less secure apps" is not blocking in Gmail
- Check server logs for email errors
- Test with `GMAIL_USER` matching the Gmail account used

### Payment Not Processing
- Verify Instamojo credentials are correct
- Check webhook URL is accessible from the internet
- Test with Instamojo test card: 4111 1111 1111 1111
- Check server logs for payment errors

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure Neon database is active
- Check network connection to database server
- Verify IP whitelist if applicable

### Admin Dashboard Access
- Ensure ADMIN_TOKEN is set in environment
- Verify token is being passed in X-Admin-Token header
- Check that database tables were created during first run

---

## 10. Production Deployment (Netlify/Vercel)

### For Netlify:

1. Connect your Git repository
2. Set build command: `npm run build`
3. Set publish directory: `dist/spa`
4. Add environment variables in Netlify dashboard (Settings → Environment)
5. Deploy!

### For Vercel:

1. Import project from Git
2. Add all environment variables in project settings
3. Vercel will auto-detect build configuration
4. Deploy!

---

## 11. Support & Monitoring

### Key Metrics to Monitor

- User signups and quiz completions
- Payment success/failure rates
- Email delivery rates
- Admin dashboard statistics
- Database performance

### Logs to Check

- Server startup logs (verify services initialized)
- API request logs (track user journeys)
- Payment webhook logs (verify Instamojo integration)
- Email service logs (check delivery status)

---

## 12. Security Best Practices

1. **Never commit `.env` file** - add to `.gitignore`
2. **Use strong admin tokens** - use cryptographically secure random generator
3. **Enable HTTPS** - all payment data must be encrypted
4. **Rotate secrets regularly** - especially payment API keys
5. **Monitor admin access** - audit admin dashboard logins
6. **Backup database** - Neon provides automatic backups
7. **Validate all inputs** - server-side validation is in place

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

---

For additional help, contact: support@genewell.com
