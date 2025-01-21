const { name } = require('ejs');
var moment = require('moment-timezone');
var db = require('/Users/mac/Documents/Expressjs-API/Food-api/helpers/db_helpers.js');
const fs = require('fs');
const config = require('/Users/mac/Documents/Expressjs-API/Food-api/config/config.js');
require('dotenv').config();

const app_debug_mode = true;
const timezone_name = "Africa/Lagos";
const msg_server_internal_error = "server internal Error";

// Placeholder for dlog function implementation
const dlog = (log) => {
    console.log(log);
};

// Placeholder for serverDateTime function implementation
const serverDateTime = (format) => {
    return moment().tz(timezone_name).format(format);
};

// Placeholder for serverYYYYMMDDHHmmss function implementation
const serverYYYYMMDDHHmmss = () => {
    return moment().tz(timezone_name).format('YYYYMMDDHHmmss');
};

module.exports = {

    ImagePath: () => {
        return "http://192.168.1.2:3004/img/";
    },

    throwHtmlError: (err, res) => {
        if (!err) {
            dlog("Error object is null or undefined.");
            if (res) {
                res.json({ status: "0", message: msg_server_internal_error });
            }
            return;
        }

        dlog("-------------------------App Helpers Throw crash(" + serverYYYYMMDDHHmmss()
            + ")---------------");
        dlog(err.stack);

        fs.appendFile('./crash_log/Crash' + serverDateTime('YYYY-MM-DD HH mm ss ms')
            + '.txt', err.stack, (err) => {
                if (err) {
                    dlog(err);
                }
            });
        if (res) {
            res.json({ 'status': '0', 'message': msg_server_internal_error });
        }
    },

    throwSocketError: (err, client, eventName) => {
        dlog("-------------------------App Helpers Throw crash(" + serverYYYYMMDDHHmmss()
            + ")---------------");
        dlog(err.stack);

        fs.appendFile('./crash_log/Crash' + serverDateTime('YYYY-MM-DD HH mm ss ms')
            + '.txt', err.stack, (err) => {
                if (err) {
                    dlog(err);
                }
            });
        if (client) {
            client.emit(eventName, { 'status': '0', 'message': msg_server_internal_error });
        }
    },

    checkParameterValid: (res, jsonObj, checkKey, callback) => {
        var isValid = true;
        var missingParameter = "";

        checkKey.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(jsonObj, key)) {
                isValid = false;
                missingParameter += key + " ";
            }
        });

        if (!isValid) {
            res.json({ 'status': '0', 'message': "Missing parameter(" + missingParameter + ")" });
        } else {
            return callback();
        }
    },

    checkParameterValidSocket: (client, eventName, jsonObj, checkKey, callback) => {
        var isValid = true;
        var missingParameter = "";

        checkKey.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(jsonObj, key)) {
                isValid = false;
                missingParameter += key + ' ';
            }
        });

        if (!isValid) {
            client.emit(eventName, {
                'status': '0', 'message': "Missing parameter(" + missingParameter + ")"
            });
        } else {
            return callback();
        }
    },

    createRequstToken: () => {
        var chars = "123456789abcdefghijkmnopqrstwvxyzABCDEFGHIJKMNOPQISTWVXYZ";
        var result = "";
        for (let i = 0; i < 20; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    fileNameGenerate: (extension) => {
        var chars = "123456789abcdefghijkmnopqrstwvxyzABCDEFGHIJKMNOPQISTWVXYZ";
        var result = "";
        for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return serverDateTime("YYYYMMDDHHmmssms") + result + '.' + extension;
    },

    createNumber: (length = 6) => {
        var chars = "123456789";
        var result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const maxLength = 13;
        return result.slice(0, maxLength);
    },

    generateUsername: (username) => {
        var randomNum1 = Math.floor(Math.random() * 1000);
        var randomNum2 = Math.floor(Math.random() * 1000);
        return [`${username}_${randomNum1}`, `${username}_${randomNum2}`];
    },

    validateUsername: (username) => {
        if (username.length < 2 || username.length > 20) {
            return false;
        }

        for (let i = 0; i < username.length; i++) {
            const char = username[i];
            if (!((char >= 'a' && char <= 'z') || 
                  (char >= 'A' && char <= 'Z') || 
                  (char >= '0' && char <= '9') || 
                  char === '_')) {
                return false;
            }
        }

        return true;
    },

    dlog: (log) => {
        console.log(log);
    },

    serverDateTime: (format) => {
        return moment().tz(timezone_name).format(format);
    },

    serverYYYYMMDDHHmmss: () => {
        return moment().tz(timezone_name).format('YYYYMMDDHHmmss');
    },
};

process.on('uncaughtException', (err) => {
    dlog(`Uncaught exception: ${err.stack}`);
});
