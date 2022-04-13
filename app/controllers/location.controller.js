const Location = require('../models/location.model')

exports.getLocations = async (req, res) => {
    let locations = await Location.find().exec()
    return res.status(200).send(locations)
}
