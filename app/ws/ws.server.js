const WebSocket = require('ws')
const wsBusiness = require('../services/ws.business')

/** Handles and communicates all web socket traffic from frontend. */
class WsServer {
    /**Initialize web socket server and open a listener*/
    startWebSocket (server) {
        /**Establish websocket connection handler*/
        new WebSocket.Server({ server }).on('connection', (ws) => {
            ws.timeout = setTimeout(() => {
                this.terminateAndClearTimeout(ws)
            }, 30000)

            ws.on('message', async message => {
                this.heartbeat(ws)
                await this.parseMessage(message.toString(), ws)
            })

            ws.on('close', () => {
                if (!!ws.id) wsBusiness.removeUser(ws)
                this.terminateAndClearTimeout(ws)
            })
        })
    }

    /** websocket heartbeat, in order to terminate websocket if connection is lost with frontend */
    heartbeat (ws) {
        clearTimeout(ws.timeout)
        ws.timeout = setTimeout(() => {
            //todo maybe change it as a someone who left so they can rejoin
            if (!!ws.id) wsBusiness.removeUser(ws)
            this.terminateAndClearTimeout(ws)
        }, 30000)
    }

    async parseMessage (message, ws) {
        let wsData = JSON.parse(message)
        console.log(wsData)
        ws.id = wsData.id
        ws.roomId = wsData.roomId
        switch(message.type){
            case 'join': {
                wsBusiness.addUser(ws)
                break;
            }
            case 'leave': {
                wsBusiness.removeUser(ws)
                break;
            }
            case 'closeRoom': {
                let room = wsBusiness.closeRoom(ws.roomId)
                // remove everyone from the room on close
                for (let ws of room) this.terminateAndClearTimeout(ws)
                break;
            }
            case 'create': {
                wsBusiness.createRoom(ws)
                break;
            }
        }
    }

    /**Terminate websocket and clear ping timeout */
    terminateAndClearTimeout (ws) {
        clearTimeout(ws.timeout)
        ws.terminate()
    }

    notifyAllUsers (roomId, type, message) {
        wsBusiness.rooms[roomId].forEach(user => {
            user.send(JSON.stringify({ type, message }))
        })
    }
}

module.exports = new WsServer()
