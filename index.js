// Importing the Express module
const express = require('express');
// Creating an Express application
const app = express();
const path = require("path");
const cors = require('cors');

const mySqlConnection = require("./config");
const { verifyToken, isAdmin,isDeliveryPerson } = require('./controllers/common');
const fileUpload = require("express-fileupload");
// Set up storage for multer

// app.js
require('dotenv').config();





app.use(fileUpload({
  useTempFiles: true,
}));


// Enable CORS for all routes
app.use(cors());
// Middleware to parse JSON data
app.use(express.json());
// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));


// Import the router
const dashboardRouter = require('./routes/dashboardRoutes');
const authRouter = require("./routes/authRoutes");
const productRouter = require("./routes/productRoutes");
const cartRouter = require("./routes/cartRoutes");
const orderRouter = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
// Use the router for the base path

app.use("/api/auth", authRouter);
app.use('/', dashboardRouter);
app.use("/api/products",productRouter);
app.use("/api/cart", verifyToken, cartRouter);
app.use("/api/order", verifyToken, orderRouter);
app.use("/api/admin", verifyToken, isAdmin, adminRoutes);
app.use("/api/delivery", verifyToken, isDeliveryPerson, deliveryRoutes);

// Specifying the port to listen on
const PORT = 8000;

// Making the application listen on the specified port


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
