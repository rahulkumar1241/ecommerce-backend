const pool = require("../config");
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require("moment");


const handleGetAllProductsByCategory = async (req, res) => {
    const productSchema = Joi.object({
        cat_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid Category Id.',
            'number.integer': 'Please provide a valid Category Id.',
            'any.required': 'Category Id is required.',
        }),
        page_number: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a page number.',
            'number.integer': 'Please provide a valid page number.',
            'any.required': 'Page number is required.',
            'number.min': 'Page number must be at least 1.',
        }),
        page_size: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid page size.',
            'number.integer': 'Please provide a valid page size.',
            'any.required': 'Page size is required.',
            'number.min': 'Page size must be at least 1.',
        })
    });


    let { page_number, page_size } = req.query;
    let { cat_id, filter_section } = req.body;

    const productData = {
        cat_id: cat_id,
        page_number: page_number,
        page_size: page_size
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
            let min_max_query = `SELECT MIN(price_after_discount) AS min_price, MAX(price_after_discount) AS max_price
            FROM ${process.env.DB_NAME}.products 
            WHERE category='${cat_id}' AND is_active='1'`;

            const [result] = await pool.execute(min_max_query);

            let isOrderByPresent = false;
            let query = `SELECT 
            SQL_CALC_FOUND_ROWS
             * FROM ${process.env.DB_NAME}.products 
            WHERE 
            category='${cat_id}' AND is_active='1' `;

            if (Object.keys(filter_section).length && filter_section.rating_greater_than_equal_to) {
                query += `AND rating >= '${parseInt(filter_section.rating_greater_than_equal_to)}' `
            }

            if (Object.keys(filter_section).length && filter_section.discount_greater_than_equal_to) {
                query += `AND discount_per >= '${parseInt(filter_section.discount_greater_than_equal_to)}' `
            }

            if (Object.keys(filter_section).length && filter_section.max_price_range) {
                query += `AND price_after_discount BETWEEN '${parseInt(result[0].min_price)}' AND '${parseInt(filter_section.max_price_range)}' `
            }

            if (Object.keys(filter_section).length && filter_section.name) {
                query += `AND (product_name LIKE '%${filter_section.name}%' OR product_description LIKE '%${filter_section.name}%') `;
            }

            if (Object.keys(filter_section).length && (filter_section.order_by_price === "ASC" || filter_section.order_by_price === "DESC")) {
                isOrderByPresent = true;
                query += `ORDER BY price_after_discount ${filter_section.order_by_price} `;
            }

            if (Object.keys(filter_section).length && filter_section.newest_first) {
                query += `${isOrderByPresent ? ', created_at DESC' : 'ORDER BY created_at DESC'}`;
            }

            let totalCountQuery = `SELECT FOUND_ROWS() as total`;

            if (page_number && page_size) {
                let offset = (parseInt(page_number) - 1) * (page_size);
                query += ` LIMIT ${page_size} OFFSET ${offset}`
            }
            const [rows] = await pool.execute(query);

            const [rows2] = await pool.execute(totalCountQuery);

            res.status(200).json({
                status: 200,
                success: true,
                data:
                {
                    products: [...rows],
                    total_count: rows2[0].total,
                    MIN_PRICE: result[0].min_price,
                    MAX_PRICE: result[0].max_price,
                }, message: "Data fetch successfully"
            });
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

const handleGetProduct = async (req, res) => {
    const productSchema = Joi.object({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid product Id.',
            'number.integer': 'Please provide a valid product Id.',
            'any.required': 'Product Id is required.',
        }),
    });


    let { product_id } = req.query;

    const productData = {
        product_id: product_id,
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
            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.products where product_id='${product_id}'`);
            if (rows.length) {

                let token = req.headers.authorization;
                // Verify the token and decode its payload
                let decoded = token ? jwt.verify(token, process.env.SECRET_KEY) : null;

                if (token) {

                    const [recentlyViewedData] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.recently_viewed_products where product_id='${product_id}' AND user_id='${decoded.user_id}'`);

                    if (recentlyViewedData.length) {

                        ////////////////UPDATE RECENTLY VIEWED DATA/////////////

                        let datetime = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
                        
                        const [result] = await pool.execute(
                            `UPDATE ${process.env.DB_NAME}.recently_viewed_products SET watch_datetime='${datetime}' WHERE product_id='${product_id}' AND user_id='${decoded.user_id}'`,
                        );
                    } else {
                        ///////////INSERT///////
                        let datetime = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

                        const [result] = await pool.execute(
                            `INSERT INTO ${process.env.DB_NAME}.recently_viewed_products (product_id, user_id,watch_datetime) VALUES (?, ?, ?)`,
                            [product_id, decoded.user_id, datetime]
                        );
                    }
                }
                res.status(200).json({ status: 200, success: true, message: "Data fetch successfully", data: rows[0] });
            } else {
                res.status(404).json({ status: 404, success: false, message: "No data found" })
            }
        }
        catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}



const handleAddToWishlist = async (req, res) => {

    const productSchema = Joi.object({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid product Id.',
            'number.integer': 'Please provide a valid product Id.',
            'any.required': 'Product Id is required.',
        }),
    });


    let { product_id } = req.body;

    const productData = {
        product_id: product_id,
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

            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.wishlist where product_id='${product_id}' AND user_id='${decoded.user_id}'`);

            if (rows.length) {
                res.status(403).json({ status: 403, message: "Product is already added in the wishlist", success: false });
            } else {
                ///////////INSERT///////
                const [result] = await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.wishlist (product_id, user_id,datetime) VALUES (?, ?, ?)`,
                    [product_id, decoded.user_id, moment(new Date()).format('YYYY-MM-DD HH:mm:ss')]
                );
                res
                    .status(200)
                    .json({ message: "Product added successfully in wishlist", success: true, status: 200 });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const getWishListItems = async (req, res) => {

    let token = req.headers.authorization;
    // Verify the token and decode its payload
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    try {
        const [rows, fields] = await pool.execute(`SELECT * FROM 
        ${process.env.DB_NAME}.wishlist AS wishlist
        LEFT JOIN 
        ${process.env.DB_NAME}.products AS products ON 
        wishlist.product_id = products.product_id
        WHERE wishlist.user_id='${decoded.user_id}' AND products.is_active='1' ORDER BY wishlist.datetime DESC`);

        if (rows.length) {
            res.status(200).json({ status: 200, success: true, message: "Data fetch successfully", data: rows });

        } else {
            res.status(404).json({ message: "No data found", status: 404, success: false })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleRemoveFromWishList = async (req, res) => {
    const productSchema = Joi.object({
        product_id: Joi.number().integer().required().messages({
            'number.base': 'Please provide a valid product Id.',
            'number.integer': 'Please provide a valid product Id.',
            'any.required': 'Product Id is required.',
        }),
    });


    let { product_id } = req.body;

    const productData = {
        product_id: product_id,
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
        let token = req.headers.authorization;
        // Verify the token and decode its payload
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        try {
            const [result] = await pool.execute(`DELETE FROM ${process.env.DB_NAME}.wishlist where product_id='${product_id}' AND user_id='${decoded.user_id}'`);
            res.status(200).json({ status: 200, message: "Product removed successfully", success: true });
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}


const handleGetAllProducts = async (req, res) => {
    const productSchema = Joi.object({
        page_number: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a page number.',
            'number.integer': 'Please provide a valid page number.',
            'any.required': 'Page number is required.',
            'number.min': 'Page number must be at least 1.',
        }),
        page_size: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide a valid page size.',
            'number.integer': 'Please provide a valid page size.',
            'any.required': 'Page size is required.',
            'number.min': 'Page size must be at least 1.',
        })
    });


    let { page_number, page_size } = req.query;
    let { filter_section } = req.body;

    const productData = {
        page_number: page_number,
        page_size: page_size
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
            const decoded = token ? jwt.verify(token, process.env.SECRET_KEY) : {};

            let MIN = 0;
            let MAX = 0;

            if (decoded && decoded.role !== 1) {
                let min_max_query = `SELECT MIN(price_after_discount) AS min_price, MAX(price_after_discount) AS max_price
                FROM ${process.env.DB_NAME}.products 
                WHERE is_active='1'`;
                const [result] = await pool.execute(min_max_query);
                MIN = result[0].min_price;
                MAX = result[0].max_price;
            }

            let isOrderByPresent = false;

            let query = `SELECT 
            SQL_CALC_FOUND_ROWS
             * FROM ${process.env.DB_NAME}.products AS products 
            LEFT JOIN 
            ${process.env.DB_NAME}.categories AS categories
            ON products.category = categories.cat_id `;

            if (decoded.role !== 1) {
                query += `WHERE products.is_active='1' `;
            }

            //////////////for admin show in active products also/////
            if (decoded.role === 1) {
                query += `WHERE products.is_active IN ('0','1') `;
            }

            if (Object.keys(filter_section).length && filter_section.search_by_product_id) {
                query += `AND product_id='${filter_section.search_by_product_id}' `
            }
            else {

                if (Object.keys(filter_section).length && filter_section.categories && filter_section.categories.length) {
                    query += `AND category IN  (${filter_section.categories.toString().replaceAll(",", ", ")}) `;
                }

                if (Object.keys(filter_section).length && filter_section.rating_greater_than_equal_to) {
                    query += `AND rating >= '${parseInt(filter_section.rating_greater_than_equal_to)}' `
                }

                if (Object.keys(filter_section).length && filter_section.discount_greater_than_equal_to) {
                    query += `AND discount_per >= '${parseInt(filter_section.discount_greater_than_equal_to)}' `
                }

                if (Object.keys(filter_section).length && filter_section.max_price_range) {
                    query += `AND price_after_discount BETWEEN '${parseInt(MIN)}' AND '${parseInt(filter_section.max_price_range)}' `
                }

                if (Object.keys(filter_section).length && filter_section.name) {
                    query += `AND (product_name LIKE '%${filter_section.name}%' OR product_description LIKE '%${filter_section.name}%') `;
                }


                if (Object.keys(filter_section).length && filter_section.out_of_stock) {
                    query += `AND products.stock<='0' `;
                }

                if (Object.keys(filter_section).length && (filter_section.order_by_price === "ASC" || filter_section.order_by_price === "DESC")) {
                    isOrderByPresent = true;
                    query += `ORDER BY price_after_discount ${filter_section.order_by_price} `;
                }

                if (Object.keys(filter_section).length && filter_section.newest_first) {
                    query += `${isOrderByPresent ? ', created_at DESC' : 'ORDER BY created_at DESC'}`;
                }
            }

            let totalCountQuery = `SELECT FOUND_ROWS() as total`;

            if (page_number && page_size) {
                let offset = (parseInt(page_number) - 1) * (page_size);
                query += ` LIMIT ${page_size} OFFSET ${offset}`
            }
            const [rows] = await pool.execute(query);

            const [rows2] = await pool.execute(totalCountQuery);


            let response = {
                products: [...rows],
                total_count: rows2[0].total,
                MIN_PRICE: MIN,
                MAX_PRICE: MAX,
            };

            if (decoded.role === 1) {
                delete response['MIN_PRICE'];
                delete response['MAX_PRICE'];
            }

            res.status(200).json({
                status: 200,
                success: true,
                data: response,
                message: "Data fetch successfully"
            });
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

const handleUpdateAllProducts = async (req, res) => {
    const [rows] = await pool.execute(`SELECT * from ${process.env.DB_NAME}.products`);
    for (let i = 0; i < rows.length; ++i) {
        await pool.execute(`UPDATE ${process.env.DB_NAME}.products SET price_after_discount ='${rows[i].price - Math.floor((rows[i].price / 100) * rows[i].discount_per)}' WHERE product_id='${rows[i].product_id}'`,);
    }
    res.status(200).json({
        status: 200,
        success: true,
        message: "Products updated successfully."
    })
}

module.exports = {
    handleGetAllProductsByCategory,
    handleGetProduct,
    handleAddToWishlist,
    getWishListItems,
    handleRemoveFromWishList,
    handleGetAllProducts,
    handleUpdateAllProducts
}