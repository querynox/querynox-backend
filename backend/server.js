require('dotenv').config();
require('./configs/morganFormatterConfig')
require("./configs/databaseConfig")()

const express = require('express');

const cors = require('cors');
const { clerkMiddleware } = require('@clerk/express')
const listEndpoints = require('express-list-endpoints');
const morgan = require('morgan')
const compresison = require('compression')

const v1Router = require('./routes/v1/router')


const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: ['http://localhost:5173','http://192.168.1.2:5173'],
  credentials: true // optional, only if you're using cookies or auth headers
}));
app.use((req,res,next)=>{
  if(req.url.includes('webhook')){
    express.raw({ type: 'application/json' })(req,res,next)
  }else{
    express.json({ limit: "10mb" })(req,res,next)
  }
});
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(clerkMiddleware({ secretKey: process.env.CLERK_SECRET_KEY }))
app.use(compresison())

// Debug middleware to log requests 
app.use(morgan("dev-with-time"));

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
  res.json(listEndpoints(app),);
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).json({ error: err.message || String(err) });
});

// Server start
app.listen(PORT , () => {
  console.log(`Server is running on port ${PORT}`);
}); 