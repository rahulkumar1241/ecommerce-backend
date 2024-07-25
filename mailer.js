const nodemailer = require("nodemailer");
require('dotenv').config();

const config = {
    "service": "gmail",
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": true,
    "auth": {
        "user": process.env.SMTP_USER_EMAIL,
        "pass": process.env.SMTP_USER_PASSWORD
    }

}


module.exports = config;