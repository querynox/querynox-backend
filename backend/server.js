require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true // optional, only if you're using cookies or auth headers
}));

// Standard JSON middleware for all requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log requests (remove logging)
app.use((req, res, next) => {
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {})
  .catch(err => {
    // Silent fail
  });

// Routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Server start
app.listen(PORT , () => {
  console.log(`Server is running on port ${PORT}`);
}); 