const express = require("express");
const
    {
        handleGetAllProductsByCategory,
        handleGetProduct,
        handleAddToWishlist,
        getWishListItems,
        handleRemoveFromWishList,
        handleGetAllProducts,
        handleUpdateAllProducts
    } = require("../controllers/productController");

const router = express.Router();

router.get("/getProduct", handleGetProduct);
router.post("/getAllProductsByCategory", handleGetAllProductsByCategory);
router.post("/getAllProducts",handleGetAllProducts);
router.post("/addToWishlist",handleAddToWishlist);
router.get("/getWishListItems",getWishListItems);
router.delete("/removeFromWishlist",handleRemoveFromWishList);
router.put("/updateAllProducts",handleUpdateAllProducts)

module.exports = router;