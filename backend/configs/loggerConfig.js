const { createLogger, format, transports } = require("winston");
const { colorizeLevel, colorizeRequest } = require("../services/colorService");
const LokiTransport = require('winston-loki');
require('dotenv').config();

/** * Levels and Priority error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 */

const logger = createLogger({
  level: "silly",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }), // ensures error stack traces are logged
    format.splat(),
    format.json() // base format for Loki
  ),
  transports:[new transports.File({ filename: "logs/error.log", level: "warn" })]
});

// Custom console formatter
const customConsoleFormatter = format.printf(({ level, message, timestamp, ...rest }) => {
  if (level === 'http' && message === "REQUEST") {
    return `${colorizeLevel(level)} [${timestamp}] ${colorizeRequest(rest)}`;
  } else {
    return `${colorizeLevel(level)} [${timestamp}] ${message} ${
      Object.keys(rest).length > 0 ? JSON.stringify(rest) : ""
    }`;
  }
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new transports.Console({
    level: "silly", // log everything to console
    format: format.combine(
      format.timestamp(),
      customConsoleFormatter
    )
  }));
}else{

  logger.add(new LokiTransport({
    host:  process.env.LOKI_LOGGER_HOST,
    level: "http",
    labels: { app: "express", service: "querynox_backend_production"},
    json: true,
    basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_API_KEY}`,
    format: format.json(),
    replaceTimestamp: true,
    batching:true,
    onConnectionError: (err) => console.error(err),
  }))
  
  logger.add(new transports.Console({
    level: "warn", // log everything to console
    format: format.combine(
      format.timestamp(),
      customConsoleFormatter
    )
  }));
}

module.exports = logger;
