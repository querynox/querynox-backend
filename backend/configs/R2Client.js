require('dotenv').config();
const { S3Client } = require("@aws-sdk/client-s3");

require('dotenv').config();
const r2client = new S3Client({
  region: "auto", // required but ignored
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

module.exports = r2client 