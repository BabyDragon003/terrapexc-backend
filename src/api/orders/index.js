const express = require('express');
const router = express.Router();
const orders = require("./controller");

router.get('/get_order_history', orders.getOrderHistory);
router.post('/revert_order', orders.revertOrders);
router.post('/confirm_order', orders.confirmOrders);
router.post('/match_limit_order', orders.matchLimitOrder);
router.post('/match_market_order', orders.matchMarketOrder);
router.post('/estimate_market_price_from', orders.estimateMarketPrice_from);
router.post('/estimate_market_price_to', orders.estimateMarketPrice_to);
router.post('/get_orderBook', orders.getOrderBook);
router.post('/get_topOrder', orders.getTopOrder);
router.post('/get_recentOrders', orders.getRecentOrders);
router.put('/update_cancel', orders.updateCancel);

module.exports = router;