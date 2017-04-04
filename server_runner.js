
var webrtc = require('wrtc');
var appInsights = require("applicationinsights");
var socketClient = require('socket.io-client');
var Promise = require('promise');

var RTCPeerConnection = webrtc.RTCPeerConnection;
var RTCSessionDescription = webrtc.RTCSessionDescription;
var RTCIceCandidate = webrtc.RTCIceCandidate;

var pcConfig = {
  'iceServers': [
    {
      'url': 'stun:stun.l.google.com:19302'
    },
    {
      url: 'turn:13.65.204.45:3478',
      credential: '3Dstreaming0317',
      username: 'anzoloch'
    }]
};

var peerConnection, socket, room;

appInsights.setup().setAutoCollectExceptions(true).start();
var appInsightsClient = appInsights.getClient();


function onSocketReceivedMessage(message) {
  log('Got message on server', message.type);
  if (message.type === 'offer') {
    setRemoteDescription(message);
    createAnswer();
  } else if (message.type === 'candidate') {
    peerConnection.addIceCandidate(message.candidate);
  }

}

function sendMessage(message) {
  log('Server sending message: ', message);
  socket.emit('message', message, room);
}

function log(message, data) {
  if (!data) { data = '' }
  console.log(message, data);
  appInsightsClient.trackTrace(message + data);
}

function onIceCandidate(event) {
  if (!event.candidate) return;
  sendMessage({
    type: 'candidate',
    candidate: event.candidate
  });
}

function handleError(error) {
  appInsightsClient.trackException(error);
  throw error;
}



function setRemoteDescription(desc) {
  log('Server: set remote description');
  peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
}

function createAnswer() {
  log('Server: create answer');
  peerConnection.createAnswer(
    setLcalDescription,
    handleError
  );
}

function setLcalDescription(desc) {
  log('Server: set local description', desc);
  peerConnection.setLocalDescription(
    new RTCSessionDescription(desc),
    sendMessage.bind(undefined, desc),
    handleError
  );
}


function start(params) {
  room = params;
  socket = socketClient('http://3dstreamingsignaling.azurewebsites.net:80');
  socket.emit('join', room);
  socket.on('message', onSocketReceivedMessage);

  peerConnection = new RTCPeerConnection(pcConfig);
  peerConnection.onicecandidate = onIceCandidate;

  return new Promise(function (resolve, reject) {
    peerConnection.ondatachannel = function (event) {

      var dataChannel = event.channel;

      dataChannel.onmessage = function (event) {
        log("Server received message", event.data);
        if (event.data == "close") {
          done();
          resolve();
        }
        else {
          var data = JSON.parse(event.data);
          data = Object.assign({ receivedTs: Date.now() }, data);
          dataChannel.send(JSON.stringify(data));
        }
      }

    }
  });
}

function done() {
  peerConnection.close();
  socket.emit('bye', room);
}

module.exports = {
  start: start
}
