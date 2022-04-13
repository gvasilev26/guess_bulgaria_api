const User = require('../models/user.model')
const mongoose = require('mongoose')

exports.createUser = async (req, res) => {
    let user = new User({ username: 'Random generated name', stats: {} })
    await user.save();
    return res.status(201).send({ user })
}

exports.getUserStats = async (req, res) => {
    const user = await User.findById(new mongoose.Types.ObjectId(req.params.userId), {stats: 1});
    return res.status(200).send({ ...user.stats })
}

exports.updateUserStats = async (req, res) => {
    await User.updateOne({ _id: new mongoose.Types.ObjectId(req.params.userId) }, {
        $inc: {
            'stats.single.totalPoints': req.body.points,
            'stats.single.roundsPlayed': 1,
            'stats.single.perfectAnswers': req.body.points === 1000 ? 1 : 0
        }
    }).exec()
    return res.status(204).send()
}
