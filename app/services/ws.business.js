const User = require('../models/user.model')
const Location = require('../models/location.model')

const ROUND_START_TIMER = 3000;

class WebSocketBusiness {
    rooms = new Map()

    createRoom(ws, socketData) {
        if (!socketData.id) return

        let roomId
        do {
            roomId = Math.floor(Math.random() * 899999 + 100000)
        } while (this.rooms.has(roomId))

        this.rooms.set(roomId, {
            roomId: roomId,
            settings: {
                isPublic: !!socketData.isPublic,
                regions: socketData.regions || [],
                maxRounds: socketData.maxRounds !== undefined ? socketData.maxRounds : 10,
                answerTimeInSeconds: socketData.answerTimeInSeconds !== undefined ? socketData.answerTimeInSeconds : 30,
            },
            playedRounds: [],
            currentRound: undefined,
            isRoundStarted: false,
            players: [{
                socket: ws,
                id: socketData.id,
                isConnected: true,
                perfectAnswers: 0,
                color: socketData.color || 0,
                username: socketData.username,
                isCreator: true,
                lastAnswer: undefined,
                points: 0,
                roundLoaded: false
            }]
        })
        this.notifyPlayer(ws, 'current-data', this.getIngameRoundData(this.rooms.get(roomId)))
    }

    closeRoom(room) {
        this.rooms.delete(room.roomId)
    }

    addUser(ws, socketData) {
        const room = this.rooms.get(socketData.roomId)
        if (!room || room.players.length >= 16) {
            this.notifyPlayer(ws, 'join-failed')
            return
        }
        let alreadyIn = false
        for (let player of room.players) {
            if (player.id === socketData.id) {
                alreadyIn = true
                player.socket = ws
                player.isConnected = true
            }
        }
        if (!alreadyIn) room.players.push({
            socket: ws,
            id: socketData.id,
            isConnected: true,
            username: socketData.username,
            color: this.getFreeColor(room, socketData.color),
            roundPoints: undefined,
            isCreator: false,
            lastAnswer: undefined,
            points: 0,
            perfectAnswers: 0
        })
        this.notifyAllPlayers(room, 'player-join', { players: room.players })
        this.notifyPlayer(ws, 'current-data', this.getIngameRoundData(room))
    }

    removeUser(roomId, userId) {
        const room = this.rooms.get(roomId)
        if (!room) return

        this.removeUserFromRoom(room, userId)
    }

    removeUserFromRoom(room, userId) {
        let userIndex = room.players.findIndex((user) => user.id === userId)
        if (userIndex !== -1) room.players.splice(userIndex, 1)

        if (!room.players.length) this.closeRoom(room)
        else {
            if (!userIndex) {
                let leader = room.players[0]
                leader.isCreator = true
                this.notifyPlayer(leader.socket, 'make-creator')
            }
            this.notifyAllPlayers(room, 'player-leave', { players: room.players })
        }
    }

    changeSettings(socketData) {
        const room = this.rooms.get(socketData.roomId)
        if (!room || room.players[0].id !== socketData.id) return
        room.settings = {
            regions: socketData.regions || room.settings.regions || [],
            maxRounds: (socketData.maxRounds !== undefined ? socketData.maxRounds : room.settings.maxRounds),
            answerTimeInSeconds: (socketData.answerTimeInSeconds !== undefined ? socketData.answerTimeInSeconds : room.settings.answerTimeInSeconds),
            isPublic: socketData.isPublic !== undefined ? socketData.isPublic : room.settings.isPublic || false
        }
        this.notifyAllPlayers(room, 'settings-change', room.settings)
    }

    disconnectUser(ws) {
        const room = this.rooms.get(ws.roomId)
        if (!room) return

        for (let player of room.players)
            if (player.id === ws.id) {
                if (room.currentRound === undefined) this.removeUserFromRoom(room, player.id)
                else player.isConnected = false
                break
            }

        if (!room.players.length || room.players.every(player => !this.isPlayerConnectionOpen(player)))
            this.closeRoom(room)
        else if (this.hasEveryoneAnswered(room))
            this.endRound(room)
        else
            this.notifyAllPlayers(room, 'player-leave', { players: room.players })
    }

    async startGame(roomId, userId) {
        const room = this.rooms.get(roomId)
        if (!room || room.players[0].id !== userId || room.currentRound !== undefined || room.isRoundStarted || room.players.length < 2) return

        await this.changeRoundTarget(room)
    }

    async answer(socketData) {
        const room = this.rooms.get(socketData.roomId)
        if (!room) return

        let player = room.players.find(p => p.id === socketData.id)
        if (player === undefined) return
        player.lastAnswer = socketData.answer

        this.notifyAllPlayers(room, 'player-answer', { 'id': player.id })
        if (this.hasEveryoneAnswered(room)) this.endRound(room)
    }

    async nextRound(roomId, userId) {
        const room = this.rooms.get(roomId)
        if (!room || room.players[0].id !== userId || room.isRoundStarted) return

        await this.changeRoundTarget(room)
    }

    reconnect(ws, roomId) {
        const room = this.rooms.get(roomId)
        if (!room) return
        for (let player of room.players)
            if (player.id === ws.id) {
                player.isConnected = true
                player.socket = ws
                break
            }

        this.notifyPlayer(ws, 'current-data', this.getIngameRoundData(room))
    }

    changeColor(roomId, userId, color) {
        const room = this.rooms.get(roomId)
        if (!room || color > 15 || color < 0 || !this.isColorFree(room, color)) return

        for (let player of room.players)
            if (player.id === userId) {
                player.color = color
                break
            }

        this.notifyAllPlayers(room, 'color-change', { id: userId, color })
    }

    // helper functions

    getFreeColor(room, color) {
        if (this.isColorFree(room, color)) return color
        return this.getFreeColor(room, Math.floor(Math.random() * 16))
    }

    isColorFree(room, color) {
        for (const player of room.players)
            if (player.color === color) return false
        return true
    }

    hasEveryoneAnswered(room) {
        return room.players.every(player => player.lastAnswer !== undefined || !this.isPlayerConnectionOpen(player))
    }

    isPlayerConnectionOpen(player) {
        return player.socket.readyState === 1 || player.isConnected
    }

    endRound(room) {
        room.isRoundStarted = false
        for (let player of room.players) {
            //if the player has ran out of time, don't give points
            if (!player.lastAnswer || player.lastAnswer[0] === 0) {
                player.roundPoints = 0
                //reset the answer so it's not displayed
                player.lastAnswer = undefined
                continue
            }
            const distance = this.getDistance(player.lastAnswer[0], player.lastAnswer[1], room.currentRound.coordinates[0], room.currentRound.coordinates[1])
            let distanceReducer = 0
            if (distance > 75) distanceReducer = 7
            else if (distance > 50) distanceReducer = 6
            else if (distance > 20) distanceReducer = 5
            else if (distance > 4.20) distanceReducer = 3

            player.roundPoints = (1000 - distanceReducer * distance) | 0
            if (player.roundPoints === 1000) player.perfectAnswers++

            if (player.roundPoints < 0) player.roundPoints = 0
            player.points += player.roundPoints
        }

        this.notifyAllPlayers(room, 'end-round', this.getFullRoundData(room))
    }

    async changeRoundTarget(room) {
        room.isRoundStarted = true
        for (const player of room.players) player.lastAnswer = undefined
        if (room.currentRound) room.playedRounds.push(room.currentRound._id)
        if (room.playedRounds.length === room.settings.maxRounds) {
            await this.endGame(room)
            return
        }
        room.currentRound = await this.getNextLocation(room)
        if (room.currentRound === undefined) {
            await this.endGame(room)
            return
        }
        this.notifyAllPlayers(room, 'start-round', this.getIngameRoundData(room))
    }

    async getNextLocation(room) {
        let query = {
            _id: { $nin: room.playedRounds }
        }
        if (room.settings.regions.length > 0) query.regions = { $in: room.settings.regions }

        const locations = await Location.aggregate(
            [
                { $match: query },
                { $sample: { size: 1 } }
            ]
        ).exec()

        if (!locations.length) return undefined
        return locations[0]
    }

    notifyAllPlayers(room, type, message) {
        if (message != null && message.players) {
            message.players = message.players.map(p => Object.fromEntries(Object.entries(p).filter(e => e[0] !== 'socket')))
        }
        room.players.forEach(user => {
            if (user.socket.readyState === 1)
                user.socket.send(JSON.stringify({ type, message }))
            else if (user.socket.readyState === 3) {
                try {
                    user.socket.send(JSON.stringify({ type, message }))
                } catch (e) {
                }
            }
        })
    }

    notifyPlayer(ws, type, message) {
        if (ws.readyState === 1)
            ws.send(JSON.stringify({ type, message }))
    }

    async endGame(room) {
        this.notifyAllPlayers(room, 'end-game', this.getFullRoundData(room))
        await this.updatePlayersStatistics(room)
        for (let player of room.players) {
            player.points = 0
            player.lastAnswer = undefined
            if (!this.isPlayerConnectionOpen(player)) this.removeUserFromRoom(room, player.id)
        }
        room.currentRound = undefined
        room.playedRounds = []
        room.isRoundStarted = false
    }

    async updatePlayersStatistics(room) {
        const maxPoints = Math.max(...room.players.map(p => p.points))
        const ids = room.players.map(p => p.id)
        const users = await User.find({ _id: { $in: ids } }, { _id: 1, stats: 1 }).exec()
        for (let user of users) {
            const player = room.players.find(p => p.id === user._id.toString())

            const statsChanges = {
                totalPoints: [user.stats.multi.totalPoints, player.points],
                roundsPlayed: [user.stats.multi.roundsPlayed, room.playedRounds.length],
                perfectAnswers: [user.stats.multi.perfectAnswers, player.perfectAnswers],
                gamesPlayed: [user.stats.multi.gamesPlayed, 1],
                firstPlaces: [user.stats.multi.gamesPlayed, maxPoints === player.points ? 1 : 0],
            }

            user.stats.multi.totalPoints += statsChanges['totalPoints'][1]
            user.stats.multi.roundsPlayed += statsChanges['roundsPlayed'][1]
            user.stats.multi.perfectAnswers += statsChanges['perfectAnswers'][1]
            user.stats.multi.gamesPlayed += statsChanges['gamesPlayed'][1]
            user.stats.multi.firstPlaces += statsChanges['firstPlaces'][1]

            this.notifyPlayer(player.socket, 'stats-update', { statsChanges, overall: user.stats.multi })

        }
        await User.bulkSave(users)
    }

    roomPrivacy(isPublic, userId, roomId) {
        let room = this.rooms.get(roomId)
        if (!room || !room.players.find(p => p.isCreator).id === userId) return
        room.settings.isPublic = isPublic
        this.notifyAllPlayers(room, 'settings-change', room.settings)
    }

    getDistance(lat1, lon1, lat2, lon2) {
        const dLat = this.deg2rad(lat2 - lat1)  // deg2rad below
        const dLon = this.deg2rad(lon2 - lon1)
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)

        // Distance in km (6371 = Radius of the earth in km)
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    getIngameRoundData(room) {
        return {
            roomId: room.roomId,
            settings: room.settings,
            rounds: room.playedRounds.length,
            timer: ROUND_START_TIMER,
            currentRound: room.currentRound ? {
                name: room.currentRound.name,
                image: room.currentRound.image,
            } : {},
            players: room.players.map(p => {
                return {
                    id: p.id,
                    color: p.color,
                    username: p.username,
                    isCreator: p.isCreator,
                    points: p.points,
                    answer: p.lastAnswer,
                    isConnected: this.isPlayerConnectionOpen(p)
                }
            }
            )
        }
    }

    getFullRoundData(room) {
        return {
            settings: room.settings,
            rounds: room.playedRounds.length,
            currentRound: {
                name: !!room.currentRound ? room.currentRound.name : undefined,
                coordinates: !!room.currentRound ? room.currentRound.coordinates : undefined,
                description: !!room.currentRound ? room.currentRound.description : undefined,
            },
            players: room.players.map(p => {
                return {
                    id: p.id,
                    color: p.color,
                    username: p.username,
                    isCreator: p.isCreator,
                    points: p.points,
                    roundPoints: p.roundPoints,
                    answer: p.lastAnswer,
                    hasAnswered: p.lastAnswer !== undefined,
                    isConnected: this.isPlayerConnectionOpen(p)
                }
            }
            )
        }
    }

    roundLoaded(userId, roomId) {
        const room = this.rooms.get(roomId);
        const player = room.players.find(p => p.id === userId)
        if (!room || !player) return;
        player.roundLoaded = true;

        //TODO Wait max 10s for everyone to load (save first loaded time in room)
        if (room.players.every(p => p.roundLoaded || !this.isPlayerConnectionOpen(p))) this.timerStart(room)

    }

    timerStart(room) {
        this.notifyAllPlayers(room, 'timer-start', { timer: ROUND_START_TIMER })
        setTimeout(() => this.notifyAllPlayers(room, 'timer-end'), ROUND_START_TIMER + 500)
    }
}

module.exports = new WebSocketBusiness()
