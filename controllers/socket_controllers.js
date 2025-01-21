var helper = require('./../helpers/db_helpers')
var db = require('./../helpers/db_helpers');
const  Socket  = require('socket.io');
var Socket_list = {};  // Initialize this object to store socket IDs for users
var messages = require('../utils/messages');

// socket_controllers.js
module.exports.controllers = (app, io, user_socket_connect_list) => {
  var response = '';
 

  io.on('connection', (client) =>{
    client.on('updateSocket', (data) => {
      helper.dlog('updateSocket  1-' + data)
      var jsonObj = JSON.parse(data);

      helper.checkParameterValidSocket(client, "updsteSocket" ,jsonObj,['id'], () =>{
        db.query("SELECT `id`, `email` FROM `user_detail` WHERE `id` = 1;", [jsonObj.id], (err, result) => {
          if(err){
            helper.throwSocketError(err, client, "updateSocket")
            return;
          }
          if(result.length > 0) {
            Socket_list['us_' + jsonObj.id] = {'socket_id':client.id}
            helper.dlog(Socket_list);
            response = {"success": "true", "status": "1", message: messages.success }
          }else {
            response = {"success": "false", "status": "0", message:messages.invalidUserPassword }
          }
          client.emit('updateSocket', response);
        } )
      })
    })
  })

};
