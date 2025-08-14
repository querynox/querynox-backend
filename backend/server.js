require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require("./services/databaseService")
const { clerkMiddleware } = require('@clerk/express')
const listEndpoints = require('express-list-endpoints');
const v1Router = require('./routes/v1/router')

const app = express();
const PORT = process.env.PORT || 3000;
connectDB();


// Middlewares
app.use(cors({
  origin: ['http://localhost:5173','http://192.168.1.2:5173'],
  credentials: true // optional, only if you're using cookies or auth headers
}));

// Standard JSON middleware for all requests
app.use((req,res,next)=>{
  if(req.url.includes('webhook')){
    express.raw({ type: 'application/json' })(req,res,next)
  }else{
    express.json({ limit: "10mb" })(req,res,next)
  }
});

app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(clerkMiddleware({ secretKey: process.env.CLERK_SECRET_KEY }))

// Debug middleware to log requests
app.use((req, res, next) => {
  process.stdout.write(new Date().toLocaleString()+" : ");
  console.log(req.url);
  next();
});

// Routes
app.use('/api/v1',v1Router)

//Health Router
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

//Help Router
app.get(['/help','/'],(req,res)=>{
  res.json(listEndpoints(app));
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).json({ error: 'Internal server error' });
});

// Server start
app.listen(PORT , () => {
  console.log(`Server is running on port ${PORT}`);
}); 