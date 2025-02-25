const json = require('express');
var db = require('../helpers/db_helpers');
var helper = require('./../helpers/helpers');
var multiparty = require('multiparty');
var fs = require('fs');
const moment = require('moment-timezone');
var imageServerPath = "./public/img/"
//app.use(express.json());
var messages = require('../utils/messages');
const helpers = require('./../helpers/helpers');
const express = require('express');
const path = require('path');
var delivery_price = 10.0

//HELPER FUNCTIONS
function getUserData(user_id, callback) {
    db.query(`
                 SELECT 
                     user_id,
                     username, 
                     name, 
                     email, 
                     password, 
                     mobile, 
                     mobile_code,
                     address,   
                     auth_token, 
                     device_token,
                     user_type,
                     status,
                     created_date, 
                     updated_date 
                 FROM 
                     user_details
                 WHERE 
                     user_id = ? AND status = ?`, [user_id, "1"], (err, result) => {
        if (err) {
            return callback(false, null);
        }
        if (result.length > 0) {
            return callback(true, result[0]);
        } else {
            return callback(false, null);
        }
    });
}

function getUserWithPasswordData(email, password, callback) {
    db.query(`
        SELECT 
            user_id,
            username, 
            name, 
            email, 
            password, 
            mobile, 
            mobile_code,
            address,   
            auth_token, 
            device_token,
            user_type,
            status,
            created_date, 
            updated_date 
        FROM 
            user_details
        WHERE 
            email = ? AND password = ? AND status = ?`,
        [email, password, "1"], (err, result) => {
            if (err) {
                return callback(false, null);
            }
            if (result.length > 0) {
                return callback(true, result[0]);
            } else {
                return callback(false, null);
            }
        });
}

function saveImage(imageFile, savePath) {
    fs.rename(imageFile.path, savePath, (err) => {
        if (err) {
            helper.throwHtmlError(err);
            return;
        }
    })
}

function checkAccessToken(headerObj, res, callback, require_type = "") {
    helper.dlog(headerObj.access_token);
    helper.checkParameterValid(res, headerObj, ["access_token"], () => {
        db.query(`
            SELECT 
                user_id,
                username, 
                name, 
                email, 
                password, 
                mobile, 
                mobile_code,
                address,   
                auth_token, 
                device_token,
                user_type,
                status,
                created_date, 
                updated_date 
            FROM 
                user_details
            WHERE 
                auth_token = ? AND status = ?`, [headerObj.access_token, "1"], (err, result) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }
            helper.dlog(result);

            if (result.length > 0) {
                if (require_type !== "") {
                    if (result[0].user_type == require_type) {
                        return callback(result[0]);
                    } else { res.json({ "status": "0", "code": "404", "message": "Access denied. Unathorize user access" }) }
                } else {
                    return callback(result[0]);
                }
            } else {
                res.json({ "status": "0", "code": "404", "message": "Access denied. Unathorize user access" })
            }
        }
        )
    })
}

function getProductDetail(res, product_id) {
    // First Query: Get Product Details
    const productDetailsQuery = `
        SELECT 
            pd.product_id, pd.category_id, pd.brand_id, 
            pd.type_id, pd.product_name, pd.details, pd.unit_name, 
            pd.unit_value, pd.price, pd.status, pd.created_date, 
            pd.updated_date, cd.category_name, 
            (CASE WHEN fd.favorite_id IS NOT NULL THEN 1 ELSE 0 END) AS is_favorite,
            IFNULL(bd.brand_name, '') AS brand_name, 
            td.type_name, 
            IFNULL(od.price, pd.price) AS offer_price, 
            IFNULL(od.start_date, '') AS start_date,
            IFNULL(od.end_date, '') AS end_date, 
            (CASE WHEN od.offer_id IS NOT NULL THEN 1 ELSE 0 END) AS is_offer_active
        FROM product_details AS pd
        INNER JOIN category_details AS cd ON pd.category_id = cd.category_id
        LEFT JOIN brand_detail AS bd ON pd.brand_id = bd.brand_id 
        LEFT JOIN favorite_detail AS fd ON pd.product_id = fd.product_id AND fd.status = 1
        LEFT JOIN offer_detail AS od ON pd.product_id = od.product_id 
            AND od.status = 1 
            AND od.start_date <= NOW() 
            AND od.end_date >= NOW()
        INNER JOIN type_details AS td ON pd.type_id = td.type_id
        WHERE pd.status = ? AND pd.product_id = ?;
    `;

    // Second Query: Get Nutrition Details
    const nutritionDetailsQuery = `
        SELECT 
            nutrition_id, 
            product_id, 
            nutrition_name, 
            nutrition_value, 
            nutrition_weight, 
            nutrition_date, 
            status, 
            created_date, 
            updated_date
        FROM nutrition_details 
        WHERE product_id = ? 
            AND status = ?
        ORDER BY nutrition_name;
    `;

    // Third Query: Get Image Details
    const imageDetailsQuery = `
        SELECT 
            image_id, 
            product_id, 
            image 
        FROM image_detail 
        WHERE product_id = ? 
            AND status = ?;
    `;

    // Execute queries sequentially
    db.query(productDetailsQuery, [1, product_id], (err, productResult) => {
        if (err) {
            helper.throwHtmlError(err, res);
            return;
        }

        if (productResult.length === 0) {
            return res.json({ status: "0", message: "Invalid item" });
        }

        // Product details found, proceed to get nutrition details
        db.query(nutritionDetailsQuery, [product_id, 1], (err, nutritionResult) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }

            // Proceed to get image details
            db.query(imageDetailsQuery, [product_id, 1], (err, imageResult) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }

                // Combine all results into a single response
                const responsePayload = {
                    ...productResult[0],
                    nutrition_list: nutritionResult,
                    images: imageResult,
                };

                res.json({ status: "1", payload: responsePayload, message: "Success" });
            });
        });
    });
}

function getUserCart(res, user_id, image_base_url, callback) {
    db.query(
        `
        SELECT 
            pd.product_id,
            pd.product_name,
            cd.category_name,
            bd.brand_name,
            td.type_name,
            pd.price,
            od.price AS offer_price,
            2 AS quantity, 
            (2 * od.price) AS total_price,
            pd.unit_name,
            pd.unit_value,
            (CASE WHEN imd.image != '' 
                THEN CONCAT(?, imd.image) 
                ELSE '' 
            END) AS image,  
            (CASE WHEN fd.favorite_id IS NOT NULL THEN 1 ELSE 0 END) AS is_favorite
        FROM offer_detail AS od
        LEFT JOIN product_details AS pd 
            ON pd.product_id = od.product_id AND pd.status = 1
        LEFT JOIN image_detail AS imd 
            ON pd.product_id = imd.product_id AND imd.status = 1
        LEFT JOIN category_details AS cd 
            ON cd.category_id = pd.category_id AND cd.status = 1
        INNER JOIN brand_detail AS bd 
            ON bd.brand_id = pd.brand_id AND bd.status = 1
        LEFT JOIN favorite_detail AS fd 
            ON pd.product_id = fd.product_id AND fd.status = 1 AND fd.user_id = ?
        LEFT JOIN type_details AS td 
            ON pd.type_id = td.type_id AND td.status = 1
        WHERE od.status = 1 
          AND od.start_date <= NOW()
        `,
        [image_base_url, user_id],
        (err, result) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }
            let total = result.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
            return callback(result, total);
        }
    );
}


//END-POINT
module.exports.controllers = (app, io, user_socket_connect_list) => {
    const image_base_url = helper.ImagePath();
    //SIGN-UP
    app.post('/api/sign_up', (req, res) => {
        helper.dlog(req.body); // Log request for debugging
        var reqObj = req.body;

        helper.checkParameterValid(res, reqObj,
            ["username", "name", "email", "mobile", "mobile_code", "address", "password", "device_token"], () => {

                // New Username Rules using validateUsername
                if (!helper.validateUsername(reqObj.username)) {
                    // Generate username suggestions
                    const suggestions = helper.generateUsername(reqObj.username);
                    return res.status(400).json({
                        status: "0",
                        message: messages.invalidUsername,
                        suggestions
                    });
                }

                // Check if username already exists
                db.query("SELECT username FROM user_details WHERE username = ?", [reqObj.username], (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }

                    if (result.length > 0) {
                        // Username exists, generate suggestions
                        const suggestions = helper.generateUsername(reqObj.username);
                        return res.status(409).json({
                            status: "0",
                            message: messages.existUsername,
                            suggestions
                        });
                    }

                    // Check if email already exists
                    db.query("SELECT user_id, email FROM user_details WHERE email = ?", [reqObj.email], (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        if (result.length === 0) {
                            // Email not found, proceed with registration
                            const authToken = helper.createRequstToken();

                            db.query(`
                                    INSERT INTO user_details 
                                    (username, name, email, password, mobile, mobile_code, address, 
                                    auth_token, device_token, reset_code, created_date, updated_date) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                                [reqObj.username, reqObj.name, reqObj.email, reqObj.password, reqObj.mobile,
                                reqObj.mobile_code, reqObj.address, authToken, reqObj.device_token, null],
                                (err, iResult) => {

                                    if (err) {
                                        console.error('Database error on INSERT:', err); // Log error for debugging
                                        res.status(500).json({ status: "0", message: "Database error" });
                                        return;
                                    }

                                    if (iResult && iResult.insertId) {
                                        // Fetch user data for response
                                        getUserData(iResult.insertId, (status, userObj) => {
                                            if (status) {
                                                res.json({ status: "1", payload: userObj, message: messages.success });
                                            } else {
                                                console.error('Error fetching user data'); // Log error for debugging
                                                res.status(500).json({ status: "0", message: messages.fail });
                                            }
                                        });
                                    } else {
                                        res.status(400).json({ status: "0", message: messages.fail });
                                    }
                                });
                        } else {
                            res.status(409).json({ status: "0", message: messages.existEmail });
                        }
                    });
                });
            }
        );
    });
    // LOGIN
    app.post('/api/login', (req, res) => {
        helper.dlog(req.body);  // for debugging
        var reqObj = req.body;

        helper.checkParameterValid(res, reqObj, ["username", "email", "password", "device_token"], () => {
            // check if user with the param exist
            getUserWithPasswordData(reqObj.email, reqObj.password, (status, result) => {
                if (status) {
                    // User exist, generate auth_token
                    const auth_token = helper.createRequstToken();

                    db.query(`
                        UPDATE user_details
                         SET auth_token = ?, device_token = ?, created_date = NOW() - INTERVAL 11 DAY
                         WHERE user_id = ? AND status = ?`,
                        [auth_token, reqObj.device_token, result.user_id, "1"], (err, uresult) => {
                            if (err) {
                                res.json({ status: "0", message: "Database error" });
                                return;
                            }

                            if (uresult.affectedRows > 0) {
                                getUserData(result.user_id, (fetchStatus, fetchResult) => {
                                    if (fetchStatus) {
                                        fetchResult.auth_token = auth_token;
                                        res.status(200).json({ status: "1", payload: fetchResult, message: messages.success });
                                    } else {
                                        res.status(500).json({ status: "0", message: messages.fail });
                                    }
                                });
                            } else {
                                res.status(401).json({ status: "0", message: messages.invalidUserPassword });
                            }
                        });
                } else {
                    res.status(401).json({ status: "0", message: messages.invalidUserPassword });
                }
            });
        });
    });
    //Forgot Password Request
    app.post('/api/forgot_password_request', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        // Validate the required parameter 'email'
        helper.checkParameterValid(res, reqObj, ["email"], () => {
            db.query("SELECT user_id, email FROM user_details WHERE email = ?", [reqObj.email], (err, result) => {
                if (err) {
                    // Log and handle database errors
                    helper.throwHtmlError(err, res);
                    return;
                }

                if (result.length > 0) {
                    var resetCode = helper.createNumber();
                    db.query(
                        `UPDATE user_details SET reset_code = ? WHERE email = ? AND status = ?`,
                        [resetCode, reqObj.email, "1"],
                        (err, uresult) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }

                            if (uresult.affectedRows > 0) {
                                // Successfully updated reset_code
                                res.json({
                                    status: "1", payload: { reset_code: resetCode },
                                    message: messages.success
                                });
                            } else {
                                // Failed to update reset_code, possibly due to an invalid status
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );
                } else {
                    // Email does not exist in the database
                    res.json({ status: "0", message: messages.existEmail });
                }
            });
        });
    });
    // Forgot Password Verify
    app.post('/api/forgot_password_verify', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        // Validate required parameters 'email' and 'resetCode'
        helper.checkParameterValid(res, reqObj, ["email", "reset_code"], () => {
            // Query the database for user details matching email and reset_code
            db.query("SELECT user_id, email FROM user_details WHERE email = ? AND reset_code = ?",
                [reqObj.email, reqObj.reset_code], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }

                    if (result.length > 0) {
                        // Successfully verified email and reset code
                        res.json({
                            status: "1",
                            payload: {
                                "user_id": result[0].user_id
                            },
                            message: messages.success
                        });
                    } else {
                        // Email or reset code does not exist or match in the database
                        res.json({ status: "0", message: messages.invalidResetCode });
                    }
                });
        });
    });
    // Forgot Password Update
    app.post('/api/forgot_password_reset', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        helper.checkParameterValid(res, reqObj, ["user_id", "reset_code", "new_password"], () => {
            // Query to update password if reset_code is valid
            db.query("UPDATE user_details SET password = ? WHERE user_id = ? AND reset_code = ? AND status = ?",
                [reqObj.new_password, reqObj.user_id, reqObj.reset_code, "1"], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    if (result.affectedRows > 0) {
                        res.json({ status: "1", message: messages.updatePassword });
                    } else {
                        // Failed to update password, possibly due to an invalid reset code or status
                        res.json({ status: "0", message: messages.fail });
                    }
                });
        });
    });

    app.post('/api/update_profile', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["user_id", "name", "email", "mobile", "mobile_code", "address", "username"], () => {

                db.query(
                    `UPDATE user_details SET name = ?, email = ?, mobile = ?,mobile_code = ?,
                    address = ?,username = ?, updated_date = NOW() WHERE user_id = ? AND status = ?`,
                    [reqObj.name, reqObj.email, reqObj.mobile,
                    reqObj.mobile_code, reqObj.address, reqObj.username, reqObj.user_id, "1"],
                    (err, uresult) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        if (uresult.affectedRows > 0) {
                            // Successfully updated reset_code
                            getUserData(userObj.user_id, (status, userObj) => {
                                if (status) {
                                    res.json({ status: "1", payload: userObj, message: messages.success });
                                } else {
                                    console.error('Error fetching user data'); // Log error for debugging
                                    res.status(500).json({ status: "0", message: messages.fail });
                                }
                            });
                        } else {
                            // Failed to update reset_code, possibly due to an invalid status
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        });
    });

    app.post('/api/update_username', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["user_id", "username"], () => {
                const newUsername = reqObj.username;

                // Validate the new username 
                if (!helper.validateUsername(newUsername)) {
                    // Generate username suggestions
                    const suggestions = helper.generateUsername(newUsername);
                    return res.status(400).json({
                        status: "0", message: messages.invalidUsername, suggestions,
                    });
                }

                // Check if the username already exists
                db.query(
                    `SELECT COUNT(*) AS count FROM user_details WHERE username = ? AND user_id != ?`,
                    [newUsername, reqObj.user_id],
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        if (result[0].count > 0) {
                            // Generate username suggestions for existing username
                            const suggestions = helper.generateUsername(newUsername);
                            return res.status(409).json({
                                status: "0", message: messages.userNameExist, suggestions,
                            });
                        }

                        // Update the username in the database
                        db.query(
                            `UPDATE user_details 
                             SET username = ?, updated_date = NOW() 
                             WHERE user_id = ? AND status = ?`,
                            [newUsername, reqObj.user_id, "1"],
                            (err, uresult) => {
                                if (err) {
                                    console.error("Database error:", err);
                                    helper.throwHtmlError(err, res);
                                    return;
                                }

                                if (uresult.affectedRows > 0) {
                                    // Fetch updated user data
                                    getUserData(reqObj.user_id, (status, userObj) => {
                                        if (status) {
                                            res.json({
                                                status: "1", payload: userObj, message: messages.usernameUpdated,
                                            });
                                        } else {
                                            console.error("Error fetching updated user data");
                                            res.status(500).json({ status: "0", message: messages.fail, });
                                        }
                                    });
                                } else {
                                    res.json({ status: "0", message: messages.usernameFail, });
                                }
                            }
                        );
                    }
                );
            });
        });
    });

    app.post('/api/upload_image', (req, res) => {
        var form = new multiparty.Form();
        form.parse(req, (err, reqObj, files) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }
            helper.dlog("------------------Parameter--------------")
            helper.dlog(reqObj);
            helper.dlog("------------------Files--------------")
            helper.dlog(files);

            if (files.image != undefined || files.image != null) {
                var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
                var imageFileName = helper.fileNameGenerate(extension);

                var newPath = imageServerPath + imageFileName;

                fs.rename(files.image[0].path, newPath, (err) => {
                    if (err) {
                        helper.throwHtmlError(err,);
                        return;
                    } else {

                        var name = reqObj.name;
                        var address = reqObj.address;

                        helper.dlog(name);
                        helper.dlog(address);

                        res.json({
                            status: "1", payload: { "name": name, "address": address, "image": helper.ImagePath() + imageFileName },
                            message: messages.success
                        });
                    }
                })
            }
        })
    })

    app.post('/api/upload_multiple_image', (req, res) => {
        var form = new multiparty.Form();

        form.parse(req, (err, reqObj, files) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }
            helper.dlog("------------------Parameter--------------")
            helper.dlog(reqObj);
            helper.dlog("------------------Files--------------")
            helper.dlog(files);

            if (files.image != undefined || files.image != null) {

                var imageNamePathArr = [];
                var fullImageNamePathArr = [];

                var name = reqObj.name
                var address = reqObj.address

                helper.dlog(name);
                helper.dlog(address);

                files.image.forEach(imageFile => {
                    var extension = imageFile.originalFilename.substring(imageFile.originalFilename.lastIndexOf(".") + 1)
                    var imageFileName = helper.fileNameGenerate(extension);
                    imageNamePathArr.push(imageFileName);
                    fullImageNamePathArr.push(helper.ImagePath() + imageFileName)

                    saveImage(imageFile, imageServerPath + imageFileName);

                    helper.dlog(imageNamePathArr);
                    helper.dlog(fullImageNamePathArr);


                })
                res.json({
                    status: "1", payload: { "name": name, "address": address, "image": fullImageNamePathArr },
                    message: messages.success
                });


            }
        })
    })

    app.post('/api/update_image', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        var form = new multiparty.Form();
        checkAccessToken(req.headers, res, (userObj) => {
            form.parse(req, (err, reqObj, files) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }
                helper.dlog("------------------Parameter--------------")
                helper.dlog(reqObj);
                helper.dlog("------------------Files--------------")
                helper.dlog(files);


                helper.checkParameterValid(res, files, ["image"], () => {

                    var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
                    var imageFileName = "user/" + helper.fileNameGenerate(extension);

                    var newPath = imageServerPath + imageFileName;

                    fs.rename(files.image[0].path, newPath, (err) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        } else {
                            db.query(`UPDATE user_details SET image = ?, updated_date = NOW() 
                                            WHERE 
                                            user_id = ? AND status = ?`,
                                [imageFileName, reqObj.user_id[0], "1"], (err, result) => {
                                    if (err) {
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    if (result) {
                                        getUserData(userObj.user_id, (status, userObj) => {
                                            if (status) {
                                                res.json({ status: "1", payload: userObj, message: messages.success });
                                            } else {
                                                console.error('Error fetching user data'); // Log error for debugging
                                                res.status(500).json({ status: "0", message: messages.fail });
                                            }
                                        });
                                    } else {
                                        res.json({ "status": "0", "message": messages.fail });
                                    }
                                }
                            );
                        }
                    })

                })
            })
        })
    })

    app.post('/api/get_zone_area', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        const query = `
        SELECT zd.zone_id, zd.zone_name, ad.area_id, ad.name 
        FROM zone_detail zd
        LEFT JOIN area_detail ad ON zd.zone_id = ad.zone_id 
        WHERE zd.status = ? AND ad.status = ?
    `;

        db.query(query, ["1", "1"], (err, result) => {
            if (err) {
                helper.throwHtmlError(err, res);
                return;
            }

            const zoneMap = {};

            result.forEach(row => {
                if (!zoneMap[row.zone_id]) {
                    zoneMap[row.zone_id] = {
                        zone_id: row.zone_id,
                        zone_name: row.zone_name,
                        area_list: []
                    };
                }
                if (row.area_id) {
                    zoneMap[row.zone_id].area_list.push({
                        area_id: row.area_id,
                        name: row.name
                    });
                }
            });

            res.json({
                status: "1",
                payload: Object.values(zoneMap),
                message: messages.success
            });
        });
    });

    app.post('/api/app/home', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;
        const image_base_url = helper.ImagePath();

        checkAccessToken(req.headers, res, () => {
            // First query - Fetch active offers
            db.query(`
                SELECT 
                    od.price AS offer_price, od.start_date, od.end_date, pd.product_id, 
                    pd.category_id, pd.brand_id, pd.type_id, pd.details, pd.unit_name, 
                    pd.unit_value, pd.price, 
                    (CASE WHEN imd.image != '' 
                        THEN CONCAT(?, imd.image) 
                        ELSE '' 
                    END) AS image,  
                    cd.category_name, 
                    td.type_name, 
                    (CASE WHEN fd.favorite_id IS NOT NULL THEN 1 ELSE 0 END) AS is_favorite
                FROM offer_detail AS od
                INNER JOIN product_details AS pd ON pd.product_id = od.product_id AND pd.status = 1
                INNER JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                INNER JOIN category_details AS cd ON cd.category_id = pd.category_id AND cd.status = 1
                LEFT JOIN favorite_detail AS fd ON pd.product_id = fd.product_id AND fd.status = 1
                INNER JOIN type_details AS td ON pd.type_id = td.type_id AND td.status = 1
                WHERE od.status = 1 AND od.start_date <= NOW() AND od.end_date >= NOW();
            `, [image_base_url], (err, offerResult) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }

                // Second query - Fetch best-selling products
                db.query(`
                    SELECT 
                        pd.product_id, pd.category_id, pd.brand_id, pd.type_id, pd.product_name, 
                        pd.details, pd.unit_name, pd.unit_value, pd.price, 
                        (CASE WHEN imd.image != '' 
                            THEN CONCAT(?, imd.image) 
                            ELSE '' 
                        END) AS image, 
                        cd.category_name, 
                        td.type_name,
                        (CASE WHEN fd.favorite_id IS NOT NULL THEN 1 ELSE 0 END) AS is_favorite 
                    FROM product_details AS pd
                    LEFT JOIN favorite_detail AS fd ON pd.product_id = fd.product_id AND fd.status = 1
                    INNER JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                    INNER JOIN category_details AS cd ON cd.category_id = pd.category_id AND cd.status = 1
                    INNER JOIN type_details AS td ON pd.type_id = td.type_id AND td.status = 1
                    WHERE pd.category_id = ?;
                `, [image_base_url, "1"], (err, bestSellResult) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }

                    // Third query - Fetch type details
                    db.query(`
                        SELECT 
                            type_id, type_name, 
                            (CASE WHEN image != '' 
                                THEN CONCAT(?, image) 
                                ELSE '' 
                            END) AS image, 
                            color 
                        FROM type_details WHERE status = ?;
                    `, [image_base_url, "1"], (err, typeResult) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        // Fourth query - Fetch latest 4 products
                        db.query(`
                            SELECT 
                                pd.product_id, pd.category_id, pd.brand_id, pd.type_id, 
                                pd.product_name, pd.details, pd.unit_name, pd.unit_value, pd.price, 
                                (CASE WHEN imd.image != '' 
                                    THEN CONCAT(?, imd.image) 
                                    ELSE '' 
                                END) AS image, 
                                cd.category_name, 
                                td.type_name 
                            FROM product_details AS pd
                            LEFT JOIN favorite_detail AS fd ON pd.product_id = fd.product_id AND fd.status = 1
                            INNER JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                            INNER JOIN category_details AS cd ON cd.category_id = pd.category_id AND cd.status = 1
                            INNER JOIN type_details AS td ON pd.type_id = td.type_id AND td.status = 1
                            ORDER BY pd.product_id DESC LIMIT 4;
                        `, [image_base_url], (err, latestProducts) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            }

                            // Send the response after all queries complete
                            res.json({
                                status: "1",
                                payload: {
                                    offer_list: offerResult,
                                    best_sell_list: bestSellResult,
                                    type_list: typeResult,
                                    list: latestProducts
                                },
                                message: messages.success
                            });
                        });
                    });
                });
            });
        });
    });

    app.post('/api/admin/product_detail', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id"], () => {

                getProductDetail(res, reqObj.product_id)
            })
        }, "1");
    });

    app.post('/api/app/add_remove_favorite', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id"], () => {
                db.query(
                    `SELECT favorite_id FROM favorite_detail 
                     WHERE product_id = ? AND user_id = ? AND status = 1`,
                    [reqObj.product_id, userObj.user_id],
                    (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        if (result.length > 0) {
                            // Remove from favorites
                            db.query(
                                `DELETE FROM favorite_detail WHERE product_id = ? AND user_id = ?`,
                                [reqObj.product_id, userObj.user_id],
                                (err) => {
                                    if (err) {
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    res.json({ status: "1", message: messages.favoriteRemove });
                                }
                            );
                        } else {
                            // Add to favorites
                            db.query(
                                `INSERT INTO favorite_detail (product_id, user_id, status) VALUES (?, ?, 1)`,
                                [reqObj.product_id, userObj.user_id],
                                (err, result) => {
                                    if (err) {
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    if (result.affectedRows > 0) {
                                        res.json({ status: "1", message: messages.favoriteAdd });
                                    } else {
                                        res.json({ status: "0", message: messages.fail });
                                    }
                                }
                            );
                        }
                    }
                );
            });
        }, "1");
    });

    app.post('/api/app/favorite_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            db.query(
                `SELECT 
                    fd.favorite_id,pd.product_id, pd.category_id, 
                    pd.brand_id, pd.type_id, pd.name, pd.details, 
                    pd.unit_name, pd.unit_value, pd.price, 
                    pd.status, pd.created_date, pd.updated_date,  
                    cd.category_name, IFNULL(bd.brand_name, '') AS brand_name, 
                    td.type_name, IFNULL(od.price, pd.price) AS offer_price, 
                    IFNULL(od.start_date, '') AS start_date, 
                    IFNULL(od.end_date, '') AS end_date, 
                    (CASE WHEN od.offer_id IS NOT NULL THEN 1 ELSE 0 END) AS is_offer_active,
                    1 AS is_favorite 
                FROM favorite_detail AS fd
                INNER JOIN product_details AS pd ON pd.product_id = fd.product_id AND rd.status = 1
                INNER JOIN category_details AS cd ON pd.category_id = cd.category_id
                LEFT JOIN brand_detail AS bd ON pd.brand_id = bd.brand_id
                LEFT JOIN offer_detail AS od 
                    ON pd.product_id = od.product_id 
                    AND od.status = 1 
                    AND od.start_date <= NOW() 
                    AND od.end_date >= NOW()
                INNER JOIN type_details AS td ON pd.type_id = td.type_id
                WHERE fd.user_id = ? AND fd.status = 1`,
                [userObj.user_id],
                (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            );
        }, "1");
    });

    app.post('/api/app/explore_category_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            db.query(
                `SELECT category_id, category_name, image, colors 
                FROM category_details WHERE status = 1`, [],
                (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            );
        }, "1");
    });

    app.post('/api/app/explore_category_item_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["category_id"], () => {
                db.query(
                    `SELECT 
                        pd.product_id, pd.category_id, 
                        pd.brand_id, pd.type_id, pd.name, pd.details, 
                        pd.unit_name, pd.unit_value, pd.price, 
                        pd.status, pd.created_date, pd.updated_date,  
                        cd.category_name, IFNULL(bd.brand_name, '') AS brand_name, 
                        td.type_name, IFNULL(od.price, pd.price) AS offer_price, 
                        IFNULL(od.start_date, '') AS start_date, 
                        IFNULL(od.end_date, '') AS end_date, 
                        (CASE WHEN od.offer_id IS NOT NULL THEN 1 ELSE 0 END) AS is_offer_active,
                        (CASE WHEN fd.favorite_id IS NOT NULL THEN 1 ELSE 0 END) AS is_favorite,
                    FROM product_details AS pd
                    LEFT JOIN favorite_detail  AS fd ON pd.product_id = fd.product_id AND fd.status = 1
                    INNER JOIN category_details AS cd ON pd.category_id = cd.category_id AND pd.status = 1
                    LEFT JOIN brand_detail AS bd ON pd.brand_id = bd.brand_id
                    LEFT JOIN offer_detail AS od 
                        ON pd.product_id = od.product_id 
                        AND od.status = 1 
                        AND od.start_date <= NOW() 
                        AND od.end_date >= NOW()
                    INNER JOIN type_details AS td ON pd.type_id = td.type_id
                    WHERE cd.category_id = ? AND cd.status = 1`,
                    [userObj.category],
                    (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        res.json({ status: "1", payload: result, message: messages.success });
                    }
                );
            })
        }, "1");
    });

    app.post('/api/app/add_to_cart', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id", "quantity"], () => {
                db.query(
                    `SELECT product_id FROM product_details WHERE product_id = ? AND status = 1`,
                    [reqObj.product_id], (err, result) => {
                        if (err) {
                            helpers.throwHtmlError(err, res);
                            return;
                        }
                        if (result.length > 0) {
                            db.query(
                                `INSERT INTO cart_details (user_id, product_id, quantity) VALUES (?,?,?)`,
                                [userObj.user_id, reqObj.product_id, reqObj.quantity],
                                (err, result) => {
                                    if (err) {
                                        helpers.throwHtmlError(err, res);
                                        return;
                                    }
                                    if (result) {
                                        res.json({ status: "1", message: messages.addItem });
                                    } else {
                                        res.json({ status: "0", message: messages.fail });
                                    }
                                });
                        } else {
                            res.json({ status: "0", message: messages.invalidItem });
                        }
                    }
                )
            })
        }, "1")
    })

    app.post('/api/app/update_cart', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["cart_id", "product_id", "quantity"], () => {
                var status = "1"
                if (reqObj.new_quantity === "0") {
                    status = "2"
                }
                db.query(
                    `UPDATE cart_details 
                     SET quantity = ?, status = ? 
                     WHERE cart_id = ? AND product_id = ? AND user_id = ?`,
                    [reqObj.quantity, status, reqObj.cart_id, reqObj.product_id,
                    userObj.user_id], (err, result) => {
                        if (err) {
                            helpers.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.updateItem });
                        } else {
                            res.json({ status: "0", message: messages.invalidItem });
                        }
                    }
                )
            })
        }, "1")
    })

    app.post('/api/app/remove_cart', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["cart_id", "product_id"], () => {

                db.query(
                    `DELETE FROM cart_details 
                     WHERE cart_id = ? AND product_id = ? AND user_id = ?`,
                    [reqObj.cart_id, reqObj.product_id, userObj.user_id], (err, result) => {
                        if (err) {
                            helpers.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.removeItem });
                        } else {
                            res.json({ status: "0", message: messages.invalidItem });
                        }
                    })
            }, "1")
        })
    })

   app.post('/api/app/cart_list', (req, res) => {
    helper.dlog(req.body);
    const reqObj = req.body;
    const image_base_url = helper.ImagePath();

    checkAccessToken(req.headers, res, (userObj) => {
        // Use userObj.user_id for the logged-in user and pass image_base_url
        getUserCart(res, userObj.user_id, image_base_url, (result, total) => {
            res.json({
                status: "1",
                payload: result,
                total: total,
                message: messages.success
            });
        });
    });
});

    app.post('/api/app/add_delivery_address', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            const userId = userObj.user_id || userObj.id;

            helper.checkParameterValid(res, reqObj, ["name", "phone", "address",
                "city", "state", "type_name", "postal_code"], () => {
                    db.query(
                        `INSERT INTO address_detail (name, user_id, phone, address, city, state, 
                        type_name, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [reqObj.name, userId, reqObj.phone, reqObj.address, reqObj.city,
                        reqObj.state, reqObj.type_name, reqObj.postal_code], (err, result) => {
                            if (err) {
                                helpers.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.addAddress });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    )
                })
        }, "1");
    });

    app.post('/api/app/update_delivery_address', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["address_id", "name", "user_id", "phone", "address",
                "city", "state", "type_name", "postal_code"], () => {
                    db.query(
                        `UPDATE address_detail SET name = ?, user_id = ?, phone = ?, 
                        address = ?, city = ?, state = ?,type_name = ?, postal_code = ?, 
                        updated_date = NOW() WHERE address_id = ? AND user_id = ? AND status = 1`,
                        [reqObj.name, reqObj.user_id, reqObj.phone, reqObj.address, reqObj.city,
                        reqObj.state, reqObj.type_name, reqObj.postal_code,
                        reqObj.address_id, reqObj.user_id], (err, result) => {
                            if (err) {
                                helpers.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.updateAddress });

                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    )
                })
        }, "1")
    })

    app.post('/api/app/mark_default_delivery_address', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["address_id", "user_id"], () => {
                db.query(
                    `UPDATE address_detail SET is_default = (CASE WHEN address_id = ? THEN 1 ELSE 0 END), 
                    updated_date = NOW() WHERE user_id = ? AND status = 1`,
                    [reqObj.address_id, reqObj.user_id], (err, result) => {
                        if (err) {
                            helpers.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.success });

                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                )
            })
        }, "1")
    })

    app.post('/api/app/delivery_address', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        const { otherData } = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            const userId = userObj.user_id || userObj.id;

            db.query(
                `SELECT address_id, name, user_id, phone, address, city, 
                    state, type_name, postal_code, is_default FROM address_detail
                    WHERE user_id = ? AND status = 1`,
                [userId], (err, result) => {
                    if (err) {
                        helpers.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            )
        }, "1")
    })

    app.post('/api/app/promo_code_list', (req, res) => {
        helper.dlog(req.body)
        var reqObj = req.body

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT promo_code_id, code, offer_price, start_date,
                         end_date, title, description, type, minimum_order_amount, 
                         maximum_discount_amount, created_date, updated_date
                         FROM promo_codes WHERE status = 1 ORDER BY promo_code_id DESC `,
                [], (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            )
        }, "1")
    })

    app.post('/api/app/add_payment_method', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["name", "card_number", "card_month", "card_year"], () => {
                db.query(
                    `SELECT pay_id FROM payment_method_detail 
                     WHERE user_id = ? AND card_number = ? AND status = 1`,
                    [userObj.user_id, reqObj.card_number],
                    (err, sResult) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (sResult.length > 0) {
                            return res.json({ status: "0", message: messages.existPayment });
                        }
                        db.query(
                            `INSERT INTO payment_method_detail (user_id, name, card_number, card_month, card_year)
                             VALUES (?, ?, ?, ?, ?)`,
                            [userObj.user_id, reqObj.name, reqObj.card_number, reqObj.card_month, reqObj.card_year],
                            (err, result) => {
                                if (err) {
                                    helper.throwHtmlError(err, res);
                                    return;
                                }
                                if (result) {
                                    res.json({ status: "1", message: messages.addPayment });
                                } else {
                                    res.json({ status: "0", message: messages.fail });
                                }
                            }
                        );
                    }
                );
            });
        }, "1");
    });

    app.post('/api/app/remove_payment_method', (req, res) => {
        helpers.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["pay_id"], () => {
                db.query(
                    `UPDATE payment_method_detail SET status = ? WHERE pay_id = ?
                        AND user_id = ? and status = ?`,
                    ["2", reqObj.pay_id, userObj.user_id, "1"], (err, result) => {
                        if (err) {
                            helpers.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.removePayment });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                )
            })
        }, "1");
    });

    app.post('/api/app/list_payment_method', (req, res) => {
        helpers.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            db.query(
                `SELECT pay_id, name, RIGHT(card_number,4) AS card_number, card_month, card_year FROM 
                        payment_method_detail WHERE user_id = ? AND status = 1`,
                [userObj.user_id], (err, result) => {
                    if (err) {
                        helpers.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            )
        }, "1");
    });

    app.post('/api/app/order_place', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;
        const image_base_url = helper.ImagePath();
    
        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(
                res,
                reqObj,
                ["pay_id", "address_id", "promo_code_id", "delivery_type", "payment_type"],
                () => {
                    getUserCart(res, userObj.user_id, image_base_url, (cartResult, total) => {
                        if (cartResult.length === 0) {
                            return res.json({ status: "0", messages: "Cart is empty" });
                        }
                        // Get payment method details
                        db.query(
                            `SELECT pay_id, user_id, name, card_number, card_month, card_year 
                             FROM payment_method_detail 
                             WHERE pay_id = ? AND status = 1`,
                            [reqObj.pay_id],
                            (err, paymentResult) => {
                                if (err) {
                                    helper.throwHtmlError(err, res);
                                    return;
                                }
                                //  Get promo code details (if provided)
                                db.query(
                                    `SELECT promo_code_id, offer_price, minimum_order_amount, maximum_discount_amount, type
                                     FROM promo_codes
                                     WHERE status = 1 AND promo_code_id = ?`,
                                    [reqObj.promo_code_id],
                                    (err, promoResult) => {
                                        if (err) {
                                            helper.throwHtmlError(err, res);
                                            return;
                                        }
                                        // 3. Get address details
                                        db.query(
                                            `SELECT address_id, user_id 
                                             FROM address_detail 
                                             WHERE address_id = ? AND user_id = ? AND status = 1`,
                                            [reqObj.address_id, userObj.user_id],
                                            (err, addressResult) => {
                                                if (err) {
                                                    helper.throwHtmlError(err, res);
                                                    return;
                                                }
                                                // Validate address if delivery is required
                                                if (reqObj.delivery_type === "1" && addressResult.length === 0) {
                                                    return res.json({
                                                        status: "0",
                                                        messages: "Please select a valid address"
                                                    });
                                                }
    
                                                // Set delivery price based on payment_type 
                                                let delivery_price_amount = (reqObj.payment_type === "1")
                                                    ? delivery_price
                                                    : 0.0;
    
                                                let final_total = total + delivery_price_amount;
                                                let discountAmount = 0.0;
    
                                                // Process promo code if provided
                                                if (reqObj.promo_code_id !== "") {
                                                    if (promoResult.length > 0) {
                                                        let promo = promoResult[0];
                                                        if (final_total >= promo.minimum_order_amount) {
                                                            if (promo.type === 1) {
                                                                // Fixed discount
                                                                discountAmount = promo.offer_price;
                                                            } else {
                                                                // Percentage discount calculation
                                                                let discountVal = (final_total * promo.offer_price) / 100;
                                                                discountAmount = discountVal > promo.maximum_discount_amount
                                                                    ? promo.maximum_discount_amount
                                                                    : discountVal;
                                                            }
                                                        } else {
                                                            return res.json({
                                                                status: "0",
                                                                messages:
                                                                    "Promo code is not applicable. Minimum order amount: " +
                                                                    promo.minimum_order_amount
                                                            });
                                                        }
                                                    } else {
                                                        return res.json({
                                                            status: "0",
                                                            messages: "Sorry, promo code is not applicable"
                                                        });
                                                    }
                                                }
                                                // Check if payment method is valid
                                                if ((reqObj.payment_type === "1" || reqObj.payment_type === "2") && paymentResult.length > 0) {
                                                    // Generate a unique cart id using Unix timestamp in seconds.
                                                    const cartId = Math.floor(Date.now() / 1000);
                                                    const user_pay_price = final_total - discountAmount;
                                                    db.query(
                                                        `INSERT INTO cart_details (cart_id, user_id, created_date) VALUES (?, ?, NOW())`,
                                                        [cartId, userObj.user_id],
                                                        (err, cartInsertResult) => {
                                                            if (err) {
                                                                helper.throwHtmlError(err, res);
                                                                return;
                                                            }
                                                            // order details referencing cart_id.
                                                            db.query(
                                                                `INSERT INTO order_details (
                                                                    cart_id, user_id, address_id, total_price,
                                                                    user_price, discount_price, delivery_price, promo_code_id,
                                                                    delivery_type, payment_type
                                                                ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                                                                [
                                                                    cartId,userObj.user_id,
                                                                    reqObj.address_id,total,
                                                                    user_pay_price,discountAmount,
                                                                    delivery_price_amount,reqObj.promo_code_id,
                                                                    reqObj.delivery_type,reqObj.payment_type
                                                                ],
                                                                (err, orderResult) => {
                                                                    if (err) {
                                                                        helper.throwHtmlError(err, res);
                                                                        return;
                                                                    }
                                                                    if (orderResult) {
                                                                        res.json({
                                                                            status: "1",
                                                                            payload: {
                                                                                order_id: orderResult.insertId,
                                                                                cart_id: cartId,
                                                                                user_pay_price: user_pay_price,
                                                                                delivery_price: delivery_price_amount,
                                                                                discount_price: discountAmount,
                                                                                total_price: total
                                                                            },
                                                                            messages: "Your order has been placed successfully"
                                                                        });
                                                                    } else {
                                                                        res.json({ status: "0", messages: messages.fail });
                                                                    }
                                                                }
                                                            );
                                                        }
                                                    );
                                                } else {
                                                    return res.json({ status: "0", messages: messages.fail });
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    });
                }
            );
        }, "1");
    });      
}
