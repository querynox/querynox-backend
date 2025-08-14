const { getAuth } = require('@clerk/express');

const clerkAuthMiddleware = (requireAuth = false) => {
  return async (req, res, next) => {
    const { userId } = getAuth(req);
    if (!userId) {
      if(requireAuth){
        return res.status(401).json({ error: 'Not authenticated' });
      }
      req.auth.userId = null;
    }else{
      req.auth.userId = userId;        
    }
    next();
  }; 
};

module.exports = clerkAuthMiddleware
 