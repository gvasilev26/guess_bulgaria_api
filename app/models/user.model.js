const mongoose = require('mongoose')

const schema = mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        auto: true,
    },
    stats: {
        single: {
            totalPoints: {
                type: Number,
                default: 0
            },
            roundsPlayed: {
                type: Number,
                default: 0
            },
            perfectAnswers: {
                type: Number,
                default: 0
            },
        },
        multi: {
            totalPoints: {
                type: Number,
                default: 0
            },
            roundsPlayed: {
                type: Number,
                default: 0
            },
            perfectAnswers: {
                type: Number,
                default: 0
            },
            gamesPlayed: {
                type: Number,
                default: 0
            },
            firstPlaces: {
                type: Number,
                default: 0
            },
        }
    },
    username: String
})

module.exports = mongoose.model('User', schema)
