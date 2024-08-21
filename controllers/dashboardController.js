
const pool = require("../config");
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const xlsx = require('xlsx');


const handleMainPage = async (req, res) => {

    const LIMIT = 10;

    let token = req.headers.authorization;
    // Verify the token and decode its payload
    let decoded = token ? jwt.verify(token, process.env.SECRET_KEY) : null;

    try {

        let data = {}

        let resObj = [];

        const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.categories`);

        for (let i = 0; i < rows.length; ++i) {

            let query = `SELECT SQL_CALC_FOUND_ROWS * FROM ${process.env.DB_NAME}.products where category='${rows[i].cat_id}' AND is_active = '1' LIMIT ${LIMIT}`;
            let totalCountQuery = `SELECT FOUND_ROWS() as total`;
            const [categoryProductData] = await pool.execute(query);
            const [totalCategoryProduct] = await pool.execute(totalCountQuery);


            resObj.push({
                ...rows[i],
                total: totalCategoryProduct[0].total,
                products: [...categoryProductData]
            })

        }

        data["product_with_categories"] = resObj;


        if (token) {
            const [results] = await pool.execute(`
        SELECT * FROM ${process.env.DB_NAME}.recently_viewed_products AS recently_viewed_products
        LEFT JOIN 
        ${process.env.DB_NAME}.products AS products ON 
        recently_viewed_products.product_id = products.product_id
        where recently_viewed_products.user_id='${decoded.user_id}' AND products.is_active='1' 
        ORDER BY recently_viewed_products.watch_datetime DESC LIMIT 10`);
            ///////give 10 products of each category and also maintain banners/////////
        data["recently_watched_items"] = results;
        }



        res.status(200).json({
            data: data,
            status: 200,
            message: "Data fetch successfully",
            success: true
        })

    } catch (err) {
        res.status(500).json({
            status: 500,
            success: false,
            message: "Something went wrong"
        })
    }
}


const handleGetAllDropdownValues = async (req, res) => {

    let { product_categories, order_status_dropdown } = req.body;

    let response = {};

    try {
        if (product_categories) {
            let [result] = await pool.query(`SELECT * FROM ${process.env.DB_NAME}.categories`);
            response['categories'] = result;
        }

        if (order_status_dropdown) {

            let token = req.headers.authorization;
            // Verify the token and decode its payload
            const decoded = jwt.verify(token, process.env.SECRET_KEY);

            let query = decoded.role !== 2 ?
                `SELECT * FROM ${process.env.DB_NAME}.order_status`
                :
                `SELECT * FROM ${process.env.DB_NAME}.order_status WHERE status_id IN ('7', '12')`;

            let [result] = await pool.query(query);
            response['order_status_dropdown'] = result;
        }
        res.status(200).json({
            message: "Data fetch successfully",
            success: true,
            status: 200,
            data: response
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}


const handleUploadAllPincodes = async (req, res) => {
    try {
        let filePath = req.files.pincode_data_file.tempFilePath;
        const workbook = xlsx.readFile(filePath);
        // Assuming only one sheet in the Excel file
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert sheet data to JSON
        const jsonData = xlsx.utils.sheet_to_json(sheet);

        for (let i = 0; i < jsonData.length; ++i) {
            ///////////INSERT///////
            await pool.execute(
                `INSERT INTO ${process.env.DB_NAME}.pincode (pincode,state,district) VALUES (?, ?, ?)`,
                [jsonData[i].Pincode, jsonData[i].District.toUpperCase(), jsonData[i].StateName.toUpperCase()]
            );
            console.log(i);
        };

        res.status(200).json({
            status: 200,
            message: "Pincodes inserted successfully.",
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


const handleGetPinCodeDetails = async (req, res) => {
    const pincodeSchema = Joi.object({
        pincode: Joi.
            string().regex(/^[0-9]{6}$/)
            .required()
            .messages({
                'string.pattern.base': `Pincode must have 6 digits.`,
                'any.required': 'Pincode is required.'
            })
    });

    let { pincode } = req.query;

    const pincodeData = {
        pincode: pincode
    };

    const { error, value } = pincodeSchema.validate(pincodeData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {

        try {

            let [result] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.pincode where pincode='${pincode}'`);

            if (result.length) {
                res.status(200).json({
                    status: 200,
                    success: true,
                    data: result[0],
                    message: "Pincode details fetch successfully."
                })
            } else {
                res.status(400).json({ status: 400, success: false, message: "Invalid Pincode" })
            }
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}


module.exports = {
    handleMainPage,
    handleGetAllDropdownValues,
    handleGetPinCodeDetails,
    handleUploadAllPincodes
}
