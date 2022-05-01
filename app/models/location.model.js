const mongoose = require('mongoose')

const schema = mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        auto: true,
    },
    name: String,
    image: String,
    region: Number,
    coordinates: [Number],
    description: String
})

module.exports = mongoose.model('Location', schema)
