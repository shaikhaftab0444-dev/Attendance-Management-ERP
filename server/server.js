const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  // Use default DNS if unable to set custom servers
}
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const hodRoutes = require('./routes/hodRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const seedDatabase = require('./seed');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost dev ports and undefined origins (e.g. mobile/postman)
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Dev friendly
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/teacher', teacherRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Connect to MongoDB and start server
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendedge';

mongoose
  .connect(MONGO_URI, {
    family: 4,
  })
  .then(async () => {
    console.log('Connected to MongoDB successfully at', MONGO_URI);
    
    // Auto-seed default admin and test dataset if needed
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.error('Auto-seed error:', seedErr);
    }

    app.listen(PORT, () => {
      console.log(`AttendEdge Backend Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
