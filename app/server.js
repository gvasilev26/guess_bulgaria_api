const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json({ limit: '10mb' }))

app.use(bodyParser.json())

require('./routes/access.routes')(app)

const config = require('./config/config.js')
app.listen(config.port, () => {
  console.log(`Server is listening on port ${config.port}`)
})
