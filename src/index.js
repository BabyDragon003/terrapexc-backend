const express = require("express");
const cors = require("cors");
const bodyParser = require('body-parser');
const http = require("http");
const db = require("./db");
const api = require("./api");
const app = express();

const port = process.env.PORT || 5000;

db.mongoose.set("strictQuery", false);
db.mongoose
    .connect(db.url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log("Connected to the database!");
    })
    .catch(err => {
        console.log("Cannot connect to the database!", err);
        process.exit();
    });


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));
app.use(express.static('public/build'));
app.use(cors());
app.use(express.json());
app.use("/api", api);

/* Port Listening In */
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Server is running in PORT ${port}`);
});

module.exports = app;
