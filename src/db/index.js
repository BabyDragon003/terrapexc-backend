const dbConfig = require('../utils/config');
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
