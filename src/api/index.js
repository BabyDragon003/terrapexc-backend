const express = require('express');

const orders = require('./orders');
const router = express.Router();

router.use('/orders', orders);

module.exports = router;