const mongoose = require('mongoose')

const schema = mongoose.Schema({
    _id: {
        type: mongoose.Types.ObjectId,
        default: new mongoose.Types.ObjectId()
    },
    name: String,
    imageUrl: String,
    region: Number,
    coordinates: [],
    description: String
})

module.exports = mongoose.model('Location', schema)
