module.exports = (app) => {
  const userController = require('../controllers/user.controller.js')

  app.get('/api/users', userController.createUser)

  app.get('/api/users/:id', userController.getUserStats)

  app.get('/api/users/:id/game/:points', userController.playGame)
}
