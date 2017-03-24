
var webrtc = require('wrtc');
var appInsights = require("applicationinsights");
var socketClient = require('socket.io-client');
var Promise = require('promise');

var RTCPeerConnection = webrtc.RTCPeerConnection;
var RTCSessionDescription = webrtc.RTCSessionDescription;
var RTCIceCandidate = webrtc.RTCIceCandidate;

var pcConfig = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

var peerConnection, socket, room, dataChannel;

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
};


function sendMessage(message) {
  log('Server sending message: ', message);
  socket.emit('message', message, room);
}

function log(message) {
  console.log(message);
  appInsightsClient.trackTrace(message);
}



function onIceCandidate(event) {
  if (!event.candidate) return;
  log('onicecandidate');
  sendMessage({
    type: 'candidate',
    candidate: event.candidate
  });
}

function handleError(error) {
  appInsightsClient.trackException(error);
  throw error;
}

var checks = 0;
var expected = 5;
var rttSum = 0;


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

function addStats(event) {
  var data = JSON.parse(event.data);
  if (data.receivedTs) {
    rttSum += Date.now() - data.sentTs;
  }
}

function sendMessageThroughDataChennel() {
  dataChannel.send(JSON.stringify({ "sentTs": Date.now() }));
}

function startTest(params) {
  room = params;
  socket = socketClient('http://3dstreamingsignalingserver.azurewebsites.net:80');
  socket.emit('join', room);
  socket.on('message', onSocketReceivedMessage);

  peerConnection = new RTCPeerConnection(pcConfig);
  peerConnection.onicecandidate = onIceCandidate;

  console.log("HEKJRJKEF");

  return new Promise(function (resolve, reject) {
    peerConnection.ondatachannel = function (event) {
      dataChannel = event.channel;
      dataChannel.onmessage = function (event) {

        addStats(event);

        if (++checks == expected) {
          done();
          resolve(rttSum / expected);
        } else {
          sendMessageThroughDataChennel();
        }

      };
      dataChannel.onopen = function () {
        sendMessageThroughDataChennel();
      }
    }
  });

}

function done() {
  peerConnection.close();
  socket.emit('bye', room);
}

module.exports = {
  startTest: startTest
}
