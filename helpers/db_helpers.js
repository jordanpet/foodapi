 var mysql = require('mysql2');
 require('dotenv').config();
 var helper = require('/Users/mac/Documents/Expressjs-API/Food-api/helpers/helpers.js');
 const config = require('/Users/mac/Documents/Expressjs-API/Food-api/config/config.js');
 require('dotenv').config();
 


//Optional Configuration Check
var dbConfig = {
    host: process.env.DB_HOST, // Ensure this is correctly loaded from .env
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: process.env.DB_TIMEZONE,
    charset: process.env.DB_CHARSET 
  };
  var db = mysql.createConnection(dbConfig);
// Optional Configuration Check (if using 'config' for optional features)
if (process.env.optionalFeature && process.env.optionalFeature.detail) {
    var detail = process.env.optionalFeature;  // Assuming it's set in .env
    helper.dlog('config ' + detail);
  }
 reconnect(db, () => {})

 function reconnect(connection, callback){
    helper.dlog("\n New connection tentative ... (" + helper.
        serverYYYYMMDDHHmmss() + ")")
    connection = mysql.createConnection(dbConfig);
    connection.connect((err) =>{
        //Handling Connection Errors
        if(err){
            helper.throwHtmlError(err);
            setTimeout(() =>{
                helper.dlog('---------------------08 ReConnecting Error('+ helper.
                    serverYYYYMMDDHHmmss() +')-------------');
                    reconnect(connection,callback);
            }, 1000);
        } else{
            helper.dlog('\n\t ------- New connection established with database. --------');
                db = connection;
                return callback();
        }
     })

    connection.on('error',(err) =>{
        helper.dlog('-------App is connection Crash 08 Helper ('+ helper.
                    serverYYYYMMDDHHmmss() +')----------');
       if(err.code === "PROTOCOL_CONNECTION_LOST"){
        helper.dlog
        ("/!\\ PROTOCOL_CONNECTION_LOST cannot establish connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       }else if(err.code === "PROTOCOL_ENQUEUE_AFTER_QUIT"){
        helper.dlog
        ("/!\\ PROTOCOL_ENQUEUE_AFTER_QUIT cannot establish a connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       } else if(err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"){
        helper.dlog
        ("/!\\ PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR cannot establish a connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       } else if(err.code === "PROTOCOL_HANDSHAKE_TWICE"){
        helper.dlog
        ("/!\\ PROTOCOL_HANDSHAKE_TWICE cannot establish a connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       } else if(err.code === "ECONNREFUSED"){
        helper.dlog
        ("/!\\ ECONNREFUSED cannot establish a connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       } else if(err.code === "PROTOCOL_PACKETS_OUT_OF_ORDER"){
        helper.dlog
        ("/!\\ PROTOCOL_PACKETS_OUT_OF_ORDER cannot establish a connection with the database. /!\\(" + err.code +")");
        reconnect(db, callback)
       }else {
        throw err;
       }
       
     })

 }

 module.exports = {
     query: (sqlQuery, args, callback) =>{
         if(db.state ==='authenticated' || db.state === "connected"){
             db.query(sqlQuery, args, (error, result) =>{
                 return callback(error,result)
             }) 
         }else if(db.state === "protocol_error"){
             reconnect (db, () => {
                 db.query(sqlQuery, args, (error, result) =>{
                     return callback(error,result)
                 }) 
             })
         }else{
             reconnect (db, () => {
                 db.query(sqlQuery, args, (error, result) =>{
                     return callback(error,result)
                 }) 
             })
         }
     }
 }

 process.on('uncaughtException', (err) => {
     helper.dlog
     ('-------------------App is crash DB helper(" + helper.serverYYYYMMDDHHmmss() + ")-----------------');
     helper.dlog(err.code);
   // helper.throwHtmlError(err);
 })