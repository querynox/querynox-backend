const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

function colorStatus(status) {
  if (status >= 500) return `${colors.red}${status}${colors.reset}`;
  if (status >= 400) return `${colors.yellow}${status}${colors.reset}`;
  if (status >= 300) return `${colors.cyan}${status}${colors.reset}`;
  if (status >= 200) return `${colors.green}${status}${colors.reset}`;
  return `${colors.white}${status}${colors.reset}`;
}

function colorMethod(method) {
  switch (method) {
    case "GET": return `${colors.green}${method}${colors.reset}`;
    case "POST": return `${colors.blue}${method}${colors.reset}`;
    case "PUT": return `${colors.yellow}${method}${colors.reset}`;
    case "PATCH": return `${colors.cyan}${method}${colors.reset}`;
    case "DELETE": return `${colors.red}${method}${colors.reset}`;
    default: return `${colors.white}${method}${colors.reset}`;
  }
}

function colorResponseTime(time) {
  if (time < 100) return `${colors.green}${time}ms${colors.reset}`;
  if (time < 500) return `${colors.yellow}${time}ms${colors.reset}`;
  return `${colors.red}${time}ms${colors.reset}`;
}

function colorizeLevel(level) {
  switch (level) {
    case "error":
      return `${colors.red}${level.toUpperCase()}${colors.reset}`;
    case "warn":
      return `${colors.yellow}${level.toUpperCase()}${colors.reset}`;
    case "info":
      return `${colors.green}${level.toUpperCase()}${colors.reset}`;
    case "http":
      return `${colors.cyan}${level.toUpperCase()}${colors.reset}`;
    case "verbose":
      return `${colors.magenta}${level.toUpperCase()}${colors.reset}`;
    case "debug":
      return `${colors.blue}${level.toUpperCase()}${colors.reset}`;
    case "silly":
      return `${colors.gray}${level.toUpperCase()}${colors.reset}`;
    default:
      return `${colors.white}${level.toUpperCase()}${colors.reset}`;
  }
}


function colorizeRequest(data) {
  return `${colorMethod(data.method)} ${data.route} ${colorStatus(data.status_code)} ${colorResponseTime(data.first_time_to_byte)} ${colorResponseTime(data.last_time_to_byte)} ${data.content_length}`;
}

module.exports = {colorizeLevel,colorizeRequest,ANSIcolors:colors}