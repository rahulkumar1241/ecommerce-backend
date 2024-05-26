const express = require("express");
const {
    handleCreateOrder,
    handleSendOtpOrder,
    handleVerifyOTPOrder,
    handleUpdateOrder,
    handleUpdateOrderPostPayment,
    handleGetMyOrders,
    handleGetOrderDetails,
    handleUpdateOrderStatus,
    handleGetOrderItemDetails,
} = require("../controllers/orderController.js");

const router = express.Router();

router.post("/createOrder", handleCreateOrder);
router.post("/sendOtp", handleSendOtpOrder);
router.post("/verifyOtp", handleVerifyOTPOrder);
router.post("/updateOrder", handleUpdateOrder);
router.post("/updateOrderPostPayment", handleUpdateOrderPostPayment);
router.get("/getMyOrders", handleGetMyOrders);
router.get("/getOrderDetails", handleGetOrderDetails);
router.post("/updateOrderStatus", handleUpdateOrderStatus);
router.get("/orderItem", handleGetOrderItemDetails);

module.exports = router;