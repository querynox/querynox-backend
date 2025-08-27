const morgan = require('morgan');

function colorStatus(status) {
    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // red
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // yellow
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // cyan
    if (status >= 200) return `\x1b[32m${status}\x1b[0m`; // green
    return `\x1b[37m${status}\x1b[0m`; // white
}

function colorMethod(method) {
  switch (method) {
    case "GET": return `\x1b[32m${method}\x1b[0m`;    // green
    case "POST": return `\x1b[34m${method}\x1b[0m`;   // blue
    case "PUT": return `\x1b[33m${method}\x1b[0m`;    // yellow
    case "PATCH": return `\x1b[36m${method}\x1b[0m`;  // cyan
    case "DELETE": return `\x1b[31m${method}\x1b[0m`; // red
    default: return `\x1b[37m${method}\x1b[0m`;       // white
  }
}

function colorResponseTime(time) {
  if (time < 100) return `\x1b[32m${time} ms\x1b[0m`;  // green
  if (time < 500) return `\x1b[33m${time} ms\x1b[0m`;  // yellow
  return `\x1b[31m${time} ms\x1b[0m`;                  // red
}

morgan.token("time", () => new Date().toLocaleString());

morgan.format("dev-with-time", function (tokens, req, res) {
  const status = Number(tokens.status(req, res));
  const method = tokens.method(req, res);
  const responseTime = parseFloat(tokens["response-time"](req, res)) || 0;
  const totalTime = parseFloat(tokens["total-time"](req, res)) || 0;
  const contentLength = parseFloat(tokens.res(req, res, "content-length")) || 0;
  const time = tokens.time(req, res);
  const url = tokens.url(req, res);

  const output_string = [
    `\x1b[90m[${time}]\x1b[0m`, // gray time
    colorMethod(method),                          // colored method
    `\x1b[37m${url}\x1b[0m`,    // white URL
    colorStatus(status),                          // colored status
    colorResponseTime(responseTime),             // colored response time
    colorResponseTime(totalTime),           // colored response time
    "-",
    `\x1b[90m${contentLength}\x1b[0m` // cyan length TODO: add units of length
  ].join(" ");

  return JSON.stringify({
    output_string,
    time,
    method,
    status_code:status,
    first_time_to_byte:responseTime,
    last_time_to_byte:totalTime,
    route:req.url,
    content_length:contentLength
  })
});
