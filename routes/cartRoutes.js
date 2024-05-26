const express = require("express");
const
    {
        handleAddToCart,
        handleGetCartItems,
        handleChangeQuantity,
        handleUpdateUserInfo
    } = require("../controllers/cartController");

const router = express.Router();

router.post("/addToCart", handleAddToCart);
router.get("/getCartItems", handleGetCartItems);
router.post("/updateQuantity",handleChangeQuantity);
router.post("/updateUserInfo",handleUpdateUserInfo);

module.exports = router;