const morgan = require('morgan');

morgan.format("dev-with-time", function (tokens, req, res) {
  const status_code = Number(tokens.status(req, res));
  const method = tokens.method(req, res);
  const first_time_to_byte = parseFloat(tokens["response-time"](req, res)) || 0;
  const last_time_to_byte = parseFloat(tokens["total-time"](req, res)) || 0;
  const content_length = parseFloat(tokens.res(req, res, "content-length")) || 0;
  const route = tokens.url(req, res);

  return JSON.stringify({method,status_code,first_time_to_byte,last_time_to_byte,route,content_length})
});
