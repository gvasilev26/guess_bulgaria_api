const User = require('../models/user.model')

exports.createUser = async (req, res) => {
    let user = new User({ username: 'Random generated name' })
    const str = `${user._id.generationTime}`
    user.username = 'Player_' + str.substring(str.length - 5)
    await user.save()
    return res.status(201).send({ ...user._doc })
}

exports.getUserStats = async (req, res) => {
    const user = await User.findById(req.params.id, { stats: 1 })
    return res.status(200).send({ ...user.stats })
}

exports.playGame = async (req, res) => {
    const points = Number(req.params.points)
    await User.updateOne({ _id: req.params.id }, {
        $inc: {
            'stats.single.totalPoints': points,
            'stats.single.roundsPlayed': 1,
            'stats.single.perfectAnswers': points === 1000 ? 1 : 0
        }
    }).exec()
    return res.status(204).send()
}
