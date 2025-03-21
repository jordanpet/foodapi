const json = require('express');
var db = require('../helpers/db_helpers');
var helper = require('./../helpers/helpers');
var multiparty = require('multiparty');
var fs = require('fs');
const moment = require('moment-timezone');
var imageServerPath = "./public/img/"
//app.use(express.json());
var messages = require('../utils/messages');
require('dotenv').config();
const express = require('express');
const path = require('path');

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
            created_date, 
            updated_date,
            status
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
function checkAccessToken(headerObj, res, callback, require_type = "") {
    helper.dlog(headerObj.access_token);

    helper.checkParameterValid(res, headerObj, ["access_token"], () => {
        db.query(
            `SELECT 
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
                created_date, 
                updated_date,
                status
            FROM 
                user_details
            WHERE 
                auth_token = ? AND status = ?`,
            [headerObj.access_token, "1"],
            (err, result) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }

                helper.dlog(result);

                if (result.length > 0) {
                    if (require_type !== "") {
                        if (result[0].user_type == require_type) {
                            return callback(result[0]);
                        } else {
                            res.json({
                                "status": "0", "code": "404", "message": "Access denied. Unauthorized user access"
                            });
                        }
                    } else {
                        return callback(result[0]);
                    }
                } else {
                    res.json({
                        "status": "0", "code": "404", "message": "Access denied. Unauthorized user access"
                    });
                }
            }
        );
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

// //END-POINT
module.exports.controllers = (app, io, user_socket_connect_list) => {
     const image_base_url = helper.ImagePath();
    // Brand  end point
    app.post('/api/admin/brand_add', (req, res) => { 
        helper.dlog(req.body);
        const reqObj = req.body;

        // Check access token validity
        checkAccessToken(req.headers, res, (userObj) => {
            // Validate required parameters
            helper.checkParameterValid(res, reqObj, ["brand_name"], () => {
                // Check if the brand already exists
                db.query(
                    `SELECT COUNT(*) as count FROM brand_detail WHERE brand_name = ? LIMIT 1`,
                    [reqObj.brand_name],
                    (err, result) => {
                        if (err) {
                            // Handle database error
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        // If brand exists, send a response
                        if (result[0].count > 0) {
                            res.json({ status: "0", message: messages.brandExist });
                            return;
                        }

                        // If brand does not exist, insert new record
                        db.query(
                            `INSERT INTO brand_detail (brand_name, created_date, updated_date) VALUES (?, NOW(), NOW())`,
                            [reqObj.brand_name],
                            (err, result) => {
                                if (err) {
                                    // Handle database error
                                    helper.throwHtmlError(err, res);
                                    return;
                                }

                                if (result.affectedRows > 0) {
                                    res.json({ status: "1", message: messages.brandadd });
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

    app.post('/api/admin/brand_update', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["brand_id", "brand_name"], () => {

                db.query(
                    ` UPDATE brand_detail 
                    SET brand_name = ?, updated_date = NOW() 
                     WHERE brand_id = ? AND status = ?`,
                    [reqObj.brand_name, reqObj.brand_id, "1"],
                    (err, result) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.brandupdate });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });

    app.post('/api/admin/brand_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT brand_id, brand_name FROM brand_detail WHERE status = ?`,
                ["1"], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                }
            );

        }, "1");
    });

    app.post('/api/admin/brand_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["brand_id"], () => {

                db.query(
                    `UPDATE brand_detail 
                    SET status = ?, updated_date = NOW() 
                    WHERE brand_id = ? AND status = ?`,
                    ["2", reqObj.brand_id, "1"], (err, result) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result) {
                            res.json({ status: "1", message: messages.brandDeleted });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });
    // Category end point
    app.post('/api/admin/category_add', (req, res) => {
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

                helper.checkParameterValid(res, reqObj, ["category_name", "color"], () => {

                    helper.checkParameterValid(res, files, ["image"], () => {
                        var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1);
                        var imageFileName = "category/" + helper.fileNameGenerate(extension);

                        var newPath = imageServerPath + imageFileName;

                        fs.rename(files.image[0].path, newPath, (err) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            } else {
                                // Check if the category already exists
                                db.query(`SELECT COUNT(*) AS count FROM category_details WHERE category_name = ? LIMIT 1`,
                                    [reqObj.category_name[0]], (err, result) => {
                                        if (err) {
                                            helper.throwHtmlError(err, res);
                                            return;
                                        }

                                        if (result[0].count > 0) {
                                            res.json({ "status": "0", "message": messages.categoryExists });
                                            return;
                                        }

                                        // Insert the new category
                                        db.query(`INSERT INTO category_details(category_name, image, colors, status, created_date, updated_date) 
                                        VALUES (?, ?, ?, '1', NOW(), NOW())`,
                                            [reqObj.category_name[0], imageFileName, reqObj.color[0]],
                                            (err, result) => {
                                                if (err) {
                                                    helper.throwHtmlError(err, res);
                                                    return;
                                                }
                                                if (result) {
                                                    res.json({ "status": "1", "message": messages.addCategory });
                                                } else {
                                                    res.json({ "status": "0", "message": messages.fail });
                                                }
                                            });
                                    });
                            }
                        });
                    });
                });
            });
        }, "1");
    });

    app.post('/api/admin/category_update', (req, res) => {

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

                helper.checkParameterValid(res, reqObj, ["category_id", "category_name", "colors"], () => {

                    var condition = "";
                    var imageFileName = "";
                    if (files.image && files.image[0]) {
                        var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
                        imageFileName = "category/" + helper.fileNameGenerate(extension);
                        var newPath = imageServerPath + imageFileName;

                        condition = ", image = '" + imageFileName + "'";
                        fs.rename(files.image[0].path, newPath, (err) => {
                            if (err) {
                                helper.throwHtmlError(err);
                                return;
                            }
                        })
                    } else {
                        condition = "";
                    }

                    db.query(
                        `UPDATE category_details
                             SET category_name = ?, colors = ?,updated_date = NOW() ${condition}
                             WHERE status = ? AND category_id = ?`,
                        [
                            reqObj.category_name[0], reqObj.colors[0], "1", reqObj.category_id[0]
                        ],
                        (err, result) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ "status": "1", "message": messages.updateCategory });
                            } else {
                                res.json({ "status": "0", "message": messages.fail });
                            }
                        }
                    );
                })

            })
        }, "1")
    })

    app.post('/api/admin/category_delete', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["category_id"], () => {

                db.query(`
                    UPDATE category_details
                    SET status = ?, updated_date = NOW()
                    WHERE category_id = ? AND status != ?`,
                    ["2", reqObj.category_id[0], "2"], (err, uresult) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (uresult.affectedRows > 0) {
                            res.json({ status: "1", message: messages.deleteCategory });
                        } else {
                            res.json({ status: "0", message: messages.notFound });
                        }
                    }
                );
            });
        }, "1");
    });

    app.post('/api/admin/category_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT 
                category_id, category_name, image, colors, created_date, updated_date, status FROM 
                category_details WHERE status = ? `,
                ["1"], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                }
            );
        }, "1");
    });

    //Type End Point
    app.post('/api/admin/type_add', (req, res) => {
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

                helper.checkParameterValid(res, reqObj, ["type_name", "color"], () => {

                    helper.checkParameterValid(res, files, ["image"], () => {
                        var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1);
                        var imageFileName = "type/" + helper.fileNameGenerate(extension);

                        var newPath = imageServerPath + imageFileName;

                        fs.rename(files.image[0].path, newPath, (err) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            } else {
                                // Check if the category already exists
                                db.query(`SELECT COUNT(*) AS count FROM type_details WHERE type_name = ? LIMIT 1`,
                                    [reqObj.type_name[0]], (err, result) => {
                                        if (err) {
                                            helper.throwHtmlError(err, res);
                                            return;
                                        }

                                        if (result[0].count > 0) {
                                            res.json({ "status": "0", "message": messages.typeExist });
                                            return;
                                        }

                                        // Insert the new category
                                        db.query(`INSERT INTO type_details(type_name, image, color, status, created_date, updated_date) 
                                            VALUES (?, ?, ?, '1', NOW(), NOW())`,
                                            [reqObj.type_name[0], imageFileName, reqObj.color[0]],
                                            (err, result) => {
                                                if (err) {
                                                    helper.throwHtmlError(err, res);
                                                    return;
                                                }
                                                if (result) {
                                                    res.json({ "status": "1", "message": messages.typeAdd });
                                                } else {
                                                    res.json({ "status": "0", "message": messages.fail });
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        });
                    });
                });
            });
        }, "1");
    });

    app.post('/api/admin/type_update', (req, res) => {

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

                helper.checkParameterValid(res, reqObj, ["type_id", "type_name", "color"], () => {

                    var condition = "";
                    var imageFileName = "";
                    if (files.image && files.image[0]) {
                        var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
                        imageFileName = "type/" + helper.fileNameGenerate(extension);
                        var newPath = imageServerPath + imageFileName;

                        condition = ", image = '" + imageFileName + "'";
                        fs.rename(files.image[0].path, newPath, (err) => {
                            if (err) {
                                helper.throwHtmlError(err);
                                return;
                            }
                        })
                    } else {
                        condition = "";
                    }

                    db.query(
                        `UPDATE type_details
                             SET type_name = ?,color = ?,updated_date = NOW() ${condition}
                             WHERE status = ? AND type_id = ?`,
                        [
                            reqObj.type_name[0], reqObj.color[0], "1", reqObj.type_id[0]
                        ],
                        (err, result) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ "status": "1", "message": messages.typeUpdate });
                            } else {
                                res.json({ "status": "0", "message": messages.fail });
                            }
                        }
                    );
                })

            })
        }, "1")
    })

    app.post('/api/admin/type_delete', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["type_id"], () => {

                db.query(`
                    UPDATE type_details
                    SET status = ?, updated_date = NOW()
                    WHERE type_id = ? AND status != ?`,
                    ["2", reqObj.type_id[0], "2"], (err, uresult) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (uresult.affectedRows > 0) {
                            res.json({ status: "1", message: messages.typeDelete });
                        } else {
                            res.json({ status: "0", message: messages.notFound });
                        }
                    }
                );
            });
        }, "1");
    });

    app.post('/api/admin/type_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT 
                type_id, type_name, image, color, created_date, updated_date, status FROM 
                type_details WHERE status = ? `,
                ["1"], (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                }
            );
        }, "1");
    });
    // product end point
    app.post('/api/admin/product_add', (req, res) => {
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

                helper.checkParameterValid(res, reqObj, ["category_id", "brand_id", "type_id",
                    "name", "details", "unit_name", "unit_value", "nutrition_weight", "nutrition_date", "price"],
                    () => {
                        helper.checkParameterValid(res, files, ["image"], () => {
                            var imageNamePathArr = [];
                            var fullImageNamePathArr = [];

                            files.image.forEach(imageFile => {
                                var extension = imageFile.originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
                                var imageFileName = "product/" + helper.fileNameGenerate(extension);

                                imageNamePathArr.push(imageFileName);
                                fullImageNamePathArr.push(helper.ImagePath() + imageFileName);
                                saveImage(imageFile, imageServerPath + imageFileName);
                            });
                            helper.dlog(imageNamePathArr);
                            helper.dlog(fullImageNamePathArr);

                            // Check if the product already exists
                            db.query(`SELECT COUNT(*) AS count FROM product_details WHERE 
                             category_id = ? AND brand_id = ? AND type_id = ? AND name = ? AND 
                                    details = ? AND unit_name = ? AND unit_value = ? AND price = ? LIMIT 1`,
                                [reqObj.category_id[0], reqObj.brand_id[0], reqObj.type_id[0], reqObj.name[0],
                                reqObj.details[0], reqObj.unit_name[0], reqObj.unit_value[0], reqObj.price[0]],
                                (err, result) => {
                                    if (err) {
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    if (result[0].count > 0) {
                                        res.json({ "status": "0", "message": messages.productExist });
                                        return;
                                    }
                                    // Insert the new product
                                    db.query(`INSERT INTO product_details(category_id, brand_id, type_id, name, 
                                        details, unit_name, unit_value, price, status, created_date, updated_date) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
                                        [reqObj.category_id[0], reqObj.brand_id[0], reqObj.type_id[0], reqObj.name[0],
                                        reqObj.details[0], reqObj.unit_name[0], reqObj.unit_value[0], reqObj.price[0]],
                                        (err, result) => {
                                            if (err) {
                                                helper.throwHtmlError(err, res);
                                                return;
                                            }

                                            var nutritionInsertData = [];
                                            var nutritionDataArr = JSON.parse(reqObj.nutrition_date[0]);

                                            nutritionDataArr.forEach(nutritionObj => {
                                                nutritionInsertData.push([result.insertId, nutritionObj.name,
                                                nutritionObj.value, nutritionObj.weight, nutritionObj.date,
                                                    1, new Date(), new Date()]);
                                            });

                                            if (nutritionDataArr.length > 0) {
                                                db.query(`INSERT INTO nutrition_details(product_id, nutrition_name, 
                                                        nutrition_value,nutrition_weight,nutrition_date, status, created_date, updated_date) VALUES ?`,
                                                    [nutritionInsertData], (err, nResult) => {
                                                        if (err) {
                                                            helper.throwHtmlError(err, res);
                                                            return;
                                                        }
                                                        if (nResult) {
                                                            helper.dlog("nutrition added successfully");
                                                            return;
                                                        }
                                                    }
                                                )
                                            }

                                            var imageInsertArr = [];
                                            imageNamePathArr.forEach(imagePath => {
                                                imageInsertArr.push([result.insertId, imagePath, 1, new Date(), new Date()]);
                                            });
                                            db.query(`INSERT INTO image_detail (product_id, image, status, created_date, updated_date) VALUES ?`,
                                                [imageInsertArr], (err, iResult) => {
                                                    if (err) {
                                                        helper.throwHtmlError(err, res);
                                                        return;
                                                    }
                                                    if (iResult) {
                                                        helper.dlog("imageInsertArr success");
                                                        return;
                                                    }
                                                })

                                            res.json({ "status": "1", "message": messages.productAdd });
                                            return;
                                        }
                                    );
                                }
                            );
                        })
                    }
                )
            });
        });
    });

    app.post('/api/admin/product_update', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id", "category_id", "brand_id", "type_id",
                "name", "details", "unit_name", "price"], () => {
                    db.query(
                        `UPDATE product_details 
                        SET category_id = ?, brand_id = ?, type_id = ?, name = ?, 
                            details = ?, unit_name = ?, unit_value = ?, price = ?, 
                            updated_date = NOW() 
                        WHERE product_id = ? AND status = ?`,
                        [
                            reqObj.category_id, reqObj.brand_id, reqObj.type_id, reqObj.name,
                            reqObj.details, reqObj.unit_name, reqObj.unit_value, reqObj.price,
                            reqObj.product_id, "1"
                        ], (err, result) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.productUpdate });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );

                });
        }, "1");
    });

    app.post('/api/admin/product_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id"],
                () => {

                    db.query(
                        ` UPDATE product_details 
                    SET status = ?, updated_date = NOW() 
                     WHERE product_id = ? AND status = ?`,
                        ["2", reqObj.product_id, "1"],
                        (err, result) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.productDelete });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );

                });
        }, "1");
    });

    app.post('/api/admin/product_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT 
                pd.product_id, pd.category_id, pd.brand_id, pd.type_id, pd.name, 
                pd.details, pd.unit_name, pd.unit_value, pd.price, pd.status, 
                pd.created_date, pd.updated_date, cd.category_name, 
                IFNULL(bd.brand_name, "") AS brand_name, td.type_name 
            FROM product_details AS pd 
            INNER JOIN category_details AS cd ON pd.category_id = cd.category_id 
            LEFT JOIN brand_detail AS bd ON pd.brand_id = bd.brand_id 
            INNER JOIN type_details AS td ON pd.type_id = td.type_id 
            WHERE pd.status = ? 
            ORDER BY pd.product_id DESC`,
                ["1"], (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result, message: messages.success });
                }
            );
        }, "1");
    });

    // /product nutrition end point
    app.post('/api/admin/product_nutrition_add', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        // Check access token validity
        checkAccessToken(req.headers, res, (userObj) => {
            // Validate required parameters
            helper.checkParameterValid(res, reqObj, ["product_id", "nutrition_name", "nutrition_value",
                "nutrition_weight", "nutrition_date"], () => {
                    // Check if the brand already exists
                    db.query(
                        `SELECT COUNT(*) as count FROM nutrition_details 
                        WHERE product_id = ? AND nutrition_name = ? AND nutrition_value = ? AND nutrition_weight = ? 
                        AND nutrition_date = ? LIMIT 1`,
                        [reqObj.product_id, reqObj.nutrition_name, reqObj.nutrition_value, reqObj.nutrition_weight,
                        reqObj.nutrition_date],
                        (err, result) => {
                            if (err) {
                                // Handle database error
                                helper.throwHtmlError(err, res);
                                return;
                            }

                            // If brand exists, send a response
                            if (result[0].count > 0) {
                                res.json({ status: "0", message: messages.nutritionExist });
                                return;
                            }

                            // If brand does not exist, insert new record
                            db.query(
                                `INSERT INTO nutrition_details (product_id, nutrition_name, 
                            nutrition_value, nutrition_weight, nutrition_date, status, created_date,
                             updated_date) VALUES (?,?,?,?,?,?, NOW(), NOW())`,
                                [reqObj.product_id, reqObj.nutrition_name, reqObj.nutrition_value,
                                reqObj.nutrition_weight, reqObj.nutrition_date, "1"],
                                (err, result) => {
                                    if (err) {
                                        // Handle database error
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    if (result) {
                                        res.json({ status: "1", message: messages.nutritionAdd });
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

    app.post('/api/admin/product_nutrition_update', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["nutrition_id", "product_id", "nutrition_name",
                "nutrition_value", "nutrition_weight", "nutrition_date"],
                () => {
                    db.query(
                        ` UPDATE nutrition_details 
                    SET nutrition_name = ?, nutrition_value = ?, nutrition_weight = ?, 
                    nutrition_date = ?, updated_date = NOW() 
                     WHERE nutrition_id = ? AND product_id = ? AND status = ?`,
                        [reqObj.nutrition_name, reqObj.nutrition_value, reqObj.nutrition_weight,
                        reqObj.nutrition_date, reqObj.nutrition_id, reqObj.product_id, "1"],
                        (err, result) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.nutritionupdate });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );

                });
        }, "1");
    });

    app.post('/api/admin/product_nutrition_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["nutrition_id", "product_id"],
                () => {
                    db.query(
                        `UPDATE nutrition_details 
                         SET status = ?, updated_date = NOW() 
                         WHERE nutrition_id = ? AND product_id = ? AND status = ?`,
                        ["2", reqObj.nutrition_id, reqObj.product_id, "1"],
                        (err, result) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.nutritionDelete });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );

                });
        }, "1");
    });
    // image end point
    app.post('/api/admin/product_image_add', (req, res) => {
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

                helper.checkParameterValid(res, reqObj, ["product_id"], () => {

                    helper.checkParameterValid(res, files, ["image"], () => {
                        var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1);
                        var imageFileName = "product/" + helper.fileNameGenerate(extension);

                        var newPath = imageServerPath + imageFileName;

                        fs.rename(files.image[0].path, newPath, (err) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            } else {
                                // Check if the image already exists
                                db.query(
                                    `SELECT COUNT(*) AS count FROM image_detail WHERE product_id = ? AND image = ? LIMIT 1`,
                                    [reqObj.product_id[0], imageFileName], (err, result) => {
                                        if (err) {
                                            helper.throwHtmlError(err, res);
                                            return;
                                        }

                                        if (result[0].count > 0) {
                                            res.json({ "status": "0", "message": messages.imageExist });
                                            return;
                                        }

                                        // Insert the new image
                                        db.query(
                                            `INSERT INTO image_detail(product_id, image, status, created_date, updated_date) 
                                             VALUES (?, ?, '1', NOW(), NOW())`,
                                            [reqObj.product_id[0], imageFileName],
                                            (err, result) => {
                                                if (err) {
                                                    helper.throwHtmlError(err, res);
                                                    return;
                                                }
                                                if (result) {
                                                    res.json({ "status": "1", "message": messages.imageAdd });
                                                } else {
                                                    res.json({ "status": "0", "message": messages.fail });
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        });
                    });
                });
            });
        }, "1");
    });

    app.post('/api/admin/product_image_delete', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id", "image_id"], () => {

                db.query(`
                    UPDATE image_detail
                    SET status = ?, updated_date = NOW()
                    WHERE product_id = ? AND image_id = ? AND status = ?`,
                    ["2", reqObj.product_id[0], reqObj.image_id, "1"], (err, uresult) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (uresult.affectedRows > 0) {
                            res.json({ status: "1", message: messages.imageDelete });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );
            });
        }, "1");
    });
    // zone end point
    app.post('/api/admin/zone_add', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        // Check access token validity
        checkAccessToken(req.headers, res, (userObj) => {
            // Validate required parameters
            helper.checkParameterValid(res, reqObj, ["zone_name"], () => {
                // Check if the zone already exists
                db.query(
                    `SELECT COUNT(*) as count FROM zone_detail WHERE zone_name = ? LIMIT 1`,
                    [reqObj.zone_name],
                    (err, result) => {
                        if (err) {
                            // Handle database error
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        // If zone exists, send a response
                        if (result[0].count > 0) {
                            res.json({ status: "0", message: messages.zoneExist });
                            return;
                        }

                        // If zone does not exist, insert new record
                        db.query(
                            `INSERT INTO zone_detail (zone_name, created_date, updated_date, status) VALUES (?, NOW(), NOW(),?)`,
                            [reqObj.zone_name, "1"],
                            (err, result) => {
                                if (err) {
                                    // Handle database error
                                    helper.throwHtmlError(err, res);
                                    return;
                                }

                                if (result.affectedRows > 0) {
                                    res.json({
                                        status: "1",
                                        payload: {
                                            "zone_id": result.insertId,
                                            "zone_name": reqObj.zone_name
                                        },
                                        message: messages.zoneAdd
                                    });
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

    app.post('/api/admin/zone_update', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["zone_id", "zone_name"], () => {

                db.query(
                    ` UPDATE zone_detail 
                    SET zone_name = ?, updated_date = NOW() 
                     WHERE zone_id = ? AND status = ?`,
                    [reqObj.zone_name, reqObj.zone_id, "1"],
                    (err, result) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.zoneUpdate });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });

    app.post('/api/admin/zone_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT zone_id, zone_name FROM zone_detail WHERE status = ?`,
                ["1"], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                }
            );

        }, "1");
    });

    app.post('/api/admin/zone_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["zone_id"], () => {

                db.query(
                    `UPDATE zone_detail 
                    SET status = ?, updated_date = NOW() 
                    WHERE zone_id = ? AND status = ?`,
                    ["2", reqObj.zone_id, "1"], (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result) {
                            res.json({ status: "1", message: messages.zoneDelete });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });
    // area end point
    app.post('/api/admin/area_add', (req, res) => {
        helper.dlog(req.body);
        const reqObj = req.body;

        // Check access token validity
        checkAccessToken(req.headers, res, (userObj) => {
            // Validate required parameters
            helper.checkParameterValid(res, reqObj, ["zone_id", "name"], () => {
                // Check if the zone already exists
                db.query(
                    `SELECT COUNT(*) as count FROM area_detail WHERE zone_id = ? AND name = ? LIMIT 1`,
                    [reqObj.zone_id, reqObj.name],
                    (err, result) => {
                        if (err) {
                            // Handle database error
                            helper.throwHtmlError(err, res);
                            return;
                        }

                        // If zone exists, send a response
                        if (result[0].count > 0) {
                            res.json({ status: "0", message: messages.areaExist });
                            return;
                        }

                        // If zone does not exist, insert new record
                        db.query(
                            `INSERT INTO area_detail (zone_id, name, created_date, update_date, status) 
                            VALUES (?, ?,NOW(), NOW(),?)`,
                            [reqObj.zone_id, reqObj.name, "1"],
                            (err, result) => {
                                if (err) {
                                    // Handle database error
                                    helper.throwHtmlError(err, res);
                                    return;
                                }

                                if (result.affectedRows > 0) {
                                    res.json({
                                        status: "1",
                                        payload: {
                                            "area_id": result.insertId,
                                            "zone_id": reqObj.zone_id,
                                            "name": reqObj.name
                                        },
                                        message: messages.areaAdd
                                    });
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

    app.post('/api/admin/area_update', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, [, "area_id", "zone_id", "name"], () => {

                db.query(
                    ` UPDATE area_detail 
                    SET zone_id = ?, name = ?, update_date = NOW() 
                     WHERE area_id = ? AND status = ?`,
                    [reqObj.zone_id, reqObj.name, reqObj.area_id, "1"],
                    (err, result) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.areaUpdate });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });

    app.post('/api/admin/area_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT area_id,zone_id, name FROM area_detail WHERE status = ?`,
                ["1"], (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                }
            );

        }, "1");
    });

    app.post('/api/admin/area_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["area_id"], () => {

                db.query(
                    `UPDATE area_detail 
                    SET status = ?, update_date = NOW() 
                    WHERE area_id = ? AND status = ?`,
                    ["2", reqObj.area_id, "1"], (err, result) => {
                        if (err) {
                            // Log and handle database errors
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result) {
                            res.json({ status: "1", message: messages.areaDelete });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });

    app.post('/api/admin/offer_add', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["product_id", "price", "start_date",
                "end_date"], () => {

                    db.query(`
                        INSERT INTO offer_detail ( product_id, price, start_date,
                         end_date, status, created_date,updated_date)
                          VALUE (?,?,?,?,?, NOW(), NOW())` ,
                        [reqObj.product_id, reqObj.price, reqObj.start_date,
                        reqObj.end_date, "1"], (err, result) => {
                            if (err) {
                                // Log and handle database errors
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (result) {
                                res.json({ status: "1", message: messages.offerAdd });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    );
                });
        }, "1");
    });

    app.post('/api/admin/offer_delete', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["offer_id"], () => {

                db.query(`
                        UPDATE offer_detail SET status = ?,  updated_date = NOW() 
                        WHERE offer_id = ? AND status = ?` ,
                    ["2", reqObj.offer_id, "1"], (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result) {
                            res.json({ status: "1", message: messages.offerDelete });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );

            });
        }, "1");
    });

    app.post('/api/admin/offer_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`
                        SELECT offer_id, product_id, price, start_date, end_date, status, 
                        created_date, updated_date FROM offer_detail 
                        WHERE status = ? ORDER BY created_date ` , ["1"],
                (err, result) => {
                    if (err) {
                        // Log and handle database errors
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });

                }
            );
        }, "1");
    });

    app.post('/api/app/payment_detail', (req, res) => {
        checkAccessToken(req.headers, res, (userObj) => {
            const sql = `
                SELECT 
                    SUM((c.quantity * 
                        (CASE 
                            WHEN od.price IS NOT NULL THEN od.price 
                            ELSE pd.price 
                         END)
                    )) AS grandTotal
                FROM cart_details AS c
                INNER JOIN product_details AS pd 
                    ON c.product_id = pd.product_id AND pd.status = 1
                LEFT JOIN offer_detail AS od 
                    ON pd.product_id = od.product_id 
                    AND od.status = 1 
                    AND od.start_date <= NOW() 
                    AND od.end_date >= NOW()
                WHERE c.user_id = ?
            `;

            db.query(sql, [userObj.user_id], (err, results) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }
                const grandTotal = results[0].grandTotal || 0;
                // Now use grandTotal for payment processing
                res.json({ status: "1", total: grandTotal, message: "Payment processed" });
            });
        }, "1");
    });

    app.post('/api/admin/promo_code_add', (req, res) => {
        helper.dlog(req.body)
        var reqObj = req.body

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["code", "offer_price", "start_date", "end_date",
                "title", "description", "type", "minimum_order_amount", "maximum_discount_amount"], () => {
                    db.query(`SELECT promo_code_id FROM promo_codes WHERE code = ? AND status = 1`,
                        [reqObj.code], (err, results) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            }
                            if (results.length > 0) {
                                res.json({ status: "0", message: messages.promoExist });
                            } else {
                                db.query(`INSERT INTO promo_codes (code, offer_price, start_date, 
                                    end_date, title, description, type, minimum_order_amount, 
                                    maximum_discount_amount) VALUES (?,?,?,?,?,?,?,?,?)`,
                                    [reqObj.code, reqObj.offer_price, reqObj.start_date, reqObj.end_date,
                                    reqObj.title, reqObj.description, reqObj.type, reqObj.minimum_order_amount,
                                    reqObj.maximum_discount_amount],
                                    (err, result) => {
                                        if (err) {
                                            helper.throwHtmlError(err, res)
                                            return
                                        }
                                        if (result) {
                                            res.json({ status: "1", message: messages.addPromo });
                                        } else {
                                            res.json({ status: "0", message: messages.fail });
                                        }
                                    }
                                )
                            }
                        }
                    )
                })
        }, "1")
    })

    app.post('/api/admin/promo_code_update', (req, res) => {
        helper.dlog(req.body)
        var reqObj = req.body

        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["promo_code_id", "offer_price",
                "start_date", "end_date", "title", "description", "type",
                "minimum_order_amount", "maximum_discount_amount"], () => {
                    db.query(
                        `UPDATE promo_codes 
                         SET offer_price = ?, start_date = ?, end_date = ?, 
                             title = ?, description = ?, type = ?, 
                             minimum_order_amount = ?,maximum_discount_amount = ?, 
                             updated_date = NOW() WHERE promo_code_id = ? AND status = ?`,
                        [
                            reqObj.offer_price, reqObj.start_date, reqObj.end_date,
                            reqObj.title, reqObj.description, reqObj.type,
                            reqObj.minimum_order_amount, reqObj.maximum_discount_amount,
                            reqObj.promo_code_id,
                            1
                        ], (err, result) => {
                            if (err) {
                                helper.throwHtmlError(err, res);
                                return;
                            }

                            if (result.affectedRows > 0) {
                                res.json({ status: "1", message: messages.updatePromo });
                            } else {
                                res.json({ status: "0", message: messages.fail });
                            }
                        }
                    )
                })
        }, "1")
    })

    app.post('/api/admin/promo_code_delete', (req, res) => {
        helper.dlog(req.body)
        var reqObj = req.body

        checkAccessToken(req.headers, res, (userObj) => {

            helper.checkParameterValid(res, reqObj, ["promo_code_id"], () => {

                db.query(`UPDATE promo_codes SET status = ?, updated_date = NOW()
                         WHERE promo_code_id = ? AND status = ?`,
                    ["2", reqObj.promo_code_id, "1"], (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            res.json({ status: "1", message: messages.deletePromo });
                        } else {
                            res.json({ status: "0", message: messages.promoCodeNotFound });
                        }
                    }
                )
            })
        }, "1")
    })

    app.post('/api/admin/promo_code_list', (req, res) => {
        helper.dlog(req.body)
        var reqObj = req.body

        checkAccessToken(req.headers, res, (userObj) => {

            db.query(`SELECT promo_code_id, code, offer_price, start_date,
                         end_date, title, description, type, minimum_order_amount, 
                         maximum_discount_amount, created_date, updated_date
                         FROM promo_codes WHERE end_date >= NOW() 
                         AND status = 1 ORDER BY start_date DESC `, [],
                (err, result) => {
                    if (err) {
                        helper.throwHtmlError(err, res);
                        return;
                    }
                    res.json({ status: "1", payload: result.replace_null(), message: messages.success });
                })
        }, "1")
    })

    app.post('/api/admin/new_order_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            const userId = userObj.user_id || userObj.id;
            db.query(
                `SELECT 
                    od.order_id,od.cart_id,od.user_id, 
                    od.address_id,od.total_price,od.user_price, 
                    od.discount_price,od.delivery_price,od.promo_code_id, 
                    od.payment_type,od.pay_id,od.payment_status, 
                    od.order_status,od.status,od.created_date,
                    GROUP_CONCAT(DISTINCT ci.product_id SEPARATOR ', ') AS product_ids,
                    GROUP_CONCAT(DISTINCT ci.quantity SEPARATOR ', ') AS quantities,
                    GROUP_CONCAT(DISTINCT pd.product_name SEPARATOR ', ') AS names,
                    GROUP_CONCAT(DISTINCT (CASE WHEN imd.image <> '' THEN CONCAT(?, imd.image) ELSE '' END) SEPARATOR ', ') 
                    AS images
                 FROM order_details AS od 
                 INNER JOIN cart_items AS ci ON od.cart_id = ci.cart_id
                 INNER JOIN product_details AS pd ON ci.product_id = pd.product_id
                 LEFT JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                 WHERE (od.payment_type = 1 OR (od.payment_type = 2 AND od.payment_status = 2))
                 AND order_status = 1
                 GROUP BY od.order_id ORDER BY od.order_id`, [image_base_url], (err, result) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }
                res.json({ status: "1", payload: result, message: messages.success });
            }
            );
        }, "1");
    });

    app.post('/api/admin/completed_order_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            const userId = userObj.user_id || userObj.id;
            db.query(
                `SELECT 
                    od.order_id,od.cart_id,od.user_id, 
                    od.address_id,od.total_price,od.user_price, 
                    od.discount_price,od.delivery_price,od.promo_code_id, 
                    od.payment_type,od.pay_id,od.payment_status, 
                    od.order_status,od.status,od.created_date,
                    GROUP_CONCAT(DISTINCT ci.product_id SEPARATOR ', ') AS product_ids,
                    GROUP_CONCAT(DISTINCT ci.quantity SEPARATOR ', ') AS quantities,
                    GROUP_CONCAT(DISTINCT pd.product_name SEPARATOR ', ') AS names,
                    GROUP_CONCAT(DISTINCT (CASE WHEN imd.image <> '' THEN CONCAT(?, imd.image) ELSE '' END) SEPARATOR ', ') 
                    AS images
                 FROM order_details AS od 
                 INNER JOIN cart_items AS ci ON od.cart_id = ci.cart_id
                 INNER JOIN product_details AS pd ON ci.product_id = pd.product_id
                 LEFT JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                 WHERE (od.payment_type = 1 OR (od.payment_type = 2 AND od.payment_status = 2)) AND order_status = 2
                 GROUP BY od.order_id ORDER BY od.order_id`, [image_base_url], (err, result) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }
                res.json({ status: "1", payload: result, message: messages.success });
            }
            );
        }, "1");
    });

    app.post('/api/admin/cancel_decline_order_list', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;

        checkAccessToken(req.headers, res, (userObj) => {
            const userId = userObj.user_id || userObj.id;
            db.query(
                `SELECT 
                    od.order_id,od.cart_id,od.user_id, 
                    od.address_id,od.total_price,od.user_price, 
                    od.discount_price,od.delivery_price,od.promo_code_id, 
                    od.payment_type,od.pay_id,od.payment_status, 
                    od.order_status,od.status,od.created_date,
                    GROUP_CONCAT(DISTINCT ci.product_id SEPARATOR ', ') AS product_ids,
                    GROUP_CONCAT(DISTINCT ci.quantity SEPARATOR ', ') AS quantities,
                    GROUP_CONCAT(DISTINCT pd.product_name SEPARATOR ', ') AS names,
                    GROUP_CONCAT(DISTINCT (CASE WHEN imd.image <> '' THEN CONCAT(?, imd.image) ELSE '' END) SEPARATOR ', ') 
                    AS images
                 FROM order_details AS od 
                 INNER JOIN cart_items AS ci ON od.cart_id = ci.cart_id
                 INNER JOIN product_details AS pd ON ci.product_id = pd.product_id
                 LEFT JOIN image_detail AS imd ON pd.product_id = imd.product_id AND imd.status = 1
                 WHERE (od.payment_type = 1 OR (od.payment_type = 2 AND od.payment_status = 2)) AND order_status = 0
                 GROUP BY od.order_id ORDER BY od.order_id`, [image_base_url], (err, result) => {
                if (err) {
                    helper.throwHtmlError(err, res);
                    return;
                }
                res.json({ status: "1", payload: result, message: messages.success });
            }
            );
        }, "1");
    });

    app.post('/api/app/orders_details', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;
    
        // Validate that "order_id" and "user_id" are provided in the request body.
        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["order_id", "user_id"], () => {
                const userId = userObj.user_id || userObj.id;
                db.query(
                    `SELECT 
                        od.order_id,od.cart_id,od.user_id,
                        od.address_id,od.total_price,od.user_price,
                        od.discount_price,od.delivery_price,od.promo_code_id,
                        od.payment_type,od.pay_id,od.payment_status,
                        od.order_status,od.status,od.created_date,
                        GROUP_CONCAT(DISTINCT ci.product_id SEPARATOR ', ') AS product_ids,
                        GROUP_CONCAT(DISTINCT ci.quantity SEPARATOR ', ') AS quantities,
                        GROUP_CONCAT(DISTINCT pd.product_name SEPARATOR ', ') AS product_names,
                        GROUP_CONCAT(DISTINCT (CASE 
                            WHEN imd.image <> '' THEN CONCAT(?, imd.image)
                            ELSE '' END) SEPARATOR ', ') AS images
                     FROM order_details od
                     JOIN cart_items ci ON od.cart_id = ci.cart_id
                     JOIN product_details pd ON ci.product_id = pd.product_id AND pd.status = 1
                     LEFT JOIN image_detail imd ON pd.product_id = imd.product_id AND imd.status = 1
                     WHERE od.order_id = ? AND od.user_id = ?
                     GROUP BY od.order_id`,
                    [helper.ImagePath(), reqObj.order_id, userId],
                    (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.length > 0) {
                            res.json({ status: "1", payload: result[0], message: messages.success });
                        } else {
                            res.json({ status: "0", message: "Invalid order" });
                        }
                    }
                );
            });
        }, "1");
    });
    
    app.post('/api/admin/change_order_status', (req, res) => {
        helper.dlog(req.body);
        var reqObj = req.body;
    
        checkAccessToken(req.headers, res, (userObj) => {
            helper.checkParameterValid(res, reqObj, ["order_id", "user_id", "order_status"], () => {
    
                // Only update the order if its current status is lower than the new order_status
                db.query(`
                   UPDATE order_details 
                   SET order_status = ?, updated_date = NOW()
                   WHERE order_id = ? AND user_id = ? AND order_status < ?`, 
                    [reqObj.order_status, reqObj.order_id, reqObj.user_id, reqObj.order_status], 
                    (err, result) => {
                        if (err) {
                            helper.throwHtmlError(err, res);
                            return;
                        }
                        if (result.affectedRows > 0) {
                            var title = "";
                            var message = "";
                            var notified_type = 1;
    
                            // Determine notification title and message based on the new order_status.
                            switch (reqObj.order_status) {
                                case "2":
                                    title = "Order Accepted";
                                    message = "Your order " + reqObj.order_id + " has been accepted.";
                                    break;
                                case "3":
                                    title = "Order Delivered";
                                    message = "Your order " + reqObj.order_id + " has been delivered.";
                                    break;
                                case "4":
                                    title = "Order Cancelled";
                                    message = "Your order " + reqObj.order_id + " has been cancelled.";
                                    break;
                                case "5":
                                    title = "Order Declined";
                                    message = "Your order " + reqObj.order_id + " has been declined.";
                                    break;
                                default:
                                    break;
                            }
    
                            // Insert notification for the user.
                            db.query(`
                                INSERT INTO notification_details (ref_id, user_id, title, message, notification_type)
                                VALUES (?, ?, ?, ?, ?)`, 
                                [reqObj.order_id, reqObj.user_id, title, message, notified_type], 
                                (err, iResult) => {
                                    if (err) {                                    
                                        helper.throwHtmlError(err, res);
                                        return;
                                    }
                                    helper.dlog("Notification added");
                                }
                            );
                            res.json({ status: "1", message: "Order status updated successfully" });
                        } else {
                            res.json({ status: "0", message: messages.fail });
                        }
                    }
                );
            });
        }, "1");
    });


    // app.post('/api/admin/about_update', (req, res) => {
    //     helper.dlog(req.body);
    //     var reqObj = req.body;

    //     checkAccessToken(req.headers, res, (userObj) => {
    //         helper.checkParameterValid(res, reqObj, ["about_id", "details", "display_order"], () => {

    //             db.query(
    //                 `
    //                     UPDATE about_detail 
    //                     SET details = ?, display_order = ?, updated_date = NOW() 
    //                     WHERE about_id = ? AND status = ?
    //                     `,
    //                 [reqObj.details, reqObj.display_order, reqObj.about_id, "1"],
    //                 (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     if (result.affectedRows > 0) {
    //                         res.json({ status: "1", message: messages.updated });
    //                     } else {
    //                         res.json({ status: "0", message: messages.fail });
    //                     }
    //                 }
    //             );

    //         });
    //     }, "1");
    // });

    // app.post('/api/admin/about_delete', (req, res) => {
    //     helper.dlog(req.body);
    //     var reqObj = req.body;

    //     checkAccessToken(req.headers, res, (userObj) => {
    //         helper.checkParameterValid(res, reqObj, ["about_id"], () => {

    //             db.query(`
    //                     UPDATE about_detail SET status = ?,  updated_date = NOW() 
    //                     WHERE about_id = ? AND status = ?` ,
    //                 ["2", reqObj.about_id, "1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     if (result) {
    //                         res.json({ status: "1", message: messages.deleted });
    //                     } else {
    //                         res.json({ status: "0", message: messages.fail });
    //                     }
    //                 }
    //             );

    //         });
    //     }, "1");
    // });

    // app.post('/api/admin/restaurant_add', (req, res) => {
    //     var form = new multiparty.Form();
    //     checkAccessToken(req.headers, res, (userObj) => {
    //         form.parse(req, (err, reqObj, files) => {
    //             if (err) {
    //                 helper.throwHtmlError(err, res);
    //                 return;
    //             }
    //             helper.dlog("------------------Parameter--------------")
    //             helper.dlog(reqObj);
    //             helper.dlog("------------------Files--------------")
    //             helper.dlog(files);
    //             helper.checkParameterValid(res, reqObj, ["name", "shop_type", "food_type", "address",
    //                 "city", "state", "latitude", "longitude", "delivery_cost",], () => {
    //                     helper.checkParameterValid(res, files, ["image"], () => {

    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         var imageFileName = "restaurant/" + helper.fileNameGenerate(extension);

    //                         var newPath = imageServerPath + imageFileName;

    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             } else {
    //                                 db.query(`INSERT INTO restaurants(name, image, shop_type, food_type, address, city, state, latitude, 
    //                                     longitude, delivery_cost, created_date, updated_date,status) 
    //                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(),1)`, [
    //                                     reqObj.name[0], imageFileName, reqObj.shop_type[0],
    //                                     reqObj.food_type[0], reqObj.address[0], reqObj.city[0],
    //                                     reqObj.state[0], reqObj.latitude[0], reqObj.longitude[0],
    //                                     reqObj.delivery_cost[0]
    //                                 ], (err, result) => {
    //                                     if (err) {
    //                                         helper.throwHtmlError(err, res);
    //                                         return;
    //                                     }
    //                                     if (result) {
    //                                         res.json({ "status": "1", "message": messages.addRestaurant });
    //                                     } else {
    //                                         res.json({ "status": "0", "message": messages.fail });
    //                                     }
    //                                 });

    //                             }
    //                         })

    //                     })
    //                 })

    //         })
    //     }, "1")
    // })
    //     // update detail end point 
    //     app.post('/api/admin/restaurant_update', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["restaurant_id", "name", "shop_type", "food_type", "address",
    //                 "city", "state", "latitude", "longitude", "delivery_cost"], () => {

    //                     db.query(
    //                         `UPDATE restaurants SET name = ?, shop_type = ?,food_type = ?,
    //                         address = ?, city = ?,state = ?, latitude = ?,longitude = ?, delivery_cost = ?, created_date = ?, 
    //                         updated_date = NOW() WHERE restaurant_id = ? AND status = ?  `,
    //                         [reqObj.name[0], reqObj.shop_type[0],
    //                         reqObj.food_type[0], reqObj.address[0], reqObj.city[0],
    //                         reqObj.state[0], reqObj.latitude[0], reqObj.longitude[0],
    //                         reqObj.delivery_cost[0], reqObj.created_date, reqObj.restaurant_id, "1"],
    //                         (err, uresult) => {
    //                             if (err) {
    //                                 // Log and handle database errors
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             }

    //                             if (uresult.affectedRows > 0) {
    //                                 // Successfully updated reset_code
    //                                 res.json({ status: "1", message: messages.updateRestaurant });
    //                             } else {
    //                                 // Failed to update reset_code, possibly due to an invalid status
    //                                 res.json({ status: "0", message: messages.fail });
    //                             }
    //                         }
    //                     );

    //                 });
    //         }, "1");
    //     });
    //     // update image end point
    //     app.post('/api/admin/restaurant_update_image', (req, res) => {
    //         helper.dlog(req.body);
    //         const reqObj = req.body;

    //         var form = new multiparty.Form();
    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["restaurant_id"], () => {
    //                     helper.checkParameterValid(res, files, ["image"], () => {

    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         var imageFileName = "restaurant/" + helper.fileNameGenerate(extension);

    //                         var newPath = imageServerPath + imageFileName;

    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             } else {
    //                                 db.query(`UPDATE restaurants SET image = ?, updated_date = NOW() 
    //                                         WHERE 
    //                                         restaurant_id = ? AND status = ?`,
    //                                     [imageFileName, reqObj.restaurant_id[0], "1"], (err, result) => {
    //                                         if (err) {
    //                                             helper.throwHtmlError(err, res);
    //                                             return;
    //                                         }
    //                                         if (result) {
    //                                             res.json({ "status": "1", "message": messages.success });
    //                                         } else {
    //                                             res.json({ "status": "0", "message": messages.fail });
    //                                         }
    //                                     });

    //                             }
    //                         })

    //                     })
    //                 })

    //             })
    //         }, "1")

    //     })
    //    //List All or One by id 
    //     app.post('/api/admin/restaurant_list', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             // Check if 'restaurant_id' is provided
    //             const query = reqObj.restaurant_id
    //                 //check all 
    //                 ? `SELECT restaurant_id, name, image, shop_type, food_type, address,
    //                    city, state, latitude, longitude, delivery_cost, updated_date, status 
    //                    FROM restaurants WHERE restaurant_id = ? AND status = ?`
    //                 // check by id
    //                 : `SELECT restaurant_id, name, image, shop_type, food_type, address,
    //                    city, state, latitude, longitude, delivery_cost, updated_date, status 
    //                    FROM restaurants WHERE status = ?`;

    //             // Parameters for the query
    //             const params = reqObj.restaurant_id
    //                 ? [reqObj.restaurant_id, "1"]
    //                 : ["1"];

    //             db.query(query, params, (err, result) => {
    //                 if (err) {
    //                     // Log and handle database errors
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }

    //                 res.json({ status: "1", payload: result.replace_null(), message: messages.success });
    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/restaurant_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["restaurant_id"], () => {

    //                 // Query to fetch the image file path
    //                 db.query(
    //                     `SELECT image FROM restaurants WHERE restaurant_id = ? AND status = ?`,
    //                     [reqObj.restaurant_id, "1"],
    //                     (err, result) => {
    //                         if (err) {
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }

    //                         if (result.length > 0) {
    //                             const imagePath = imageServerPath + result[0].image;

    //                             // Delete the image file
    //                             fs.unlink(imagePath, (err) => {
    //                                 if (err) {
    //                                     helper.throwHtmlError(err);
    //                                 }

    //                                 // Update the restaurant status in the database
    //                                 db.query(
    //                                     `UPDATE restaurants SET status = ?, updated_date = NOW() 
    //                                     WHERE restaurant_id = ? AND status = ?`,
    //                                     ["2", reqObj.restaurant_id, "1"],
    //                                     (err, uresult) => {
    //                                         if (err) {
    //                                             helper.throwHtmlError(err, res);
    //                                             return;
    //                                         }

    //                                         if (uresult.affectedRows > 0) {
    //                                             res.json({ status: "1", message: messages.deleteRestaurant });
    //                                         } else {
    //                                             res.json({ status: "0", message: messages.fail });
    //                                         }
    //                                     }
    //                                 );
    //                             });
    //                         } else {
    //                             res.json({ status: "0", message: messages.notFound });
    //                         }
    //                     }
    //                 );
    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/restaurant_offer_add', (req, res) => {
    //         var form = new multiparty.Form();
    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["name", "restaurant_id", "start_date", "end_time"], () => {

    //                     helper.checkParameterValid(res, files, ["image"], () => {
    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         var imageFileName = "offer/" + helper.fileNameGenerate(extension);

    //                         var newPath = imageServerPath + imageFileName;

    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             } else {
    //                                 db.query(`INSERT INTO offer_details(name, image, restaurant_id, start_date, end_time, created_date, updated_date, status) 
    //                                     VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)`, [
    //                                     reqObj.name[0], imageFileName, reqObj.restaurant_id[0],
    //                                     reqObj.start_date[0], reqObj.end_time[0], "1"
    //                                 ], (err, result) => {
    //                                     if (err) {
    //                                         helper.throwHtmlError(err, res);
    //                                         return;
    //                                     }
    //                                     if (result) {
    //                                         res.json({ "status": "1", "message": messages.addRestaurantOffer });
    //                                     } else {
    //                                         res.json({ "status": "0", "message": messages.fail });
    //                                     }
    //                                 });


    //                             }
    //                         })

    //                     })
    //                 })

    //             })
    //         }, "1")

    //     })

    //     app.post('/api/admin/restaurant_offer_update', (req, res) => {
    //         var form = new multiparty.Form();
    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["offer_id", "name", "restaurant_id", "start_date", "end_date"], () => {

    //                     var condition = "";
    //                     var imageFileName = "";
    //                     if (files.image && files.image[0]) {
    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         imageFileName = "offer/" + helper.fileNameGenerate(extension);
    //                         var newPath = imageServerPath + imageFileName;

    //                         condition = ", image = '" + imageFileName + "'";
    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err);
    //                                 return;
    //                             }
    //                         })

    //                     }

    //                     db.query(
    //                         `UPDATE offer_details 
    //                          SET name = ?, start_date = ?, end_time = ?, updated_date = NOW(), status = 1 ${condition} 
    //                          WHERE restaurant_id = ? AND status < ? AND offer_id = ?`,
    //                         [
    //                             reqObj.name[0], reqObj.start_date[0], reqObj.end_date[0], reqObj.restaurant_id[0], "2", reqObj.offer_id[0]
    //                         ],
    //                         (err, result) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             }
    //                             if (result.affectedRows > 0) {
    //                                 res.json({ "status": "1", "message": messages.updateRestaurantOffer });
    //                             } else {
    //                                 res.json({ "status": "0", "message": messages.fail });
    //                             }
    //                         }
    //                     );
    //                 })

    //             })
    //         }, "1")
    //     })

    //     app.post('/api/admin/restaurant_offer_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         const reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["offer_id"], () => {

    //                 console.log('Offer ID:', reqObj.offer_id);
    //                 const offerId = parseInt(reqObj.offer_id); // Ensure correct data type

    //                 db.query(`
    //                     UPDATE offer_details 
    //                     SET status = 2
    //                     WHERE offer_id = ?`,
    //                     [offerId], (err, uresult) => {
    //                         if (err) {
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }

    //                         if (uresult.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.deleteRestaurantOffer });
    //                         } else {
    //                             res.json({ status: "0", message: messages.notFound });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/restaurant_offer_active_inactive', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["offer_id", "is_active"], () => {

    //                 var restCode = helper.createNumber();
    //                 db.query(`
    //                     UPDATE offer_details 
    //                     SET status = ?, updated_date = NOW() 
    //                     WHERE offer_id = ? AND (status = '1' OR status = '0')`,
    //                     [reqObj.is_active, reqObj.offer_id, "1"], (err, uresult) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }

    //                         if (uresult.affectedRows > 0) {
    //                             // Successfully updated reset_code
    //                             res.json({ status: "1", message: messages.success });
    //                         } else {

    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/restaurant_offer_list', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["offer_id"], () => {

    //                 db.query(`
    //                     SELECT offer_id, name, restaurant_id, image, start_date, end_time,status, created_date, updated_date, status FROM 
    //                 offer_details WHERE status = ? `,
    //                     ["1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/about_add', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["details", "display_order"], () => {

    //                 db.query(`
    //                     INSERT INTO about_detail (details, display_order, created_date, updated_date) VALUE (?,?,NOW(), NOW())` ,
    //                     [reqObj.details, reqObj.display_order], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.added });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }

    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/about_list', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {

    //             db.query(`
    //                     SELECT about_id, details FROM about_detail WHERE status = ? ORDER BY display_order ` ,
    //                 ["1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                 }
    //             );

    //         }, "1");
    //     });

    //     app.post('/api/admin/about_update', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["about_id", "details", "display_order"], () => {

    //                 db.query(
    //                     `
    //                     UPDATE about_detail 
    //                     SET details = ?, display_order = ?, updated_date = NOW() 
    //                     WHERE about_id = ? AND status = ?
    //                     `,
    //                     [reqObj.details, reqObj.display_order, reqObj.about_id, "1"],
    //                     (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.updated });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/about_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["about_id"], () => {

    //                 db.query(`
    //                     UPDATE about_detail SET status = ?,  updated_date = NOW() 
    //                     WHERE about_id = ? AND status = ?` ,
    //                     ["2", reqObj.about_id, "1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result) {
    //                             res.json({ status: "1", message: messages.deleted });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });




    //     app.post('/api/admin/menu_add', (req, res) => {
    //         var form = new multiparty.Form();
    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["name"], () => {

    //                     helper.checkParameterValid(res, files, ["image"], () => {
    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         var imageFileName = "menu/" + helper.fileNameGenerate(extension);

    //                         var newPath = imageServerPath + imageFileName;

    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             } else {
    //                                 db.query(`INSERT INTO menu(name, image, created_date, update_date, status) 
    //                                     VALUES (?, ?, NOW(), NOW(), ?)`, [
    //                                     reqObj.name[0], imageFileName, "1"
    //                                 ], (err, result) => {
    //                                     if (err) {
    //                                         helper.throwHtmlError(err, res);
    //                                         return;
    //                                     }
    //                                     if (result) {
    //                                         res.json({ "status": "1", "message": messages.addMenu });
    //                                     } else {
    //                                         res.json({ "status": "0", "message": messages.fail });
    //                                     }
    //                                 });


    //                             }
    //                         })

    //                     })
    //                 })

    //             })
    //         }, "1")

    //     })

    //     app.post('/api/admin/menu_update', (req, res) => {

    //         var form = new multiparty.Form();

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["menu_id", "name"], () => {

    //                     var condition = "";
    //                     var imageFileName = "";
    //                     if (files.image && files.image[0]) {
    //                         var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                         imageFileName = "menu/" + helper.fileNameGenerate(extension);
    //                         var newPath = imageServerPath + imageFileName;

    //                         condition = ", image = '" + imageFileName + "'";
    //                         fs.rename(files.image[0].path, newPath, (err) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err);
    //                                 return;
    //                             }
    //                         })

    //                     }

    //                     db.query(
    //                         `UPDATE menu
    //                          SET name = ?,update_date = NOW() ${condition}
    //                          WHERE status < ? AND menu_id = ?`,
    //                         [
    //                             reqObj.name[0], "2", reqObj.menu_id[0]
    //                         ],
    //                         (err, result) => {
    //                             if (err) {
    //                                 helper.throwHtmlError(err, res);
    //                                 return;
    //                             }
    //                             if (result.affectedRows > 0) {
    //                                 res.json({ "status": "1", "message": messages.updateMenu });
    //                             } else {
    //                                 res.json({ "status": "0", "message": messages.fail });
    //                             }
    //                         }
    //                     );
    //                 })

    //             })
    //         }, "1")
    //     })

    //     app.post('/api/admin/menu_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         const reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["menu_id"], () => {

    //                 db.query(`
    //                     UPDATE menu
    //                     SET status = ?, update_date = NOW()
    //                     WHERE menu_id = ? AND status != ?`,
    //                     ["2", reqObj.menu_id[0], "2"], (err, uresult) => {
    //                         if (err) {
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (uresult.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.deleteMenu });
    //                         } else {
    //                             res.json({ status: "0", message: messages.notFound });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/menu_list', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {

    //             db.query(`
    //                     SELECT menu_id, name, image, created_date, update_date, status FROM 
    //                 menu WHERE status = ? `,
    //                 ["1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                 }
    //             );
    //         }, "1");
    //     });

    //     app.post('/api/admin/menu_item_add', (req, res) => {
    //         var form = new multiparty.Form();
    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["menu_id", "restaurant_id", "category_id", "food_type", "name",
    //                     "size_portion", "ingredients", "description", "price"], () => {

    //                         helper.checkParameterValid(res, files, ["image"], () => {
    //                             var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                             var imageFileName = "menu_item/" + helper.fileNameGenerate(extension);

    //                             var newPath = imageServerPath + imageFileName;

    //                             fs.rename(files.image[0].path, newPath, (err) => {
    //                                 if (err) {
    //                                     helper.throwHtmlError(err, res);
    //                                     return;
    //                                 } else {
    //                                     db.query(`INSERT INTO menu_item(menu_id, restaurant_id, category_id, food_type, name,
    //                                         size_portion, ingredients, description, price, created_date, update_date, status) 
    //                                     VALUES (?,?,?,?,?,?,?,?,?, NOW(), NOW(), ?)`, [
    //                                         reqObj.menu_id[0], reqObj.restaurant_id[0], reqObj.category_id[0], reqObj.food_type[0],
    //                                         reqObj.name[0], reqObj.size_portion[0], reqObj.ingredients[0], reqObj.description[0],
    //                                         reqObj.price[0], "1"
    //                                     ], (err, result) => {
    //                                         if (err) {
    //                                             helper.throwHtmlError(err, res);
    //                                             return;
    //                                         }
    //                                         if (result) {
    //                                             res.json({ "status": "1", "message": messages.addMenuItem });
    //                                         } else {
    //                                             res.json({ "status": "0", "message": messages.fail });
    //                                         }
    //                                     });
    //                                 }
    //                             })

    //                         })
    //                     })

    //             })
    //         }, "1")

    //     })

    //     app.post('/api/admin/menu_item_update', (req, res) => {
    //         var form = new multiparty.Form();

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             form.parse(req, (err, reqObj, files) => {
    //                 if (err) {
    //                     helper.throwHtmlError(err, res);
    //                     return;
    //                 }
    //                 helper.dlog("------------------Parameter--------------")
    //                 helper.dlog(reqObj);
    //                 helper.dlog("------------------Files--------------")
    //                 helper.dlog(files);

    //                 helper.checkParameterValid(res, reqObj, ["menu_item_id", "menu_id", "restaurant_id", "category_id", "food_type", "name",
    //                     "size_portion", "ingredients", "description", "price"], () => {

    //                         var condition = "";
    //                         var imageFileName = "";
    //                         if (files.image && files.image[0]) {
    //                             var extension = files.image[0].originalFilename.substring(files.image[0].originalFilename.lastIndexOf(".") + 1)
    //                             imageFileName = "menu_item/" + helper.fileNameGenerate(extension);
    //                             var newPath = imageServerPath + imageFileName;

    //                             condition = ", image = '" + imageFileName + "'";
    //                             fs.rename(files.image[0].path, newPath, (err) => {
    //                                 if (err) {
    //                                     helper.throwHtmlError(err);
    //                                     return;
    //                                 }
    //                             })

    //                         }

    //                         db.query(
    //                             `UPDATE menu_item
    //                          SET menu_id = ?, category_id = ?, food_type = ?, name = ?,
    //                          size_portion = ?, ingredients = ?, description = ?, price = ?,update_date = NOW() ${condition}
    //                          WHERE status = ? AND menu_item_id = ? AND restaurant_id = ?`,
    //                             [
    //                                 reqObj.menu_id[0], reqObj.category_id[0], reqObj.food_type[0], reqObj.name[0],
    //                                 reqObj.size_portion[0], reqObj.ingredients[0], reqObj.description[0], reqObj.price[0], "2",
    //                                 reqObj.menu_item_id[0], reqObj.restaurant_id[0]
    //                             ],
    //                             (err, result) => {
    //                                 if (err) {
    //                                     helper.throwHtmlError(err, res);
    //                                     return;
    //                                 }
    //                                 if (result.affectedRows > 0) {
    //                                     res.json({ "status": "1", "message": messages.updateMenuItem });
    //                                 } else {
    //                                     res.json({ "status": "0", "message": messages.fail });
    //                                 }
    //                             }
    //                         );
    //                     })

    //             })
    //         }, "1")
    //     });

    //     app.post('/api/admin/menu_item_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         const reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["menu_item_id", "restaurant_id"], () => {

    //                 db.query(`
    //                     UPDATE menu_item
    //                     SET status = ?, update_date = NOW()
    //                     WHERE menu_item_id = ? AND restaurant_id = ? AND status = ?`,
    //                     ["2", reqObj.menu_item_id[0], reqObj.restaurant_id[0], "1"], (err, uresult) => {
    //                         if (err) {
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (uresult.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.deleteMenuItem });
    //                         } else {
    //                             res.json({ status: "0", message: messages.notFound });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/menu_item_list', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {

    //             db.query(`
    //                     SELECT menu_item_id, menu_id, restaurant_id, category_id, food_type, name,
    //                     size_portion, ingredients, description, price, created_date, update_date, status FROM 
    //                     menu_item WHERE status = ? `,
    //                 ["1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                 }
    //             );
    //         }, "1");
    //     });

    //     app.post('/api/admin/portion_add', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["name", "menu_item_id", "additional_price"], () => {

    //                 db.query(`
    //                     INSERT INTO portion_details(menu_item_id, name, additional_price, created_date, update_date) 
    //                     VALUES (?, ?, ?, NOW(), NOW())`,
    //                     [reqObj.menu_item_id, reqObj.name, reqObj.additional_price],
    //                     (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.addPortion });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/portion_update', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["portion_id", "name", "menu_item_id", "additional_price"], () => {

    //                 db.query(
    //                     `
    //                     UPDATE portion_details 
    //                     SET name = ?,menu_item_id = ?,additional_price = ?, update_date = NOW() 
    //                     WHERE portion_id = ? AND status = ?
    //                     `,
    //                     [reqObj.name, reqObj.menu_item_id, reqObj.additional_price, reqObj.portion_id, "1"],
    //                     (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.updatePortion });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/portion_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["portion_id"], () => {

    //                 db.query(`
    //                     UPDATE portion_details SET status = ?,  update_date = NOW() 
    //                     WHERE portion_id = ? AND status = ?` ,
    //                     ["2", reqObj.portion_id, "1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result) {
    //                             res.json({ status: "1", message: messages.deletePortion });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/portion_list_all', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {

    //             db.query(`
    //                     SELECT portion_id,menu_item_id, name, additional_price, created_date, update_date
    //                      FROM portion_details WHERE status = ?` ,
    //                 ["1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                 }
    //             );

    //         }, "1");
    //     });

    //     app.post('/api/admin/portion_list_by_id', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["menu_item_id"], () => {
    //                 db.query(`
    //                     SELECT portion_id,menu_item_id, name, additional_price, created_date, update_date
    //                      FROM portion_details WHERE "menu_item_id = ? AND status = ?` ,
    //                     [reqObj.menu_item_id, "1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                     }
    //                 );
    //             });

    //         }, "1");
    //     });

    //     app.post('/api/admin/ingredient_add', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, [ "menu_id","name", "additional_price"], () => {

    //                 db.query(`
    //                     INSERT INTO ingredient_detail(menu_id, name, additional_price, created_date, update_date) 
    //                     VALUES (?, ?, ?, NOW(), NOW())`,
    //                     [reqObj.menu_id, reqObj.name, reqObj.additional_price],
    //                     (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.addIngredient });
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/ingredient_update', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["ingredient_id", "name", "menu_id", "additional_price"], () => {

    //                 db.query(
    //                     `
    //                     UPDATE ingredient_detail
    //                     SET name = ?,menu_id = ?,additional_price = ?, update_date = NOW() 
    //                     WHERE ingredient_id = ? AND status = ?`,
    //                     [reqObj.name, reqObj.menu_id, reqObj.additional_price, reqObj.ingredient_id, "1"],
    //                     (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result.affectedRows > 0) {
    //                             res.json({ status: "1", message: messages.updateIngredient});
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/ingredient_delete', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["ingredient_id"], () => {

    //                 db.query(`
    //                     UPDATE ingredient_detail SET status = ?,  update_date = NOW() 
    //                     WHERE ingredient_id = ? AND status = ?` ,
    //                     ["2", reqObj.portion_id, "1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         if (result) {
    //                             res.json({ status: "1", message: messages.deleteIngredient});
    //                         } else {
    //                             res.json({ status: "0", message: messages.fail });
    //                         }
    //                     }
    //                 );

    //             });
    //         }, "1");
    //     });

    //     app.post('/api/admin/ingredient_list_all', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {

    //             db.query(`
    //                     SELECT ingredient_id,menu_id, name, additional_price, created_date, update_date
    //                      FROM ingredient_detail WHERE status = ?` ,
    //                 ["1"], (err, result) => {
    //                     if (err) {
    //                         // Log and handle database errors
    //                         helper.throwHtmlError(err, res);
    //                         return;
    //                     }
    //                     res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                 }
    //             );

    //         }, "1");
    //     });

    //     app.post('/api/admin/ingredient_list_by_id', (req, res) => {
    //         helper.dlog(req.body);
    //         var reqObj = req.body;

    //         checkAccessToken(req.headers, res, (userObj) => {
    //             helper.checkParameterValid(res, reqObj, ["menu_id"], () => {
    //                 db.query(`
    //                     SELECT ingredient_id,menu_id, name, additional_price, created_date, update_date
    //                      FROM ingredient_detail WHERE menu_id = ? AND status = ?` ,
    //                     [reqObj.menu_id, "1"], (err, result) => {
    //                         if (err) {
    //                             // Log and handle database errors
    //                             helper.throwHtmlError(err, res);
    //                             return;
    //                         }
    //                         res.json({ status: "1", payload: result.replace_null(), message: messages.success });

    //                     }
    //                 );
    //             });

    //         }, "1");
    //     });
}
