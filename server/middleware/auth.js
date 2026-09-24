const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    
    // Also check Authorization header if cookie isn't present
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
    
    const user = await User.findById(decoded.userId)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ message: 'Invalid token. Authorization failed.' });
  }
};

module.exports = auth;
