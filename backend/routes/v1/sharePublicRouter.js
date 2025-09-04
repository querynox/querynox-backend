const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chatController');

// Simple per-IP rate limiter (very light weight, in-memory)
const windowMs = 30 * 1000; // 30 seconds
const maxRequests = 20; // per window per IP
const ipStore = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const entry = ipStore.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  ipStore.set(ip, entry);

  if (entry.count > maxRequests) {
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }
  next();
}

// 30s in-memory cache by chatId
const cache = new Map();
const cacheTtlMs = 30 * 1000;

function withCache(handler) {
  return async (req, res) => {
    const key = `public_chat_${req.params.chatId}`;
    const cached = cache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      res.set('Cache-Control', 'public, max-age=30');
      return res.status(200).json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body && typeof body === 'object') {
        cache.set(key, { data: body, expiresAt: now + cacheTtlMs });
        res.set('Cache-Control', 'public, max-age=30');
      }
      return originalJson(body);
    };
    return handler(req, res);
  };
}

// GET /api/v1/public/chat/:chatId
router.get('/chat/:chatId', rateLimit, withCache(chatController.getPublicSharedChat));
router.get('/images/download/:key',chatController.downloadImage );

module.exports = router;


