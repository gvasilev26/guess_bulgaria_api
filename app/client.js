const WebSocket = require('ws');
const webSocket = new WebSocket('ws://localhost:3000')
webSocket.onopen = function () {
    webSocket.send(JSON.stringify({ type: 'create', id: 'asd' }))
}
webSocket.onmessage = function(event) {
    console.log('Client received a message', event);
};
