const { createLogger, format, transports } = require("winston");
const LokiTransport = require('winston-loki');
const { colorizeLevel, colorizeRequest } = require("../services/colorService");

/** * Levels and Priority error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 */

const logger = createLogger({
  level: "silly", // accept all levels >= silly
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }), // ensures error stack traces are logged
    format.splat(),
    format.json() // base format for Loki
  )
});

logger.add(new LokiTransport({
  level: "http", // send http and above to Loki
  labels: {
    app_name: "express",
    service_name: "querynox_backend"
  },
  host: process.env.LOKI_LOGGER_HOST,
  format: format.json()
}));

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

//if (process.env.NODE_ENV !== "production") {
  logger.add(new transports.Console({
    level: "silly", // log everything to console
    format: format.combine(
      format.timestamp(),
      customConsoleFormatter
    )
  }));
//}

module.exports = logger;
