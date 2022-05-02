const mongoose = require('mongoose')
const config = require('../configs/config')
const Location = require('../models/location.model');

(async () => {
    mongoose.Promise = global.Promise
    mongoose.connect(config.mongodbUrl).then(() => {
        console.log('Successfully connected to the database')
    }).catch(err => {
        console.log('Could not connect to the database. Exiting now...', err)
        process.exit()
    })
    let locations = await Location.find({}, {name: 1, _id: 1, image: 1}).exec();
    let step = 1000
    for (let location of locations) {
        setTimeout(async () => {
            let img = location.image.split(',');
            img.shift();
            await Location.updateOne({_id: location._id}, {$set: {image: img.join()}}).exec();
            console.log("SAVED ", location.name)
        }, step)
        step += 1000
    }
})()
