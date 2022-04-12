module.exports = (app) => {
  const userController = require('../controllers/user.controller.js')

  app.get('/api/hello', userController.hello)
}
