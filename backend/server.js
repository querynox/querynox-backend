require('dotenv').config();
require('./configs/morganFormatterConfig')
require("./configs/databaseConfig")()
const os = require("node:os")

const express = require('express');

const cors = require('cors');
const { clerkMiddleware } = require('@clerk/express')
const listEndpoints = require('express-list-endpoints');
const morgan = require('morgan')
const compresison = require('compression')
const promClient = require('prom-client');
const { execSync } = require('child_process');

const { reqResMetrics, totalRequestCounter } = require('./configs/prometheusMetricsConfig');
const logger = require("./configs/loggerConfig")
const {basicAuth} = require("./middlewares/basicAuthMiddleware")

const v1Router = require('./routes/v1/router')

const COMMIT_HASH =  (() =>{
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    logger.error('Failed to get latest commit', err);
    return "UNKNOWN"
  } 
})();//IIFE

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors({
  origin: [
    process.env.LOKI_LOGGER_HOST,
    process.env.FRONTEND_HOST,
    "http://localhost:4173",
    "https://querynox-dev.vercel.app",
    "https://www.querynox.xyz",
    "https://3.134.238.10",
    "https://3.129.111.220",
    "https://52.15.118.168"],
  credentials: true
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
app.use((req,res,next)=>{
  if(req.path.endsWith('stream')){
    next();
  }else{
    compresison()(req,res,next)
  }
})

//Collect System Metrics
promClient.collectDefaultMetrics({register:promClient.register})

// Debug middleware to log requests 
app.use(morgan("dev-with-time",{stream:{write:(dataString)=>{
  const data = JSON.parse(dataString);

  logger.log({level:"http",message:"REQUEST",...data});

  //Prometheus Metrics
  reqResMetrics.labels({
    status_code:data.status_code,
    first_time_to_byte:data.first_time_to_byte,
    last_time_to_byte:data.last_time_to_byte,
    route:data.route,
    content_length:data.content_length,
    method:data.method
  }).observe(data.last_time_to_byte);
  totalRequestCounter.inc();
  
}}}));

// Routes
app.use('/api/v1',v1Router)

//Health Router
app.get('/health', (req, res) => {
  const uptime = process.uptime(); // in seconds
  const memoryUsage = process.memoryUsage();
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const loadAvg = os.loadavg(); // [1, 5, 15 min]

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: `${Math.round(uptime)}s`,
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
      external: Math.round(memoryUsage.external / 1024 / 1024) + " MB",
      freeSystem: Math.round(freeMem / 1024 / 1024) + " MB",
      totalSystem: Math.round(totalMem / 1024 / 1024) + " MB"
    },
    load: {
      "1m": loadAvg[0].toFixed(2),
      "5m": loadAvg[1].toFixed(2),
      "15m": loadAvg[2].toFixed(2),
    },
    node: {
      version: process.version,
      pid: process.pid,
      platform: process.platform,
      commit_hash:COMMIT_HASH,
    }
  });
});

//Help Router
app.get(['/help', '/'], (req, res) => {
  
  const endpoints = listEndpoints(app).map(endpoint => { 
    return endpoint.methods.map((method) => `${method} ${endpoint.path}`)
   }).flatMap(e => e);

  res.json({
    messaage:"Welcome to backend.querynox.xyz. To view website, go to www.querynox.xyz",
    commit_hash:COMMIT_HASH,
    endpoints  // your existing data
  });
});

//metrics for Prometheus
app.get("/metrics", basicAuth({username:process.env.USERNAME,password:process.env.PASSWORD}), async (req,res) => {
  res.setHeader("Content-Type",promClient.register.contentType)
  const metrics = await promClient.register.metrics();
  res.status(200).send(metrics)
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err)
  res.status(500).json({ error: err.message || String(err) });
});

// Server start
app.listen(PORT ,'0.0.0.0', () => {
  let latestCommit = 'unknown';
  try {
    latestCommit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    console.error('Failed to get latest commit', err);
  }
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Latest Commit : ${latestCommit}`);
}); 