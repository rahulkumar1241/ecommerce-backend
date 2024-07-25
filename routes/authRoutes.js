const express = require("express");

const { handleSignupController,
    handleSetPassword,
    handleSignin,
    handleSendOtp,
    handleVerifyOtp,
    handleSendOtpUpdateEmail,
    handleVerifyOtpUpdateEmail,
} = require("../controllers/authController");
const { verifyToken, isAdmin } = require("../controllers/common");

const router = express.Router();

router.post("/signup", handleSignupController);
router.post("/set-password", handleSetPassword);
router.post("/login", handleSignin);
router.post("/send-otp", handleSendOtp);
router.post("/verify-otp",handleVerifyOtp);
router.post("/send-otp-update-email",verifyToken,handleSendOtpUpdateEmail);
router.post("/verify-otp-update-email",verifyToken,handleVerifyOtpUpdateEmail);



module.exports = router;