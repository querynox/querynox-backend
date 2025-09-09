const mongoose = require('mongoose')
require('dotenv').config();
const logger = require('./loggerConfig');
const { MAX_DATABASE_RETRY } = require('../data/configs');

const connectDB = async () => {
  let retrys = 1;
  while(retrys < MAX_DATABASE_RETRY){
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info("Connected to Database");
      return;
    } catch (error) {
      if(retrys < MAX_DATABASE_RETRY){
        logger.info(`Retrying ${retrys}. . .`)
      }else{
        logger.error(`Connection failed to database after ${MAX_DATABASE_RETRY} attempts.`)
        logger.error(error.message || String(error));
      }
    }
  }
};

module.exports = connectDB;