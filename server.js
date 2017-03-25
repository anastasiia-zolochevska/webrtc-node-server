var express = require('express');
var server = require('./server_runner.js')

var port = process.env.PORT || 3001;

var app = express()

app.get('/server', function (req, res) {
  var room = req.param("room");
  server.start(room).then(() => res.send('done'));
})

app.listen(port, function () {
  console.log('Example app listening on port 3001!')
})