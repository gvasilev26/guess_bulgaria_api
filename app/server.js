const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json({ limit: '10mb' }))

app.use(bodyParser.json())

require('./routes/access.routes')(app)

const config = require('./configs/config.js')
const server = app.listen(config.port, () => {
  console.log(`Server is listening on port ${config.port}`)
})

require('./ws/ws.server').startWebSocket(server);
