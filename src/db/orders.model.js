const { ORDER_TYPE } = require('../utils/constants');

module.exports = (mongoose) => {
    const Order = mongoose.model(
        "Order",
        mongoose.Schema(
            {
                address: String,
                pair_id: Number,
                order_stock_amount: Number,
                current_stock_amount: Number,
                price: Number,
                is_buy: Boolean,
                is_canceled: {
                    type: Boolean,
                    default: false
                },
                type: {
                    type: Number,
                    enum: ORDER_TYPE,
                    default: ORDER_TYPE.LIMIT
                },
                is_confirmed: {
                    type: Boolean,
                    default: false
                }
            },
            { timestamps: true }
        )
    );
    return Order;
};
