const logger = require("../configs/loggerConfig");

// basicAuth.js
const basicAuth = ({ username, password, realm = "protected" }) => {
  if(!username || !password) {
      logger.error("Username and Password not found supplied to basicAuth Middleware",username,password)
      throw new Error("Username and Password not found supplied to basicAuth Middleware")
  }
  return function (req, res, next) {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", `Basic realm="${realm}"`);
      return res.status(401).send("Authentication required.");
    }

    // Decode base64 "username:password"
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [reqUser, reqPass] = credentials.split(":");

    if (reqUser === username && reqPass === password) {
      return next();
    }
    
    res.setHeader("WWW-Authenticate", `Basic realm="${realm}"`);
    return res.status(401).send("Invalid credentials.");
  };
}

module.exports = {basicAuth}