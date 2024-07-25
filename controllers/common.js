const nodemailer = require("nodemailer")
const config = require("../mailer");
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2

require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET_KEY
});


// Your AccountSID and Auth Token from console.twilio.com
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

const sendEmail = async (data) => {
    const { to, subject, text, html } = data;

    let orgData = {
        "from": process.env.SMTP_USER_EMAIL,
        "to": to,
        "subject": subject
    }

    if (text) {
        orgData.text = text;
    }

    if (html) {
        orgData.html = html;
    }

    const transporter = nodemailer.createTransport(config);

    return await transporter.sendMail(orgData);

}



const generateOTP = () => {
    var digits = '0123456789';
    var otpLength = 6;
    var otp = '';
    for (let i = 1; i <= otpLength; i++) {
        var index = Math.floor(Math.random() * (digits.length));
        otp = otp + digits[index];
    }
    return otp;
}



const verifyToken = (req, res, next) => {
    let token = req.headers.authorization;

    if (!token) {
        res.status(401).json({
            status: 401,
            success: false,
            isTokenError: true,
            message: "Please provide Authentication Token"
        })

    } else {

        jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
            if (err) {
                res.status(401).json({
                    success: false,
                    isTokenError: true,
                    status: 401,
                    message: err.message
                })
            } else {
                next();
            }
        });

    }
}


const sendOtpOnMobile = async (body, mobile_number, country_code) => {
    return await client.messages
        .create({
            body: body,
            to: country_code ? country_code + mobile_number : '+91' + mobile_number,
            from: process.env.TWILIO_PHONE_NUMBER,
        })
}


const isDeliveryPerson = (req, res, next) => {
    let token = req.headers.authorization;
    // Verify the token and decode its payload
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    if (decoded.role === 2) {
        next();
    } else {
        res.status(400).json({ status: 400, message: "Unauthorized", success: false });
    }
}


const isAdmin = (req, res, next) => {
    let token = req.headers.authorization;
    // Verify the token and decode its payload
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    if (decoded.role === 1) {
        next();
    } else {
        res.status(400).json({ status: 400, message: "Unauthorized", success: false });
    }
}

const uploadImage = async (req, res) => {
    console.log(req);
    let { image } = req.files;
    try {
        let result = await cloudinary.uploader.upload(image.tempFilePath);

        res.status(200).json({
            message: "Photo Upload Successfully", success: true, status: 200, data: {
                url: result.secure_url
            }
        })
    }
    catch (error) {
        res.status(500).json({ message: "Something went wrong", success: false, status: 500 })
    }
}

module.exports = {
    sendEmail,
    generateOTP,
    verifyToken,
    sendOtpOnMobile,
    isAdmin,
    uploadImage,
    isDeliveryPerson
}