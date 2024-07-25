const pool = require("../config");
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require("moment");


const handleFindOrderById = async (req, res) => {
    /////////search on the basis of category and start and end date////////////
    const orderSchema = Joi.object({
        search_by_order_item_id: Joi.number().min(1).integer().required().messages({
            'number.base': 'Please provide a Order Item Id.',
            'number.integer': 'Please provide a valid Order Item Id.',
            'any.required': 'Order Item Id is required.',
            'number.min': 'Please provide a valid Order Item Id.',
        })
    });

    let { search_by_order_item_id } = req.query;

    const orderData =
    {
        search_by_order_item_id: search_by_order_item_id
    };

    // Validate the data against the schema

    const { error, value } = orderSchema.validate(orderData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {
            let query = `SELECT SQL_CALC_FOUND_ROWS * FROM 
            ${process.env.DB_NAME}.order_items AS order_items
        LEFT JOIN 
        ${process.env.DB_NAME}.orders AS orders 
        ON 
        order_items.order_id = orders.order_id
        LEFT JOIN
        ${process.env.DB_NAME}.products AS products 
        ON
        order_items.product_id = products.product_id
        LEFT JOIN
        ${process.env.DB_NAME}.order_status AS order_status
        ON
        order_items.item_status=order_status.status_id
        LEFT JOIN ${process.env.DB_NAME}.users AS users
        ON
        order_items.user_id = users.user_id
        WHERE order_status.status_id IS NOT NULL AND order_items.order_item_id ='${search_by_order_item_id}'`;

            const [rows] = await pool.execute(query);
            if (rows.length) {
                res.status(200).json({
                    status: 200,
                    success: true,
                    data: {
                        order_info: rows[0],
                    }, message: "Data fetch successfully."
                });
            } else {
                res.status(404).json({
                    status: 200,
                    success: false,
                    message: "Data not found."
                });
            }
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error."
            });
        }
    }
}

module.exports = {
    handleFindOrderById
}