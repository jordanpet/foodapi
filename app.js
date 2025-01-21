var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const  cors  = require('cors');
var fs = require('fs');
require('dotenv').config();

const config = require('/Users/mac/Documents/Expressjs-API/Food-api/config/config.js');

//var messages = require('../utils/messages');



var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// setup for express and socket io
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server, {
  cors:{
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
})
var serverPort = process.env.PORT
var user_socket_connect_list = [];

io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);  // Log socket ID on connection

  // When a new user joins
  socket.on('join', (username) => {
    users.push({ username, socketId: socket.id });
    console.log(`${username} joined`);

    // Emit a welcome message to the new user
    socket.emit('chat_message', `Welcome, ${username}!`);

    // Emit the new user's join to all connected clients
    socket.broadcast.emit('chat_message', `${username} has joined the chat!`);
  });

  // When a chat message is received
  socket.on('chat_message', (message) => {
    console.log('Received message: ', message);
    // Emit the message to all connected users
    io.emit('chat_message', message);
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    const userIndex = users.findIndex(user => user.socketId === socket.id);
    if (userIndex !== -1) {
      const username = users[userIndex].username;
      users.splice(userIndex, 1);  // Remove user from users array
      console.log(`${username} disconnected`);

      // Emit the user's disconnection to all other users
      io.emit('chat_message', `${username} has left the chat.`);
    }
  });
});

// Simulate real-time stock price updates
setInterval(() => {
  const stockData = { symbol: 'AAPL', price: (Math.random() * 1000).toFixed(2) };
  io.emit('stock_price_update', stockData);  // Emit updated stock price
}, 5000);  // Update every 5 seconds


// const loginController = require('./controllers/login_controllers.js');
// loginController.controllers(app, io, user_socket_connect_list);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

//Middleware and Route Setup
app.use(logger('dev'));
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRouter);
app.use('/users', usersRouter);

//Configuring CORS
const corsOptions = {
  origin: "http://localhost:4200",
}
app.use(cors(corsOptions));

//import express inside dynamically added
fs.readdirSync('./controllers').forEach((file) => {
  if (file.endsWith('.js')) {
    const route = require('./controllers/' + file);
    console.log(`Loaded module from ${file}:`, route); // Log the export structure

    if (typeof route.controllers === 'function') {
      route.controllers(app, io, user_socket_connect_list);
    } else {
      console.error(`Error: ${file} does not export a 'controllers' function.`);
    }
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');

  app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack
    res.status(500).send('Something broke!');
  });
  
});

module.exports = app;
//Server Start
server.listen(serverPort);
console.log("Server Start:" + serverPort)

//Custom Array and String Prototypes
Array.prototype.swap = (x,y) => {
  var b = this[x];
  this[x] = this[y];
  this[y] = b;
  return this;
}
Array.prototype.insert = (index, item) =>{
  this.splice(index,0,item);
}
Array.prototype.replace_null = function(replace = '"') {
  return JSON.parse(JSON.stringify(this).replace(/null/g, replace));
}

String.prototype.replaceAll = (search, replacement) =>{
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
}

