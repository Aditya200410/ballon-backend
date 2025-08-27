// Improved Express Auth Routes with better structure, security, and async handling
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const TempUser = require('../models/TempUser');
const nodemailer = require('nodemailer');
const axios = require('axios');
const MSG91_AUTHKEY = "458779TNIVxOl3qDwI6866bc33P1";

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// ... (transporter, sendOTPEmail, sendOTPSMS, and auth middleware remain unchanged)
// Setup nodemailer transporter using only EMAIL_USER and EMAIL_PASS
const transporter = nodemailer.createTransport({
  service: 'gmail', // or leave blank for auto
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Email template function
const sendOTPEmail = async (email, otp, customerName, action = 'signup') => {
  const subject = 'Your OTP for Rikocraft Login / Signup';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0; font-size: 24px;">Rikocraft</h1>
          <p style="color: #666; margin: 5px 0; font-size: 14px;">Where heritage meets craftsmanship</p>
        </div>
        
        <div style="margin-bottom: 25px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
            Dear <strong>${customerName}</strong>,
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 15px 0;">
            Thank you for choosing Rikocraft — where heritage meets craftsmanship!
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 15px 0;">
            To proceed with your <strong>${action}</strong>, please use the One-Time Password (OTP) given below:
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
          <p style="color: #333; font-size: 14px; margin: 0 0 10px 0;">🔐 Your OTP is:</p>
          <div style="background-color: #007bff; color: white; padding: 15px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
            ${otp}
          </div>
        </div>
        
        <div style="margin: 25px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
          <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;">
            <strong>⚠️ Important:</strong> This OTP is valid for the next 10 minutes only. Please do not share this code with anyone for your security.
          </p>
        </div>
        
        <div style="margin: 25px 0;">
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not request this OTP, please ignore this email.
          </p>
        </div>
        
        <div style="margin: 25px 0;">
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
            Thank you for being a part of the Rikocraft community!
          </p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.6;">
            <strong>Warm regards,</strong><br>
            Team Rikocraft
          </p>
          <div style="margin-top: 15px; color: #666; font-size: 12px;">
            <p style="margin: 5px 0;">🌐 www.rikocraft.com</p>
            <p style="margin: 5px 0;">📩 Email: Care@Rikocraft.com</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const textBody = `
Dear ${customerName},

Thank you for choosing Rikocraft — where heritage meets craftsmanship!

To proceed with your ${action}, please use the One-Time Password (OTP) given below:

🔐 Your OTP is: ${otp}

This OTP is valid for the next 10 minutes only. Please do not share this code with anyone for your security.

If you did not request this OTP, please ignore this email.

Thank you for being a part of the Rikocraft community!

Warm regards,
Team Rikocraft
🌐 www.rikocraft.com
📩 Email: Care@Rikocraft.com
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: textBody,
      html: htmlBody
    });
    console.log(`OTP email sent to ${email}`);
  } catch (mailErr) {
    console.error('Error sending OTP email:', mailErr);
    throw mailErr;
  }
};

async function sendOTPSMS(phone, otp) {
  if (!phone) return;
  const message = `Your OTP for Rikocraft is: ${otp}`;
  try {
    await axios.post('https://api.msg91.com/api/v2/sendsms', {
      sender: "RIKOCR",
      route: "4",
      country: "91",
      sms: [
        {
          message,
          to: [phone]
        }
      ]
    }, {
      headers: {
        authkey: MSG91_AUTHKEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(`OTP SMS sent to ${phone}`);
  } catch (smsErr) {
    console.error('Error sending OTP SMS:', smsErr.response?.data || smsErr.message);
  }
}

// Middleware to protect routes
const auth = (req, res, next) => {
  // Check for token in Authorization header first
  let token = req.header('Authorization')?.replace('Bearer ', '');
  
  // If not in header, check cookies
  if (!token) {
    token = req.cookies?.token;
  }
  
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// GET /me - Get current user information
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Invalid user' });

    res.json({ user });
  } catch (err) {
    console.error('Error in /me route:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/validate-token', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Invalid user' });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /register (alias for /signup)
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Name, email, password, and phone are required' });
  }
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or phone already registered' });
    }
    // Save user directly after OTP is verified
    const user = new User({ name, email, password, phone });
    await user.save();
    // Log in the user (issue JWT)
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ message: 'Registration complete.', token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Identifier and password are required' });
  }
  try {
    // Check if identifier is an email
    let user;
    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (emailPattern.test(identifier)) {
      user = await User.findOne({ email: identifier });
    } else {
      user = await User.findOne({ phone: identifier });
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================================================================
// START: New Google OAuth Route
// ==================================================================
router.post('/google', async (req, res) => {
    const { access_token } = req.body;

    if (!access_token) {
        return res.status(400).json({ message: 'Google access token is required.' });
    }

    try {
        // 1. Use the access token to get user profile from Google
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const { email, name, picture } = googleResponse.data;

        if (!email) {
            return res.status(400).json({ message: 'Email not provided by Google.' });
        }

        // 2. Find a user in your DB with this email
        let user = await User.findOne({ email });

        // 3. If the user doesn't exist, create a new one
        if (!user) {
            user = new User({
                name,
                email,
                profilePicture: picture,
                isVerified: true, // Email is considered verified via Google
                // Password field is intentionally left empty for OAuth users
            });
            await user.save();
        }

        // 4. Create a JWT for the user (same as your normal login)
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        // 5. Send the token and user data back to the frontend
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone // Will be null for new Google users unless you add a step to collect it
            }
        });

    } catch (err) {
        console.error('Error in Google OAuth route:', err.response ? err.response.data : err.message);
        res.status(500).json({ message: 'Server error during Google authentication.' });
    }
});
// ==================================================================
// END: New Google OAuth Route
// ==================================================================


// POST /forgot-password (send OTP for password reset)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'No user found with this email' });
    }
    // Generate OTP and expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    // Save OTP and expiry in TempUser (or create if not exists)
    let temp = await TempUser.findOne({ email });
    if (!temp) {
      temp = await TempUser.create({ email, otp, otpExpires: expiresAt });
    } else {
      temp.otp = otp;
      temp.otpExpires = expiresAt;
      await temp.save();
    }
    
    // Send OTP via email with new template
    try {
      await sendOTPEmail(email, otp, user.name, 'password reset');
    } catch (mailErr) {
      console.error('Error sending password reset OTP email:', mailErr);
      // Don't fail the request if email fails
    }
    
    return res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Error processing password reset request' });
  }
});

// POST /verify-forgot-otp (verify OTP and set new password)
router.post('/verify-forgot-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }
  try {
    const temp = await TempUser.findOne({ email });
    if (!temp || temp.otp !== otp || !temp.otpExpires || temp.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'No user found with this email' });
    }
    user.password = newPassword;
    await user.save();
    await TempUser.deleteOne({ email });
    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('Verify forgot OTP error:', err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// POST /logout
router.post('/logout', async (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Error in logout:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /update-profile (Protected)
router.put('/update-profile', auth, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;
    await user.save();

    return res.json({ message: 'Profile updated', user: { id: user._id, name: user.name, email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// POST /register-phone
router.post('/register-phone', async (req, res) => {
  const { name, phone, password } = req.body;
  // Validate phone: must be 12 digits, start with 91, and only digits
  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Name, phone, and password are required' });
  }
  if (!/^91[6-9][0-9]{9}$/.test(phone)) {
    return res.status(400).json({ message: 'Phone must start with 91 and be a valid 10-digit Indian mobile number' });
  }
  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }
    const user = new User({ name, phone, password });
    await user.save();
    return res.json({ message: 'Account created successfully! Please sign in.', user });
  } catch (err) {
    console.error('Register-phone error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;