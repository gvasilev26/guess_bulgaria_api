class WebSocketBusiness {
    rooms = new Map()

    createRoom (ws) {
        this.rooms[ws.roomId] = [ws]
    }

    closeRoom (roomId) {
        let room = this.rooms.get(roomId)
        this.rooms.delete(roomId)
        return room
    }

    addUser (ws) {
        let room = this.rooms[ws.roomId]
        if (!room) return
        room.add(ws)
    }

    removeUser (ws) {
        const room = this.rooms[ws.roomId]
        if (!room) return

        let userIndex = room.findIndex((user) => user.id === ws.id)
        if (userIndex !== -1) room.slice(userIndex, 1)

        if (room.length === 0) this.closeRoom(ws.roomId)
    }
}
module.exports = new WebSocketBusiness();
