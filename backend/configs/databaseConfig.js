const mongoose = require('mongoose')
const dotenv = require('dotenv');
const logger = require('./loggerConfig');
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Connected to Database");
  } catch (error) {
    logger.error("Error Connecting to Server " + error + "\n " + process.env.MONGOURI);
  }
};

module.exports = connectDB;