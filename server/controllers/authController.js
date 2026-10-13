const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course')
      .populate('session');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated. Contact your administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const payload = {
      userId: user._id,
      role: user.role,
      department: user.department?._id || user.department || null,
      course: user.course?._id || user.course || null,
      year: user.year || null,
      session: user.session?._id || user.session || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'default_jwt_secret', {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.status(200).json({
      message: 'Login successful',
      token, // Also provide in response for flexibility
      user: userObj,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login.' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res.status(200).json({ message: 'Logged out successfully.' });
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course')
      .populate('session')
      .select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ message: 'Error retrieving user profile.' });
  }
};

// POST /api/auth/forgotpassword
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide a registered email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'There is no user registered with that email address.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated. Contact your administrator.' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Determine client base URL
    const clientBaseUrl =
      process.env.CLIENT_URL ||
      req.headers.origin ||
      'http://localhost:5173';

    // Create reset URL
    const resetUrl = `${clientBaseUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

    const plainMessage = `Hello ${user.name},\n\nYou requested a password reset for your AttendEdge ERP account.\n\nPlease click the link below or paste it into your browser to reset your password (link valid for 15 minutes):\n\n${resetUrl}\n\nIf you did not request this email, please ignore it and your password will remain unchanged.\n\nBest regards,\nAttendEdge ERP Administration`;

    const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .brand { font-size: 20px; font-weight: 800; color: #2563eb; letter-spacing: -0.02em; margin-bottom: 20px; }
    .heading { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 12px; }
    .expiry-note { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; }
    .footer { font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">AttendEdge ERP</div>
    <div class="heading">Password Reset Request</div>
    <p class="text">Hello <strong>${user.name}</strong>,</p>
    <p class="text">We received a request to reset the password for your account. Click the button below to choose a new password:</p>
    <div class="btn-container">
      <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
    </div>
    <div class="expiry-note">
      ⏱️ This link is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
    </div>
    <p class="text" style="font-size: 12px; word-break: break-all;">
      Or copy and paste this URL into your browser:<br/>
      <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
    </p>
    <div class="footer">
      AttendEdge Institute Management System · Automated Security Notification
    </div>
  </div>
</body>
</html>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'AttendEdge ERP - Password Reset Request',
        message: plainMessage,
        html: htmlMessage,
      });

      return res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email. Please check your inbox and spam folder.',
      });
    } catch (emailError) {
      console.error('sendEmail error:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        message: 'Email could not be sent. Please verify SMTP configuration or try again later.',
      });
    }
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ message: 'Internal server error during password reset request.' });
  }
};

// PUT /api/auth/resetpassword/:resettoken
const resetPassword = async (req, res) => {
  try {
    const rawToken = req.params.resettoken || req.params.token;
    if (!rawToken) {
      return res.status(400).json({ message: 'Reset token is required.' });
    }

    const { password, confirmPassword } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Please provide a new password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired password reset token. Please request a new reset link.',
      });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ message: 'Internal server error during password reset.' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
