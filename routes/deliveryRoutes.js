const express = require("express");
const
    {
        handleFindOrderById
    } = require("../controllers/deliveryController");

const router = express.Router();

router.get("/findOrderById", handleFindOrderById);

module.exports = router;