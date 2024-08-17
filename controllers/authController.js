const pool = require("../config");
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { sendEmail, generateOTP } = require("./common");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const saltRounds = 5;


const handleSignupController = async (req, res) => {

    const userSchema = Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format. Please provide a valid email address.',
            'any.required': 'Email is required.',
        }),
        firstname: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Firstname is required.',
        }),
        lastname: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Lastname is required.',
        }),
    });


    const { email, firstname, lastname } = req.body;

    const userData = {
        email: email,
        firstname: firstname,
        lastname: lastname,
    };

    // Validate the data against the schema
    const { error, value } = userSchema.validate(userData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    }
    else {
        try {
            console.log(await pool.getConnection())
            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}'`);
            ////////////////check if the user is already registered then signup directly//////////
            if ((rows.length) && rows[0].is_active) {
                res.status(400).json({ status: 400, success: false, message: "User already exist.Please Signin with your email and password." });
            } else if ((rows.length) && !rows[0].is_active) {
                ///////////if the user again try to sign up just update the hash and send the mail again/////

                let hash = uuidv4();

                let data = {
                    "to": email,
                    "subject": "Verify Your Email Address",
                    "html": `
                        <p>Thank you for registering with us. To complete the registration process, please click on the following link to verify your email address:</p>
                        <a href='${process.env.FRONTEND_URL}/confirm-password?hash_id=${hash}'>
                        Click here
                        </a>`
                }


                const response = await sendEmail(data);





                const [result] = await pool.execute(
                    `UPDATE ${process.env.DB_NAME}.users SET hash=? WHERE user_id=?`,
                    [hash, rows[0].user_id]
                );

                res.status(200).json({ success: true, status: 200, message: 'Please check your email' });

            } else {
                //////////insert the user into database and send the mail//////////////
                let hash = uuidv4();

                let data = {
                    "to": email,
                    "subject": "Verify Your Email Address",
                    "html": `
                    <p>Thank you for registering with us. To complete the registration process, please click on the following link to verify your email address:</p>
                    <a href='${process.env.FRONTEND_URL}/confirm-password?hash_id=${hash}'>
                    Click here
                    </a>`
                }

                const response = await sendEmail(data);


                const [result] = await pool.execute(
                    `INSERT INTO ${process.env.DB_NAME}.users (firstname, lastname, email, hash) VALUES (?, ?, ?, ?)`,
                    [firstname, lastname, email, hash]
                );

                res.status(200).json({ success: true, status: 200, message: 'Please check your email' });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}



const handleSetPassword = async (req, res) => {

    const userSchema = Joi.object({
        hash: Joi.string().required().messages({
            'any.required': 'Hashcode is required.',
        }),
        password: Joi.string().min(8).max(20).required().messages({
            'any.required': 'Password is required',
        }),
    });


    const { hash, password } = req.body;

    // Validate the data against the schema


    let userData = {
        hash: hash,
        password: password
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
            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where hash='${hash}'`);

            if (rows.length) {

                const encryptedPassword = await bcrypt.hash(password, saltRounds);

                const [result] = await pool.execute(
                    `UPDATE ${process.env.DB_NAME}.users SET password= ?, is_active= ?  WHERE hash= ?`,
                    [encryptedPassword, true, hash]
                );
                res.status(200).json({ status: 200, success: true, message: "Password set successfully.Please login." })
            } else {
                res.status(400).json({ status: 400, success: false, message: "Invalid link" })
            }
        }
        catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}


const handleSignin = async (req, res) => {

    const userSchema = Joi.object({
        email: Joi.string().required().messages({
            'any.required': 'Email is required.',
        }),
        password: Joi.string().min(3).max(30).required().messages({
            'any.required': 'Password is required',
        }),
    });

    const { email, password } = req.body;

    // Validate the data against the schema

    let userData = {
        email: email,
        password: password
    }

    const { error, value } = userSchema.validate(userData);

    if (!error) {

        const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}'`);

        if (rows.length) {

            if (!rows[0].is_active) {
                res.status(401).json({
                    status: 401,
                    success: false,
                    message: "Your verification is in the pending state.Please verify your email first."
                });
            }
            else {

                let result = await bcrypt.compare(password, rows[0].password);

                if (!result) {
                    res.status(401).json({
                        status: 400,
                        success: false,
                        message: "Please provide correct password for login."
                    });
                }
                else {
                    const payload = {
                        user_id: rows[0].user_id,
                        email: rows[0].email,
                        role: rows[0].role,
                        name: rows[0].firstname + " " + rows[0].lastname
                    };

                    const secret = process.env.SECRET_KEY;

                    let userInfo = { ...rows[0] }
                    delete userInfo['password'];
                    delete userInfo['hash'];
                    delete userInfo['created_at'];
                    delete userInfo['address'];
                    delete userInfo['is_active'];
                    delete userInfo['otp'];

                    const options = { expiresIn: '1y' };

                    let accessToken = jwt.sign(payload, secret, options);

                    res.status(200).json
                        ({
                            status: 200,
                            success: true,
                            user: userInfo,
                            accessToken: accessToken,
                            message: "Congratulations, you've successfully logged in!"
                        })
                }
            }
        }
        else {
            res.status(400).json({
                status: 400,
                success: false,
                message: "User is not register with us.Please Signup with your email."
            });
        }

    } else {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    }
}


const handleSendOtp = async (req, res) => {

    const userSchema = Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format. Please provide a valid email address.',
            'any.required': 'Email is required.',
        })
    });


    const { email } = req.body;

    const userData = {
        email: email,
    };

    // Validate the data against the schema
    const { error, value } = userSchema.validate(userData);

    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    }
    else {
        try {
            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}'`);
            if (rows.length) {
                if (!rows[0].is_active) {
                    /////////////plaese verify your email first///////
                    res.status(400).json({ status: 400, success: false, message: "Please verify your email first." });
                } else {
                    //////////////send otp///////
                    let otp = generateOTP();
                    /////////update otp in user database///////
                    let data = {
                        to: email,
                        subject: "OTP Verification",
                        html: `<p>Your OTP is: <b>${otp}</b>. Please enter this code to verify your identity. Do not share this code with anyone.</p>`
                    }
                    const response = await sendEmail(data);
                    const [result] = await pool.execute(
                        `UPDATE ${process.env.DB_NAME}.users SET otp =? WHERE email=?`,
                        [otp, email]
                    );
                    res.status(200).json({
                        success: true,
                        message: `Otp sent successfully at ${email} `,
                        email: email,
                        status: 200
                    })
                }
            } else {
                //////////////email not found////////////
                res.status(404).json({ status: 401, success: false, message: "Please provide correct user email." });
            }
        }
        catch (error) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }

    }
}


const handleVerifyOtp = async (req, res) => {

    const { email, otp } = req.body;

    try {
        const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}'`);

        if (rows.length) {

            if (!rows[0].is_active) {
                /////////////plaese verify your email first///////
                res.status(400).json({ status: 400, success: false, message: "Please verify your email." });
            }
            else {

                if (rows[0].otp === otp) {

                    let hash = uuidv4();

                    const [result] = await pool.execute(
                        `UPDATE ${process.env.DB_NAME}.users SET hash=? WHERE user_id=?`,
                        [hash, rows[0].user_id]
                    );

                    res.status(200).json({
                        success: true, status: 200, data:
                        {
                            hash: hash
                        }, message: 'Otp verified successfully.'
                    });


                } else {
                    ///////wrong otp///////
                    res.status(400).json({ status: 400, success: false, message: "Invalid Otp." });
                }
            }

        }
        else {
            //////////////email not found////////////
            res.status(401).json({ status: 401, success: false, message: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}


const handleSendOtpUpdateEmail = async (req, res) => {
    const userSchema = Joi.object({
        email: Joi.string().required().messages({
            'any.required': 'Email is required.',
        })
    });
    const { email } = req.body;
    const userData = {
        email: email,
    };
    // Validate the data against the schema
    const { error, value } = userSchema.validate(userData);
    if (error) {
        res.status(400).json({
            status: 400,
            success: false,
            message: error.details[0].message
        })
    } else {
        try {

            const [rows, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where email='${email}'`);

            if (rows.length) {
                if (rows[0].is_active) {
                    /////////////plaese verify your email first///////
                    res.status(400).json({ status: 400, success: false, message: "Email is already registered with us." });
                }
            } else {
                ////////////////////send the OTP to the email and update the OTP from the token////////////
                let token = req.headers.authorization;
                // Verify the token and decode its payload
                const decoded = jwt.verify(token, process.env.SECRET_KEY);

                let otp = generateOTP();
                /////////update otp in user database///////
                let data = {
                    to: email,
                    subject: "OTP Verification",
                    html: `<p>Your OTP is: <b>${otp}</b>. Please enter this code to verify your identity. Do not share this code with anyone.</p>`
                }
                const response = await sendEmail(data);

                const [result] = await pool.execute(`UPDATE ${process.env.DB_NAME}.users SET otp = '${otp}' WHERE user_id='${decoded.user_id}'`);

                res.status(200).json({
                    success: true,
                    message: `Otp sent successfully at ${email}`,
                    email: email,
                    status: 200
                })
            }
        } catch (err) {
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

const handleVerifyOtpUpdateEmail = async (req, res) => {

    const { email, otp } = req.body;

    try {

        let token = req.headers.authorization;
        // Verify the token and decode its payload
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        const [result, fields] = await pool.execute(`SELECT * FROM ${process.env.DB_NAME}.users where user_id='${decoded.user_id}'`);

        if (result[0].otp === otp) {
            ///////////////update the email now///////////////////
            const [result] = await pool.execute(`UPDATE ${process.env.DB_NAME}.users SET email= '${email}' WHERE user_id='${decoded.user_id}'`);

            res.status(200).json({ status: 200, success: true, message: "Email updated successfully" });
        } else {
            res.status(400).json({ status: 400, success: false, message: "Invalid OTP" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}



module.exports =
{
    handleSignupController,
    handleSetPassword,
    handleSignin,
    handleSendOtp,
    handleVerifyOtp,
    handleSendOtpUpdateEmail,
    handleVerifyOtpUpdateEmail,
}
