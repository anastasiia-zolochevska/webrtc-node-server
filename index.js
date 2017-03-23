var express = require('express');
var server = require('./server.js')

var port = process.env.PORT || 3001;

var app = express()

app.get('/server', function (req, res) {
  server.startTest("westEurope").then(rtt => res.send('RTT '+rtt));
})

app.listen(port, function () {
  console.log('Example app listening on port 3001!')
})