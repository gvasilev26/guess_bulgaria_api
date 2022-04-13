module.exports = (app) => {
  const locationController = require('../controllers/location.controller')

  app.get('/api/locations', locationController.getLocations)
}
