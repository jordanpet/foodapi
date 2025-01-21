require('dotenv').config();

module.exports = {
  dbConfig: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: process.env.DB_TIMEZONE,
    charset: process.env.DB_CHARSET
  },
  port: process.env.PORT
};
