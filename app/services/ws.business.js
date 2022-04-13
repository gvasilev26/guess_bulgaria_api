const User = require('../models/user.model')

class WebSocketBusiness {
    rooms = new Map()

    createRoom (ws, socketData) {
        if (!socketData.id) return

        let roomId
        do {
            roomId = Math.floor(Math.random() * 899999 + 100000)
            if (!this.rooms[roomId]) break
        } while (true)

        this.rooms[roomId] = {
            roomId: roomId,
            settings: {
                regions: socketData.regions || [],
                maxRounds: socketData.maxRounds || 10,
                answerTimeInSeconds: socketData.answerTimeInSeconds || 30,
            },
            playedRounds: [],
            currentRound: undefined,
            roundEndTime: 0,
            players: [{
                socket: ws,
                id: socketData.id,
                status: 1,
                perfectAnswers: 0,
                color: socketData.color || 0,
                username: socketData.username,
                isCreator: true,
                lastAnswer: undefined,
                points: 0,
            }]
        }
        ws.send(JSON.stringify({
            type: 'current-data',
            message: this.getIngameRoundData(this.rooms[roomId])
        }))
    }

    closeRoom (roomId) {
        let room = this.rooms.get(roomId)
        if (!room) return

        this.rooms.delete(roomId)
        return room
    }

    addUser (ws, socketData) {
        const room = this.rooms[socketData.roomId]
        if (!room) return
        room.players.add({
            socket: ws,
            id: socketData.id,
            status: 1,
            username: socketData.username,
            color: this.getFreeColor(room),
            roundPoints: undefined,
            isCreator: false,
            lastAnswer: undefined,
            points: 0,
        })
        this.notifyAllPlayers(room, 'player-join', ws.id)
        ws.send(JSON.stringify({ type: 'current-data', message: this.getIngameRoundData(room) }))
    }

    removeUser (ws, roomId, userId) {
        const room = this.rooms[roomId]
        if (!room) return

        let userIndex = room.players.findIndex((user) => user.id === userId)
        if (userIndex !== -1) room.players.slice(userIndex, 1)

        if (!room.players.length) this.closeRoom(roomId)
        else {
            if (!userIndex) {
                let leader = room.players[0]
                leader.isCreator = true
                leader.socket.send(JSON.stringify({ type: 'make-creator' }))
            }
            this.notifyAllPlayers(room, 'player-leave', userId)
        }
    }

    changeSettings (socketData) {
        const room = this.rooms[socketData.roomId]
        if (!room || room.players[0].id !== socketData.id) return
        room.setting = {
            regions: socketData.regions || room.setting.regions || [],
            maxRounds: socketData.maxRounds || room.setting.maxRounds || 10,
            answerTimeInSeconds: socketData.answerTimeInSeconds || room.setting.answerTimeInSeconds || 30,
        }
        this.notifyAllPlayers(room, 'settings-change', room.settings)
    }

    disconnectUser (ws) {
        const room = this.rooms[ws.roomId]
        if (!room) return

        for (let player of room.players)
            if (player.id === ws.id) {
                player.status = 0
                break
            }

        if (!room.players.length || room.players.every(player => !player.status)) this.closeRoom(ws.roomId)
    }

    async startGame (roomId, userId) {
        const room = this.rooms[roomId]
        if (!room || room.players.length < 2 || room.players[0].id !== userId) return

        await this.changeRoundTarget(room)
    }

    async answer (socketData) {
        const room = this.rooms[socketData.roomId]
        if (!room) return

        let player = room.players[socketData.id]
        player.lastAnswer = socketData.answer

        if (this.hasEveryoneAnswered(room)) await this.endRound(room)
    }

    async nextRound (roomId, userId) {
        const room = this.rooms[roomId]
        if (!room || room.players[0].id !== userId) return

        if (room.playedRounds.length === room.settings.maxRounds) await this.endGame(room)
        else await this.changeRoundTarget(room)
    }

    reconnect (ws, roomId) {
        const room = this.rooms[roomId]
        if (!room) return
        for (let player of room.players)
            if (player.id === ws.id) {
                player.status = 1
                player.socket = ws
                break
            }

        ws.send(JSON.stringify({ type: 'current-data', message: this.getIngameRoundData(room) }))
    }

    changeColor (roomId, userId, color) {
        const room = this.rooms[roomId]
        if (!room || color > 15 || color < 0 || !this.isColorFree(room, color)) return

        for (let player of room.players)
            if (player.id === userId) {
                player.color = color
                break
            }

        this.notifyAllPlayers(room, 'color-change', { id: userId, color })
    }

    // helper functions

    getFreeColor (room) {
        while (true) {
            let color = Math.floor(Math.random() * 16)
            if (this.isColorFree(room, color)) return color
        }
    }

    isColorFree (room, color) {
        for (const player of room.players)
            if (player.color === color) return false
        return true
    }

    hasEveryoneAnswered (room) {
        return room.players.every(player => player.lastAnswer !== undefined)
    }

    async endRound (room) {
        for (let player of room.players) {
            if (!player.lastAnswer) {
                player.roundPoints = 0
                continue
            }
            const distance = this.getDistance(player.lastAnswer[0], player.lastAnswer[1], room.currentRound.location[0], room.currentRound.location[1])
            player.roundPoints = 1000 - (distance < 10 ? 0 : distance)
            if (player.roundPoints === 1000) player.perfectAnswers++

            if (player.roundPoints < 0) player.roundPoints = 0
            player.points += player.roundPoints
        }

        this.notifyAllPlayers(room, 'end-round', this.getFullRoundData())
    }

    async changeRoundTarget (room) {
        for (const player of room.players) player.lastAnswer = undefined
        if (room.currentRound) room.playedRounds.push(room.currentRound._id)
        room.currentRound = await this.getNextLocation(room)
        if (room.currentRound === undefined) {
            await this.endGame(room)
            return
        }
        room.roundEndTime = Date.now() + room.settings.answerTimeInSeconds * 1000
        this.notifyAllPlayers(room, 'start-round', this.getIngameRoundData(room))
    }

    async getNextLocation (room) {
        let query = {
            _id: { $nin: room.playedRounds }
        }
        if (room.settings.regions.length > 0) query.regions = { $in: room.settings.regions }

        const locations = await Location.find(query).exec()

        if (!locations.length) return undefined
        return locations[Math.floor(Math.random() * locations.length)]
    }

    notifyAllPlayers (room, type, message) {
        room.players.forEach(user => {
            user.socket.send(JSON.stringify({ type, message }))
        })
    }

    async endGame (room) {
        this.notifyAllPlayers(room, 'end-game', this.getFullRoundData())
        await this.updatePlayersStatistics()
        for (let player of room.players) {
            player.points = 0
            player.lastAnswer = undefined
            if (!player.status) this.removeUser(room.roomId, player.id)
        }
        room.currentRound = undefined
        room.playedRounds = []
        room.roundEndTime = 0
    }

    async updatePlayersStatistics (room) {
        const maxPoints = Math.max(...room.players.map(p => p.points))
        let requests = []
        for (let player of room.players) {
            requests.push(User.updateOne({ _id: player.id }, {
                $inc: {
                    'stats.multi.totalPoints': player.points,
                    'stats.multi.roundsPlayed': room.playedRounds.length,
                    'stats.multi.perfectAnswers': player.perfectAnswers,
                    'stats.multi.gamesPlayed': 1,
                    'stats.multi.firstPlaces': maxPoints === player.points ? 1 : 0,
                }
            }).exec())
        }
        await Promise.all(requests)
    }

    getDistance (lat1, lon1, lat2, lon2) {
        const dLat = this.deg2rad(lat2 - lat1)  // deg2rad below
        const dLon = this.deg2rad(lon2 - lon1)
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)

        // Distance in km (6371 = Radius of the earth in km)
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    deg2rad (deg) {
        return deg * (Math.PI / 180)
    }

    getIngameRoundData (room) {
        return {
            roomId: room.roomId,
            settings: room.settings,
            rounds: room.playedRounds.length,
            roundEndTime: room.roundEndTime,
            currentRound: {
                name: room.currentRound?.name,
                imageUrl: room.currentRound?.imageUrl,
            },
            players: room.players.map(p => {
                    return { id: p.id, color: p.color, username: p.username, isCreator: p.isCreator, points: p.points }
                }
            )
        }
    }

    getFullRoundData (room) {
        return {
            settings: room.settings,
            rounds: room.playedRounds.length,
            roundEndTime: room.roundEndTime,
            currentRound: room.currentRound,
            players: room.players.map(p => {
                    return {
                        id: p.id,
                        color: p.color,
                        username: p.username,
                        isCreator: p.isCreator,
                        points: p.points,
                        roundPoints: p.roundPoints,
                        answer: p.lastAnswer
                    }
                }
            )
        }
    }
}

module.exports = new WebSocketBusiness()
