// routes.js
const express = require('express');

const {
    handleMainPage,
    handleGetAllDropdownValues,
    handleGetPinCodeDetails,
    handleUploadAllPincodes
} =
    require('../controllers/dashboardController');

const {
    uploadImage
} = require("../controllers/common");
const router = express.Router();

router.get('/dashboard', handleMainPage);
router.post("/getDropdownValues", handleGetAllDropdownValues);
router.get("/pincodeDetails", handleGetPinCodeDetails);
router.post("/uploadImage", uploadImage);
router.post("/uploadAllPincodes", handleUploadAllPincodes);

module.exports = router;
