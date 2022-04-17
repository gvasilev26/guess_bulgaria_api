const mongoose = require('mongoose')

const schema = mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        auto: true,
    },
    name: String,
    imageUrl: String,
    region: Number,
    coordinates: [],
    description: String
})

module.exports = mongoose.model('Location', schema)
