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
                if (!!ws.id) wsBusiness.disconnectUser(ws)
                this.terminateAndClearTimeout(ws)
            })
        })
    }

    /** websocket heartbeat, in order to terminate websocket if connection is lost with frontend */
    heartbeat (ws) {
        clearTimeout(ws.timeout)
        ws.timeout = setTimeout(() => {
            if (!!ws.id) wsBusiness.disconnectUser(ws)
            this.terminateAndClearTimeout(ws)
        }, 30000)
    }

    async parseMessage (message, ws) {
        let wsData = JSON.parse(message)
        console.log(wsData)
        ws.id = wsData.id
        ws.roomId = wsData.roomId
        switch (message.type) {
            case 'join': {
                wsBusiness.addUser(ws, wsData)
                break
            }
            case 'leave': {
                wsBusiness.removeUser(wsData.roomId, wsData.id)
                break
            }
            case 'changeSettings': {
                wsBusiness.changeSettings(wsData)
                break
            }
            case 'start': {
                await wsBusiness.startGame(wsData.roomId, wsData.id)
                break
            }
            case 'changeColor': {
                await wsBusiness.changeColor(wsData.roomId, wsData.id, wsData.color)
                break
            }
            case 'answer': {
                await wsBusiness.answer(wsData)
                break
            }
            case 'nextRound': {
                await wsBusiness.nextRound(wsData.roomId, wsData.id)
                break
            }
            case 'reconnect': {
                wsBusiness.reconnect(ws, wsData.roomId)
                break
            }
            case 'closeRoom': {
                let room = wsBusiness.closeRoom(wsData.roomId)
                // remove everyone from the room on close
                for (let ws of room.players) this.terminateAndClearTimeout(ws)
                break
            }
            case 'create': {
                wsBusiness.createRoom(ws, wsData)
                break
            }
        }
    }

    /**Terminate websocket and clear ping timeout */
    terminateAndClearTimeout (ws) {
        clearTimeout(ws.timeout)
        ws.terminate()
    }
}

module.exports = new WsServer()