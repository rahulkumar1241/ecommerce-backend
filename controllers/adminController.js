const pool = require("../config");
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require("moment");
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const { sendEmail } = require("./common");


const handleGetAllOrdersAdmin = async (req, res) => {
    /////////search on the basis of category and start and end date////////////
    const orderSchema = Joi.object({
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
        }),
        start_date: Joi.date().optional(),
        end_date: Joi.date().optional(),
        categories: Joi.array().optional(),
        search_by_order_item_id: Joi.string().optional()
    });

    let { page_number, page_size, } = req.query;
    let { start_date, end_date, search_by_order_item_id, categories } = req.body;

    const orderData = {
        page_number: page_number,
        page_size: page_size,
        start_date: start_date,
        end_date: end_date,
        categories: categories,
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

            let offset = (parseInt(page_number) - 1) * (page_size);

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
            WHERE order_status.status_id IS NOT NULL `;

            if (start_date && end_date) {
                query += `AND orders.datetime BETWEEN '${start_date}' AND '${end_date}' `;
            }

            if (categories) {
                query += `AND products.category IN  (${categories.toString().replaceAll(",", ", ")}) `;
            }

            if (search_by_order_item_id) {
                query += `AND order_items.order_item_id ='${search_by_order_item_id}' `;
            }

            query += ` LIMIT ${page_size} OFFSET ${offset}`;

            let totalCountQuery = `SELECT FOUND_ROWS() as total`;

            const [rows] = await pool.execute(query);

            const [rows2] = await pool.execute(totalCountQuery);

            res.status(200).json({
                status: 200,
                success: true,
                data:
                {
                    orders: [...rows],
                    total_count: rows2[0].total
                }, message: "Data fetch successfully"
            });

        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });
        }
    }
}


const handleCreateOrUpdateProduct = async (req, res) => {
    ///////////add over here product id//////////
    const productSchema = Joi.object({
        product_name: Joi.
            string()
            .required()
            .messages({
                'any.required': 'Product Name is required.'
            }),
        product_description: Joi.
            string()
            .required()
            .messages({
                'any.required': 'Product Description is required.'
            }),
        rating: Joi.number().min(1).max(5).required().messages({
            'number.base': 'Please provide rating',
            'any.required': 'Rating is required.',
            'number.min': 'Rating must be at least 1.',
            'number.max': 'Max Rating is 5.',
        }),
        stock: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide stock',
            'number.integer': 'Please provide a valid stock.',
            'any.required': 'Stock is required.',
            'number.min': 'Stock must be at least 1.',
        }),
        category: Joi.number().min(1).integer().required().messages({
            'number.base': 'Please provide a valid Category.',
            'number.integer': 'Please provide a valid Category.',
            'any.required': 'Category is required.',
            'number.min': 'Please provide a valid category',
        }),
        image_url: Joi.string().required().uri({
            scheme: ['https'],
        }).messages({
            'string.uri': 'Please provide a valid Url',
            'any.required': 'Image URL is required.'
        }),
        price: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide price',
            'number.integer': 'Please provide a valid price.',
            'any.required': 'Price is required.',
            'number.min': 'Price must be at least 1.',
        }),
        price_after_discount: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide price after discount',
            'number.integer': 'Please provide a valid price after discount.',
            'any.required': 'Price after discount is required.',
            'number.min': 'Price after discount must be at least 1.',
        }),
        discount_per: Joi.number().integer().min(0).required().messages({
            'number.base': 'Please provide discount',
            'number.integer': 'Please provide a valid discount.',
            'any.required': 'Discount is required.',
            'number.min': 'Discount must be at least 0.',
        }),
        is_active: Joi.boolean().messages({
            'any.required': 'The value must be provided.',
            'any.only': 'The value must be a boolean.',
        }),
        product_id: Joi.number().integer().min(1).optional().messages({
            'number.base': 'Please provide a valid Product Id',
            'number.integer': 'Please provide a valid Product Id.',
            'number.min': 'Product Id must be positive.',
        })
    })

    let {
        product_id,
        product_name,
        product_description,
        rating,
        stock,
        category,
        photo_url,
        price,
        discount_per,
        price_after_discount,
        is_active
    } = req.body;

    const productData = {
        product_name: product_name,
        product_description: product_description,
        rating: rating,
        stock: stock,
        category: category,
        image_url: photo_url,
        price: price,
        discount_per: discount_per,
        price_after_discount: price_after_discount,
        is_active: is_active
    };

    const { error, value } = productSchema.validate(productData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {
            if (product_id) {
                await pool.execute(
                    `UPDATE ${process.env.DB_NAME}.products SET
                    product_name = '${product_name}',
                    product_description = '${product_description}',
                    rating='${rating}',
                    stock='${stock}',
                    category='${category}',
                    photo_url='${photo_url}',
                    price='${price}',
                    discount_per='${discount_per}',
                    price_after_discount='${price_after_discount}',
                    is_active=${is_active}
                    WHERE product_id='${product_id}'
                    `);
                res.status(200).json({ status: 200, message: "Product Updated Successfully", success: true })
            }
            else {
                await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.products (product_name,product_description, rating ,stock,category,created_at,photo_url,discount_per,is_active,price,price_after_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [product_name, product_description, rating, stock, category, moment(new Date()).format('YYYY-MM-DD HH:mm:ss'), photo_url, discount_per, is_active, price, price_after_discount]
                );
                res.status(200).json({ status: 200, message: "Product Created Successfully", success: true })
            }

        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const handleUploadProductSheet = async (req, res) => {

    try {
        let filePath = req.files.product_sheet.tempFilePath;

        const workbook = xlsx.readFile(filePath);
        // Assuming only one sheet in the Excel file
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert sheet data to JSON
        const jsonData = xlsx.utils.sheet_to_json(sheet);

        let query = `INSERT INTO ${process.env.DB_NAME}.products (product_name,product_description,stock,price,discount_per,price_after_discount,rating,category,photo_url) VALUES `;

        for (let i = 0; i < jsonData.length; ++i) {
            let price_after_discount = parseInt(jsonData[i]['Price']) - parseInt(jsonData[i]['Price'] / 100 * jsonData[i]['Discount %'])
            ///////////INSERT///////
            query += `(${jsonData[i]['Product Name']}, ${jsonData[i]['Product Description']}, ${jsonData[i]['Stock']}, ${jsonData[i]['Price']}, ${jsonData[i]['Discount %']}, ${price_after_discount}, ${jsonData[i]['Rating']}, ${jsonData[i]['Product Category']}, ${jsonData[i]['Product Image']})`;
            if (i !== jsonData.length - 1) { query += ','; }
        };

        await pool.execute(query);

        res.status(200).json({
            status: 200,
            message: "Products uploaded successfully",
            success: true
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error"
        });
    }
}


const handleGetAllOrderInfo = async (req, res) => {

    const orderInfoSchema = Joi.object({
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

    let { filter_section } = req.body;
    let { page_number, page_size } = req.query

    const orderInfoData = {
        page_number: page_number,
        page_size: page_size
    };

    const { error, value } = orderInfoSchema.validate(orderInfoData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {

            let query = `SELECT SQL_CALC_FOUND_ROWS order_items.*,products.*,orders.*,order_status.*,users.firstname,users.lastname,order_address_type.* from ${process.env.DB_NAME}.order_items as order_items
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
    WHERE item_status IS NOT NULL AND order_item_datetime IS NOT NULL `;




            if (Object.keys(filter_section).length && filter_section.search_by_order_item_id) {
                query += `AND order_item_id='${filter_section.search_by_order_item_id}' `
            }

            if (Object.keys(filter_section).length && filter_section?.order_item_status) {
                query += `AND item_status IN  (${filter_section.order_item_status.toString().replaceAll(",", ", ")}) `
            }

            if (Object.keys(filter_section).length && filter_section.start_date && filter_section.end_date) {
                query += `AND order_item_datetime >= '${filter_section.start_date} 00:00:00' AND order_item_datetime <= '${filter_section.end_date} 23:59:59' `
            }

            if (page_number && page_size) {
                let offset = (parseInt(page_number) - 1) * (page_size);
                query += `ORDER BY orders.datetime DESC LIMIT ${page_size} OFFSET ${offset}`
            }

            let totalCountQuery = `SELECT FOUND_ROWS() as total`;

            let [result] = await pool.execute(query);

            const [rows2] = await pool.execute(totalCountQuery);

            res.status(200).json({ status: 200, success: true, data: result, total_count: rows2[0].total, message: "Data fetch successfully." })

        } catch (err) {
            res.status(500).json({
                status: 500,
                success: false,
                message: "Internal Server Error"
            });
        }
    }
}

const handleAdminDashboard = async (req, res) => {
    let data = {
        order_count: 0,
        items_ready_to_ship:0,
        items_shipped: 0,
        items_delivered: 0,
        items_return: 0,
        items_cancelled: 0,
        total_amount: 0,
        category_wise_data: []
    }


    try {
        /////////////////////count number of order items////////////////////
        let queryTotalOrderPlaced = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.orders WHERE order_status='3'`;
        let [resultTotalOrderPlaced] = await pool.execute(queryTotalOrderPlaced);
        data['order_count'] = resultTotalOrderPlaced[0].count;

        let queryItemsShipped = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.order_items WHERE item_status='5'`;
        let [resultItemsShipped] = await pool.execute(queryItemsShipped);
        data['items_shipped'] = resultItemsShipped[0].count;

        let queryItemsReadyToShip = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.order_items WHERE item_status='3'`;
        let [resultItemsReadyToShip] = await pool.execute(queryItemsReadyToShip);
        data['items_ready_to_ship'] = resultItemsReadyToShip[0].count;

        let queryItemsDelivered = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.order_items WHERE item_status='12'`;
        let [resultItemsDelivered] = await pool.execute(queryItemsDelivered);
        data['items_delivered'] = resultItemsDelivered[0].count;

        let queryItemsReturn = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.order_items WHERE item_status IN ('6','7','8','9')`;
        let [resultItemsReturn] = await pool.execute(queryItemsReturn);
        data['items_return'] = resultItemsReturn[0].count;

        let queryItemsCancelled = `SELECT COUNT(*) as count from ${process.env.DB_NAME}.order_items WHERE item_status IN ('4','14')`;
        let [resultItemsCancelled] = await pool.execute(queryItemsCancelled);
        data['items_cancelled'] = resultItemsCancelled[0].count;

        let queryTotalAmountReceived = `SELECT SUM(total) as total_amount from ${process.env.DB_NAME}.order_items WHERE item_status IN ('3','4','5','6','7','8','12','13')`;
        let [resultTotalAmountReceived] = await pool.execute(queryTotalAmountReceived);
        data['total_amount'] = parseFloat(resultTotalAmountReceived[0].total_amount);


        let [resultCategories] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.categories ORDER BY cat_id`);

        for (let i = 0; i < resultCategories.length; ++i) {
            let query = `SELECT count(*) as count FROM ${process.env.DB_NAME}.order_items as order_items LEFT JOIN ${process.env.DB_NAME}.products as products on order_items.product_id = products.product_id LEFT JOIN ${process.env.DB_NAME}.categories as categories ON products.category = categories.cat_id WHERE order_items.item_status IS NOT NULL AND products.category='${resultCategories[i].cat_id}'`;
            let [result] = await pool.execute(query);
            data.category_wise_data.push({ category_name: resultCategories[i].category_name, count: result[0].count })
        }

        res.status(200).json({
            status: 200,
            success: true,
            data: data
        })
    } catch (err) {
        res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error"
        });
    }
}


const handleAddAdminOrDelivery = async (req, res) => {

    const userSchema = Joi.object({
        admin_id: Joi.number().required().messages({
            'any.required': 'Admin Id is required.',
        }),
        role: Joi.number().required().messages({
            'any.required': 'role is required.',
        }),
        email: Joi.string().required().messages({
            'any.required': 'Email is required.',
        }),
        password: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Password is required',
        }),
        firstname: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Firstname is required.',
        }),
        lastname: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Lastname is required.',
        }),
    });

    const { email, role, password, admin_id, firstname, lastname } = req.body;

    // Validate the data against the schema

    let userData = {
        admin_id: admin_id,
        role: role,
        email: email,
        password: password,
        firstname: firstname,
        lastname: lastname
    }

    const { error, value } = userSchema.validate(userData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {

        try {

            const [result, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}' AND is_active='1'`);

            if (!result.length) {

                const saltRounds = 5;

                const encryptedPassword = await bcrypt.hash(password, saltRounds);


                const [result] = await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.users (firstname, lastname, role, email, added_by, password, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [firstname, lastname, role, email, admin_id, encryptedPassword,1]
                );

                let data = {
                    "to": email,
                    "subject": "Account Created",
                    "html": `
                        <p>Hi ${firstname+" "+lastname}, Your Account has been created</p>
                        <label>Name: </label><b>${firstname+" "+lastname}</b><br/>
                        <label>Role: </label><b>${role === 1 ? 'Admin':'Delivery Person'}</b><br/>
                        <label>Email: </label><b>${email}</b><br/>
                        <label>Password: </label><b>${password}</b>
                     `
                }

                const response = await sendEmail(data);

                res.status(200).json({
                    message: "Data added successfully",
                    status: 200,
                    success:true
                })
            } else {
                res.status(400).json({
                    message: "User already exists",
                    status: 400,
                    success:false
                })
            }
        } catch (err) {
            res.status(500).json({ 
                success: false,
                message: "Internal server error" });
        }
    }
}
const handleCreateCategory = async (req, res) => {
    const categorySchema = Joi.object({
        cat_name: Joi.string().required().messages({
            'any.required': 'Category is required.',
        })
    });

    const { cat_name } = req.body;

    // Validate the data against the schema

    let categoryData = {
        cat_name: cat_name
    }

    const { error, value } = categorySchema.validate(categoryData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {
            const [result] = await pool.execute(
                `INSERT INTO ${process.env.DB_NAME}.categories (category_name) VALUES (?)`,
                [cat_name]
            );
            res.status(200).json({ success: true, status: 200, message: 'Category added successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}


const handleGetCategoryInfo = async (req, res) => {
    const categorySchema = Joi.object({
        cat_id: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide Category Id',
            'number.integer': 'Please provide a valid Category Id',
            'any.required': 'Category Id is required',
            'number.min': 'Category Id must be at least 1.',
        }),
    });

    const { cat_id } = req.query;

    // Validate the data against the schema

    let categoryData = {
        cat_id: cat_id
    }

    const { error, value } = categorySchema.validate(categoryData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {
            const [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.categories WHERE cat_id = '${cat_id}'`);
            res.status(200).json({ success: true, data: result, status: 200, message: 'Data fetch successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const handleUpdateCategoryInfo = async (req, res) => {

    const categorySchema = Joi.object({
        cat_id: Joi.number().integer().min(1).required().messages({
            'number.base': 'Please provide Category Id',
            'number.integer': 'Please provide a valid Category Id',
            'any.required': 'Category Id is required',
            'number.min': 'Category Id must be at least 1.',
        }),
        banner_url: Joi.string()
            .uri()
            .optional()
            .allow("")
            .messages({
                'string.uri': 'Banner URL must be a valid URL',
            }),
        redirect_url: Joi.string()
            .uri()
            .optional()
            .allow("")
            .messages({
                'string.uri': 'Redirect URL must be a valid URL',
            }),
        banner_is_active: Joi.number()
            .valid(0, 1)
            .messages({
                'number.base': 'Status must be a number',
                'any.only': 'Banner status must be either 0 or 1'
            })
    });


    let { cat_id, banner_url, banner_is_active,redirect_url } = req.body;

    let categoryData = {
        cat_id: cat_id,
        banner_url: banner_url,
        banner_is_active: banner_is_active,
        redirect_url:redirect_url
    }

    const { error, value } = categorySchema.validate(categoryData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {


        try {
            await pool.execute(
                `UPDATE ${process.env.DB_NAME}.categories SET
        banner_url = '${banner_url}',
        banner_is_active = '${banner_is_active}',
        redirect_url = '${redirect_url}'
        WHERE cat_id = ${cat_id}`);
            res.status(200).json({ success: true, message: "Data updated successfully" });
        } catch (err) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}



module.exports = {
    handleCreateOrUpdateProduct,
    handleGetAllOrdersAdmin,
    handleUploadProductSheet,
    handleGetAllOrderInfo,
    handleAdminDashboard,
    handleAddAdminOrDelivery,
    handleCreateCategory,
    handleGetCategoryInfo,
    handleUpdateCategoryInfo
}
