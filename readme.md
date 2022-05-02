# Routes
```
GET /api/users - create a new user
GET /api/users/:id - get user's stats
GET /api/users/:id/game/:points - add a game with winning :points to the user's single player stats
GET /api/locations - returns all locations
```

# Socket 
## Request message types
* create
* join
* leave
* change-settings
* start
* change-color
* answer
* next-round
* reconnect
* close-room
* room-privacy

## Response messages types
* player-join
* player-leave
* current-data
* make-creator
* settings-change
* player-answer
* color-change
* start-round
* end-round
* end-game
* close-room
* room-privacy-notifier

# .env
```dotenv
PORT=3000
MONGODB_URL=mongodb://localhost:27017/guess
```
