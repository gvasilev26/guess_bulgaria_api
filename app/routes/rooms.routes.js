module.exports = (app) => {
    const roomsController = require('../controllers/room.controller')
  
    app.get('/api/public-rooms', roomsController.getPublicRooms)
  }
  