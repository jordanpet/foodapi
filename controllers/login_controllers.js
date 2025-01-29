const json = require('express');
var db = require('../helpers/db_helpers');
var helper = require('./../helpers/helpers');
var multiparty = require('multiparty');
var fs = require('fs');
const moment = require('moment-timezone');
var imageServerPath = "./public/img/"
//app.use(express.json());
var messages = require('../utils/messages');

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
                device_token
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

//END-POINT
module.exports.controllers = (app, io, user_socket_connect_list) => {

    //SIGN-UP
    app.post('/api/sign_up', (req, res) => {
        helper.dlog(req.body); // Log request for debugging
        var reqObj = req.body;

        helper.checkParameterValid(res, reqObj,
            ["username", "name", "email", "mobile", "mobile_code", "address", "password", "device_token"], () => {

                // New Username Rules using validateUsername
                if (!validateUsername(reqObj.username)) {
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

    app.post('/api/get_zone_area',(req, res) => {
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

}

