const express = require("express");
const
    {
        handleCreateOrUpdateProduct,
        handleGetAllOrdersAdmin,
        handleUploadProductSheet,
        handleGetAllOrderInfo,
        handleAdminDashboard,
        handleAddAdminOrDelivery
    } = require("../controllers/adminController");

const router = express.Router();
router.post("/createOrUpdateProduct", handleCreateOrUpdateProduct);
router.post("/getAllOrdersAdmin", handleGetAllOrdersAdmin);
router.post("/uploadProductSheet", handleUploadProductSheet);
router.post("/getAllOrders", handleGetAllOrderInfo);
router.get('/dashboard', handleAdminDashboard)
router.post("/add-account",handleAddAdminOrDelivery);

module.exports = router;