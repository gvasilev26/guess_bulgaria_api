const wsBusiness = require("../services/ws.business")

exports.getPublicRooms = async (_, res) => {
    return res.status(200).send(Object.values(wsBusiness.rooms).filter(r => r.public).map(r => {
        return {
            roomId: r.roomId,
            creatorName: r.players.find(p => p.isCreator),
            playerCount: r.players.length
        }
    }))
}
