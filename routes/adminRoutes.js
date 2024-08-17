const express = require("express");
const
    {
        handleCreateOrUpdateProduct,
        handleGetAllOrdersAdmin,
        handleUploadProductSheet,
        handleGetAllOrderInfo,
        handleAdminDashboard,
        handleAddAdminOrDelivery,
        handleCreateCategory,
        handleGetCategoryInfo,
        handleUpdateCategoryInfo
    } = require("../controllers/adminController");

const router = express.Router();
router.post("/createOrUpdateProduct", handleCreateOrUpdateProduct);
router.post("/getAllOrdersAdmin", handleGetAllOrdersAdmin);
router.post("/uploadProductSheet", handleUploadProductSheet);
router.post("/getAllOrders", handleGetAllOrderInfo);
router.get('/dashboard', handleAdminDashboard)
router.post("/add-account",handleAddAdminOrDelivery);
router.post("/add-category",handleCreateCategory);
router.get("/get-category-info",handleGetCategoryInfo);
router.post("/update-category-info",handleUpdateCategoryInfo);

module.exports = router;
