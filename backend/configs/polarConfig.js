const { Polar } = require("@polar-sh/sdk");
require('dotenv').config();

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN, // store in .env
  server: process.env.NODE_ENV == "production" ? "production" :'sandbox',
});

module.exports = polar