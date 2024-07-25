const pool = require("../config");
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require("moment");


///////////////get all cart items//////////////
const handleGetCartItems = async (req, res) => {

    let token = req.headers.authorization;
    // Verify the token and decode its payload
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    try {
        const [rows, fields] = await pool.execute(`SELECT * FROM 
        ${process.env.DB_NAME}.cart AS cart
        LEFT JOIN 
        ${process.env.DB_NAME}.products AS products ON 
        cart.product_id = products.product_id
        WHERE cart.user_id='${decoded.user_id}' AND products.is_active='1' ORDER BY cart.datetime DESC`)

        if (rows.length) {
            res.status(200).json({ status: 200, success: true, message: "Data fetch successfully", data: rows });

        } else {
            res.status(404).json({ message: "No data found", status: 404, success: false })
        }

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}


const handleAddToCart = async (req, res) => {

    const productSchema = Joi.object({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a product Id.',
            'number.integer': 'Please provide a valid product Id.',
            'any.required': 'Product Id is required.',
        }),
        quantity: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a quantity.',
            'number.integer': 'Please provide a valid quantity.',
            'any.required': 'Quantity is required.',
            'number.min': 'Quantity must be at least 1.',
        })
    });

    let { product_id, quantity } = req.body;

    const productData = {
        product_id: product_id,
        quantity: quantity
    };

    // Validate the data against the schema

    const { error, value } = productSchema.validate(productData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {

            let token = req.headers.authorization;
            // Verify the token and decode its payload
            const decoded = jwt.verify(token, process.env.SECRET_KEY);

            let query = `SELECT * FROM ${process.env.DB_NAME}.cart where product_id='${product_id}' AND user_id='${decoded.user_id}'`;

            const [result] = await pool.execute(query);

            if (result.length) {
                res.status(403).json({ message: "Product is already in the cart", status: 403, success: false })
            } else {
                /////////////ADD PRODUCT TO CART//////////

                let time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

                const [resultAddTocart] = await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.cart (product_id, user_id,quantity,datetime) VALUES (?, ?, ?, ?)`,
                    [product_id, decoded.user_id, quantity, time]
                );
                res.status(200).json({
                    message: "Product added to cart",
                    status: 200,
                    success: true,
                    data: {
                        product_id: product_id,
                        user_id: decoded.user_id,
                        quantity: quantity,
                        datetime: time,
                        cart_id: resultAddTocart.insertId
                    }
                })
            }
        }
        catch (err) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });
        }
    }
}

const handleChangeQuantity = async (req, res) => {

    const productSchema = Joi.object({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a product Id.',
            'number.integer': 'Please provide a valid product Id.',
            'any.required': 'Product Id is required.',
        }),
        quantity: Joi.number().integer().required().messages({
            'number.base': 'Please provide a quantity.',
            'number.integer': 'Please provide a valid quantity.',
            'any.required': 'Quantity is required.',
        })
    });


    let { product_id, quantity } = req.body;

    const productData = {
        product_id: product_id,
        quantity: quantity
    };

    // Validate the data against the schema

    const { error, value } = productSchema.validate(productData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {

        try {
            let token = req.headers.authorization;
            // Verify the token and decode its payload
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            if (quantity === 0) {
                let query = `DELETE FROM ${process.env.DB_NAME}.cart where product_id='${product_id}' AND user_id='${decoded.user_id}'`;
                const [result] = await pool.execute(query);
                res.status(200).json({
                    message: "Product remove from cart.", status: 200, success: true, data: {
                        quantity: quantity
                    }
                });
            } else {
                /////////UPDATE THE PRODUCT WITH GIVEN QUANTITY/////
                let query = `UPDATE ${process.env.DB_NAME}.cart SET quantity = '${quantity}' WHERE user_id='${decoded.user_id}' AND product_id='${product_id}'`;
                const [result] = await pool.execute(query);
                if (result.affectedRows || result.changedRows) {
                    res.status(200).json({
                        message: "Quantity updated successfully.", status: 200, success: true, data: {
                            quantity: quantity
                        }
                    });
                } else {
                    res.status(404).json({ message: "Product not found in the cart", status: 404, success: false });
                }
            }
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}


const handleUpdateUserInfo = async (req, res) => {

    let { firstname, lastname, photo_url } = req.body;

    try {
        let token = req.headers.authorization;
        // Verify the token and decode its payload
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        let query = `UPDATE ${process.env.DB_NAME}.users SET firstname = '${firstname}',lastname = '${lastname}',photo_url='${photo_url}' WHERE user_id = '${decoded.user_id}'`;
        const [result] = await pool.execute(query);
        res.status(200).json({
            status: 200,
            message: "User updated successfully",
            success: true
        })
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    handleAddToCart,
    handleGetCartItems,
    handleChangeQuantity,
    handleUpdateUserInfo
}