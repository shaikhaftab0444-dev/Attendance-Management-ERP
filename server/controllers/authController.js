const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course');
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

module.exports = {
  login,
  logout,
  getMe,
};
