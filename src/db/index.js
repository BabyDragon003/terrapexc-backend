const dbConfig = require('../utils/config');
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;
db.Orders = require("./orders.model")(mongoose);

module.exports = db;
