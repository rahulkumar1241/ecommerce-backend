const pool = require("../config");
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require("moment");
const { generateOTP, sendOtpOnMobile } = require("./common");

const Razorpay = require('razorpay');
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

var razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY,
});

const handleCreateOrder = async (req, res) => {
    //////////create a shallow order//////////

    let productSchema = Joi.object().keys({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Product Id.',
            'number.integer': 'Please provide a valid Product Id.',
            'any.required': 'Product Id is required.',
        }),
        quantity: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide quantity',
            'number.integer': 'Please provide a valid quantity.',
            'any.required': 'Quantity is required.',
            'number.min': 'Quantity must be at least 1.',
        }),
        buyout_price: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid product price',
            'number.integer': 'Please provide a valid product price.',
            'any.required': 'Product price is required.',
            'number.min': 'Product price must be at least 1.',
        }),
        size_info:Joi.string().allow(null,'')
    })

    const orderSchema = Joi.object({
        total_amount: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a total amount.',
            'number.integer': 'Please provide a valid valid total amount.',
            'any.required': 'Total amount is required.',
            'number.min': 'Total amount must be at least 1.',
        }),
        products: Joi.array().items(productSchema)
    });

    let { total_amount, products } = req.body;

    const orderData = {
        total_amount: total_amount,
        products: products
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
            let token = req.headers.authorization;
            // Verify the token and decode its payload
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            /////////STATUS FOR INITIATION OF ORDER//////////
            let order_status = 1;
            ///////////INSERT///////
            const [result] = await pool.execute(
                `INSERT INTO ${process.env.DB_NAME}.orders (user_id,total_amount, order_status) VALUES (?, ?, ?)`,
                [decoded.user_id, total_amount, order_status]
            );

            ///////////loop through products to create order_items/////////////
            for (let i = 0; i < products.length; ++i) {
                const [orderItemsResult] = await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.order_items (user_id,order_id,product_id, quantity ,buyout_price,total,size_info) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [decoded.user_id, result.insertId, products[i].product_id, products[i].quantity, products[i].buyout_price, products[i].quantity * products[i].buyout_price,products[i].size_info]
                );
            }

            res.status(200).json({
                message: "Order Created Successfully",
                success: true,
                data: { order_id: result.insertId }
            })
        }
        catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const handleUpdateOrder = async (req, res) => {
    const orderSchema = Joi.object({
        order_id: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid Order Id.',
            'number.integer': 'Please provide a valid Order Id.',
            'any.required': 'Order Id is required.',
            'number.min': 'Order Id must be at least 1.',
        }),
        addressType: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid address type.',
            'number.integer': 'Please provide a valid address type.',
            'any.required': 'Address type is required.',
            'number.min': 'Address type must be at least 1.',
        }),
        pincode: Joi.
            string().regex(/^[0-9]{6}$/)
            .required()
            .messages({
                'string.pattern.base': `Pincode must have 6 digits.`,
                'any.required': 'Pincode is required.'
            }),
        state: Joi.
            string()
            .required()
            .messages({
                'any.required': 'State is required.'
            }),
        district: Joi.
            string()
            .required()
            .messages({
                'any.required': 'District is required.'
            }),
        address: Joi.
            string()
            .required()
            .messages({
                'any.required': 'Address is required.'
            })


    });

    let { order_id, pincode, state, district, address, addressType } = req.body;

    let orderData = {
        order_id: order_id,
        pincode: pincode,
        state: state,
        district: district,
        address: address,
        addressType: addressType
    }


    const { error, value } = orderSchema.validate(orderData);

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


            let [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.orders where order_id='${order_id}'`);
            if (result.length) {
                let orderAmount = result[0].total_amount * 100;

                let options = {
                    amount: orderAmount,
                    currency: "INR",
                    receipt: decoded.email
                }
                let response = await razorpayInstance.orders.create(options);
                ///////////payment Initiated///////
                let orderStatus = 11;

                const [updatedResult] = await pool.execute(
                    `UPDATE ${process.env.DB_NAME}.orders SET 
                    order_status = '${orderStatus}',
                    razorpay_order_id ='${response.id}',
                    pincode = '${pincode}',
                    state = '${state}',
                    district = '${district}',
                    address = '${address}',
                    address_type = ${addressType}
                    WHERE order_id = ${order_id}`
                );

                res.status(200).json
                    ({
                        success: true,
                        status: 200,
                        data: {
                            razorpay_order_id: response.id,
                            amount: orderAmount,
                            key_id: RAZORPAY_ID_KEY,
                            contact: result[0].mobile_number,
                            name: decoded.name,
                            email: decoded.email
                        },
                        message: "Payment Initiated Successfully."
                    });
            } else {
                res.status(400).json({ message: "Please provide a valid Order Id", status: 400, success: false });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const handleGetOrderDetails = async (req, res) => {

    const orderSchema = Joi.object({
        order_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Order Id.',
            'number.integer': 'Please provide a valid Order Id.',
            'any.required': 'Order Id is required.',
        })
    });

    let { order_id } = req.query;

    let orderData = {
        order_id: order_id
    }

    const { error, value } = orderSchema.validate(orderData);

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

            let [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.orders where order_id='${order_id}'`);

            if (result.length) {
                let response = {
                    order: result[0]
                };

                let [order_items] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.order_items AS order_items
                LEFT JOIN 
                ${process.env.DB_NAME}.products AS products
                ON
                order_items.product_id = products.product_id
                where order_id='${order_id}'`);

                response['order_items'] = order_items;

                res.status(200).json({
                    message: "Data fetch successfully.",
                    success: true,
                    status: 200,
                    data: response
                })
            }
            else {
                res.status(400).json({ message: "Please provide a valid Order Id", status: 400, success: false });

            }
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });

        }
    }

}

/////////////////runs after successfull payment///////////
const handleUpdateOrderPostPayment = async (req, res) => {
    const orderSchema = Joi.object({
        order_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Order Id.',
            'number.integer': 'Please provide a valid Order Id.',
            'any.required': 'Order Id is required.',
        }),
        razorpay_payment_id: Joi.
            string()
            .required()
            .messages({
                'any.required': 'Razorpay Payment Id is required.'
            }),
        razorpay_signature: Joi.
            string()
            .required()
            .messages({
                'any.required': 'Razorpay Signature is required.'
            }),

    });

    let { order_id, razorpay_payment_id, razorpay_signature } = req.body;

    let orderData = {
        order_id: order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature
    }

    const { error, value } = orderSchema.validate(orderData);

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

            let [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.orders where order_id='${order_id}'`);

            if (result.length) {
                /////order placed////
                let orderStatus = 3;

                const [updatedResult] = await pool.execute(
                    `UPDATE ${process.env.DB_NAME}.orders SET 
                    order_status = '${orderStatus}',
                    razorpay_payment_id = '${razorpay_payment_id}',
                    razorpay_signature = '${razorpay_signature}',
                    datetime = '${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}'
                    WHERE order_id='${order_id}'`,
                );

                let [items] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.order_items where order_id=${order_id}`);

                for (let i = 0; i < items.length; ++i) {

                    await pool.execute(`UPDATE ${process.env.DB_NAME}.order_items SET item_status='${orderStatus}',order_item_datetime='${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}' WHERE order_item_id='${items[i].order_item_id}'`);

                    let [productData] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.products where product_id='${items[i].product_id}'`);

                    let updatedStock = productData[0].stock - items[i].quantity;

                    await pool.execute(
                        `UPDATE ${process.env.DB_NAME}.products SET 
                        stock = '${updatedStock}'
                        WHERE product_id='${items[i].product_id}'`,
                    );

                    await pool.execute(`DELETE FROM ${process.env.DB_NAME}.cart where product_id='${items[i].product_id}' AND user_id='${decoded.user_id}'`);

                    await pool.execute(`DELETE FROM ${process.env.DB_NAME}.wishlist where product_id='${items[i].product_id}' AND user_id='${decoded.user_id}'`);

                }

                res.status(200).json({ message: "Order Placed successfully.", status: 200, success: true });

            } else {
                res.status(400).json({ message: "Please provide a valid Order Id", status: 400, success: false });
            }
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });

        }
    }
}


const handleSendOtpOrder = async (req, res) => {
    const orderSchema = Joi.object({

        order_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Order Id.',
            'number.integer': 'Please provide a valid Order Id.',
            'any.required': 'Order Id is required.',
        }),
        mobile_number: Joi.
            string().regex(/^[0-9]{10}$/)
            .required()
            .messages({
                'string.pattern.base': `Mobile number must have 10 digits.`,
                'any.required': 'Mobile Number is required.'
            }),
        country_code:Joi.
            string().messages({
                'any.required': 'Country code is required.'
            })
    });


    let { order_id, mobile_number,country_code } = req.body;


    const orderData = {
        order_id: order_id,
        mobile_number: mobile_number,
        country_code:country_code
    };


    const { error, value } = orderSchema.validate(orderData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    }
    else {
        let otp = generateOTP();
        try {
            let body = `Dear Customer,${otp} is your OTP for order request.DO NOT share it with anyone.\nTeam ${process.env.PRODUCT_NAME}`;
            let response = await sendOtpOnMobile(body, mobile_number,country_code);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }

        try {
            /////////UPDATE THE STATUS TO OTP SENT////////
            let order_status = 10;
            const [result] = await pool.execute(
                `UPDATE ${process.env.DB_NAME}.orders SET otp='${otp}', country_code='${country_code}', mobile_number='${mobile_number}',order_status='${order_status}' WHERE order_id='${order_id}'`,
            );
            res.status(200).json({
                success: true,
                status: 200,
                message: `OTP Sent Successfully at ${mobile_number}`,
                data: {
                    mobile: mobile_number
                }
            })
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }

    }

}

const handleVerifyOTPOrder = async (req, res) => {
    ////////////verify otp/////////
    const orderSchema = Joi.object({
        order_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Order Id.',
            'number.integer': 'Please provide a valid Order Id.',
            'any.required': 'Order Id is required.',
        }),
        otp: Joi.string().regex(/^[0-9]{6}$/)
            .required()
            .messages({
                'string.pattern.base': `Otp must have 6 digits.`,
                'any.required': 'Otp is required.'
            })
    });


    let { order_id, otp } = req.body;


    const orderData = {
        order_id: order_id,
        otp: otp
    };


    const { error, value } = orderSchema.validate(orderData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    }
    else {
        try {

            let [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.orders where order_id='${order_id}'`);

            if (result.length) {
                let orgOtp = result[0].otp;
                if (otp === orgOtp) {
                    ///////Mobile Verfied///////////
                    let order_status = 2;
                    const [UpdateResult] = await pool.execute(
                        `UPDATE ${process.env.DB_NAME}.orders SET is_verified='1',order_status='${order_status}' WHERE order_id='${order_id}'`,
                    );
                    res.status(200).json({
                        status: 200,
                        success: true,
                        message: "Mobile Number Verfied Successfully."
                    })
                }
                else {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: "Invalid Otp"
                    })
                }
            } else {
                res.status(400).json({ status: 400, success: false, message: "Invalid Order Id" });
            }


        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }

    }
}


const handleGetMyOrders = async (req, res) => {

    let token = req.headers.authorization;
    // Verify the token and decode its payload
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    let { page_number, page_size } = req.query;

    try {
        let query = `SELECT SQL_CALC_FOUND_ROWS order_items.*,products.*,orders.*,order_status.*,users.firstname,users.lastname,order_address_type.* FROM ${process.env.DB_NAME}.order_items AS order_items
        LEFT JOIN ${process.env.DB_NAME}.products AS products
        ON
        order_items.product_id = products.product_id
        LEFT JOIN ${process.env.DB_NAME}.orders AS orders
        ON
        order_items.order_id = orders.order_id
        LEFT JOIN ${process.env.DB_NAME}.order_status AS order_status
        ON
        order_items.item_status = order_status.status_id
        LEFT JOIN ${process.env.DB_NAME}.users AS users
        ON
        order_items.user_id = users.user_id
        LEFT JOIN ${process.env.DB_NAME}.order_address_type AS order_address_type
        ON
        orders.address_type = order_address_type.address_type_id
        WHERE order_items.user_id='${decoded.user_id}' AND order_items.item_status IN ('3','4','5','6','7','8','9','12','13','14') ORDER BY orders.datetime DESC`;

        if (page_number && page_size) {
            let offset = (parseInt(page_number) - 1) * (page_size);
            query += ` LIMIT ${page_size} OFFSET ${offset}`
        }

        let totalCountQuery = `SELECT FOUND_ROWS() as total`;

        let [result] = await pool.execute(query);

        const [rows2] = await pool.execute(totalCountQuery);


        res.status(200).json({ status: 200, success: true, data: result, total_count: rows2[0].total, message: "Data fetch successfully." })

    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error"
        });
    }
}


const handleUpdateOrderStatus = async (req, res) => {
    const itemSchema = Joi.object({
        item_id: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid Item Id.',
            'number.integer': 'Please provide a valid Item Id.',
            'any.required': 'Item Id is required.',
            'number.min': 'Item Id must be at least 1.'
        }),
        status: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid status.',
            'number.integer': 'Please provide a valid status.',
            'any.required': 'status is required.',
            'number.min': 'status must be at least 1.'
        }),
        mobile_number: Joi.string()
            .pattern(/^[0-9]{10}$/)
            .min(10)
            .messages({
                'string.base': 'Mobile number must be a string',
                'string.empty': 'Mobile number is required',
                'string.pattern.base': 'Invalid mobile number format',
                'string.min': 'Mobile number must be at least 10 digits long',
                'any.required': 'Mobile number is required.',
            }),
        fullname: Joi.string()
            .required()
            .messages({
                'string.base': 'Fullname must be a string',
                'string.empty': 'Fullname is required',
                'any.required': 'Fullname is required.',
            })
    })

    let { item_id, status, mobile_number, fullname } = req.body;

    const itemData = {
        item_id: item_id,
        status: status,
        mobile_number: mobile_number,
        fullname: fullname
    };

    // Validate the data against the schema

    const { error, value } = itemSchema.validate(itemData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {
            ////13--->In case of out for delivery///
            ///////////12---->In csae of order delivered/////////

            let [result] = await pool.execute(`SELECT * from ${process.env.DB_NAME}.order_items AS order_items LEFT JOIN ${process.env.DB_NAME}.products AS products on order_items.product_id = products.product_id WHERE order_item_id='${item_id}'`);

            if (status === 13 || status === 12) {
                let query = `UPDATE ${process.env.DB_NAME}.order_items SET item_status = '${status}',order_item_datetime = '${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}' WHERE order_item_id='${item_id}'`

                await pool.execute(query);

                let body = status === 13 ?
                    `Hey ${fullname},\njust wanted to let you know that your package \n${result[0].product_name}\n is out for delivery. It won't be long before it's in your hands!.\nBest regards, Team ${process.env.PRODUCT_NAME}`
                    :
                    `Hi ${fullname},\nGreat news! Your order for \n${result[0].product_name}\n has been successfully delivered to your address.If you encounter any issues or have questions about your order, please let us know.We're here to help!.Thank you for choosing us.\nBest regards, Team ${process.env.PRODUCT_NAME}`;

                let response = await sendOtpOnMobile(body, mobile_number);

                res.status(200).json({ message: "Status updated successfully", status: 200, success: true });
            }
            else {
                let query = `UPDATE ${process.env.DB_NAME}.order_items SET item_status = '${status}',order_item_datetime = '${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}' WHERE order_item_id = '${item_id}'`;
                await pool.execute(query);

                if (status === 4 || status === 6) {

                    let body = status === 4 ? `Order Cancelled: Dear ${fullname},\nYour request to cancel the order for \n${result[0].product_name}\n has been successfully processed.The amount for the same will be soon credited to your account.\nBest regards, Team ${process.env.PRODUCT_NAME}` : `Return Initiated : Dear ${fullname},\nYour request to return the order for \n${result[0].product_name}\n has been successfully submitted.\nBest regards, Team ${process.env.PRODUCT_NAME}`

                    let response = await sendOtpOnMobile(body, mobile_number);
                }

                res.status(200).json({ message: "Status updated successfully", status: 200, success: true });
            }
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });
        }
    }
}


const handleGetOrderItemDetails = async (req, res) => {
    const oderSchema = Joi.object({
        order_item_id: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid Item Id.',
            'number.integer': 'Please provide a valid Item Id.',
            'any.required': 'Item Id is required.',
            'number.min': 'Item Id must be at least 1.'
        })
    });

    let { order_item_id } = req.query;

    const orderData = {
        order_item_id: order_item_id,
    };

    // Validate the data against the schema

    const { error, value } = oderSchema.validate(orderData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {

        let findOrderItemQuery = `SELECT * from ${process.env.DB_NAME}.order_items WHERE order_item_id='${order_item_id}'`;

        let [result] = await pool.execute(findOrderItemQuery);

        if (!result.length) {
            res.status(404).json({
                success: false,
                status: 404,
                message: "Please provide a correct Order Item No."
            })
        }
        else {
            let query =
                `SELECT order_items.*,products.*,orders.*,order_status.*,users.firstname,users.lastname,order_address_type.* from ${process.env.DB_NAME}.order_items as order_items
        LEFT JOIN ${process.env.DB_NAME}.products as products
        ON 
        order_items.product_id = products.product_id
        LEFT JOIN  
        ${process.env.DB_NAME}.users as users
        ON 
        order_items.user_id = users.user_id
        LEFT JOIN 
        ${process.env.DB_NAME}.orders as orders
        ON 
        order_items.order_id = orders.order_id
        LEFT JOIN ${process.env.DB_NAME}.order_status as order_status

        ON order_status.status_id= order_items.item_status

        LEFT JOIN ${process.env.DB_NAME}.order_address_type as order_address_type
        ON 
        orders.address_type = order_address_type.address_type_id
        WHERE order_item_id='${order_item_id}'`;

            let [result] = await pool.execute(query);

            res.status(200).json({
                success: true,
                status: 200,
                data: result[0],
                message: "Data fetch successfully."
            })
        }
    }

}


module.exports = {
    handleCreateOrder,
    handleUpdateOrder,
    handleSendOtpOrder,
    handleVerifyOTPOrder,
    handleGetOrderDetails,
    handleUpdateOrderPostPayment,
    handleGetMyOrders,
    handleUpdateOrderStatus,
    handleGetOrderItemDetails,
}
