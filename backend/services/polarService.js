const { Polar } = require("@polar-sh/sdk");

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN_DEV, // store in .env
  server: 'sandbox', // remove or change to 'production' later
});

module.exports = polar