const wsBusiness = require('../services/ws.business')

exports.getPublicRooms = async (_, res) => {
    let output = []
    for (let value of wsBusiness.rooms.values()) {
        if (value.settings.isPublic && value.currentRound === undefined) {
            output.push({
                roomId: value.roomId,
                creatorName: value.players.find(p => p.isCreator).username,
                playerCount: value.players.length,
                settings: value.settings
            })
        }
    }

    return res.status(200).send(output)
}
