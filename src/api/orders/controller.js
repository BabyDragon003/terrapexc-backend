const db = require("../../db");
const { ORDER_SIDE, SORT_TYPE, SORT_FIELD, STATUS_TYPE, RETURN_STATUS } = require("../../utils/constants");
const Orders = db.Orders;

const revertRemoveOrders = async (remove_orders) => {
  for (var i = 0; i < remove_orders.length; i++) {
    var remove_order = remove_orders[i];
    const data = await Orders.findById(remove_order._id);
    if (data) {
      data.current_stock_amount = remove_order.current_stock_amount;
      await data.save();
    }
  }
}

exports.revertOrders = async (req, res) => {
  try {
    var status = req.body.status;
    var add_order = req.body.add_order;
    var update_match_order = req.body.update_match_order;
    var remove_match_orders = req.body.remove_match_orders ?? [];
    var log_order = req.body.log_order;
    if (status == RETURN_STATUS.ADD || status == RETURN_STATUS.ADD_REMOVE) {
      const data = await Orders.findByIdAndRemove(add_order._id);
      if (!data) {
        return res.send({ code: 0, message: "revert add fail" });
      }
    }

    if (
      status == RETURN_STATUS.UPDATE ||
      status == RETURN_STATUS.UPDATE_REMOVE
    ) {
      const data = await Orders.findById(update_match_order._id);
      if (!data) {
        return res.send({ code: 0, message: "revert update fail" });
      } else {
        data.current_stock_amount += update_match_order.current_stock_amount;
        await data.save();
      }
    }

    if (
      status == RETURN_STATUS.REMOVE ||
      status == RETURN_STATUS.ADD_REMOVE ||
      status == RETURN_STATUS.UPDATE_REMOVE
    ) {
      for (var i = 0; i < remove_match_orders.length; i++) {
        var remove_order = remove_match_orders[i];
        const data = await Orders.findById(remove_order._id);
        if (!data) {
          return res.send({ code: 0, message: "revert remove fail" });
        } else {
          data.current_stock_amount = remove_order.current_stock_amount;
          await data.save();
        }
      }
    }

    if (status == RETURN_STATUS.UPDATE || status == RETURN_STATUS.REMOVE || status == RETURN_STATUS.UPDATE_REMOVE) {
      const data = await Orders.findByIdAndRemove(log_order._id);
      if (!data) {
        return res.send({ code: 0, message: "revert add fail" });
      }
    }

    return res.send({ code: 1, message: "revert success" });
  } catch (err) {
    return res.send({ code: 0, message: err });
  }
};

exports.confirmOrders = async (req, res) => {
  try {
    var status = req.body.status;
    var add_order = req.body.add_order;
    var update_match_order = req.body.update_match_order;
    var remove_match_orders = req.body.remove_match_orders ?? [];
    var log_order = req.body.log_order;
    if (status == RETURN_STATUS.ADD || status == RETURN_STATUS.ADD_REMOVE) {
      const data = await Orders.findByIdAndUpdate(add_order._id, {$set: { is_confirmed: 'true'}});
      if (!data) {
        return res.send({ code: 0, message: "confirm add fail" });
      }
    }

    if (
      status == RETURN_STATUS.UPDATE ||
      status == RETURN_STATUS.UPDATE_REMOVE
    ) {
      const data = await Orders.findByIdAndUpdate(update_match_order._id, {$set: { is_confirmed: 'true'}});
      if (!data) {
        return res.send({ code: 0, message: "confirm update fail" });
      }
    }

    if (
      status == RETURN_STATUS.REMOVE ||
      status == RETURN_STATUS.ADD_REMOVE ||
      status == RETURN_STATUS.UPDATE_REMOVE
    ) {
      for (var i = 0; i < remove_match_orders.length; i++) {
        var remove_order = remove_match_orders[i];
        const data = await Orders.findByIdAndUpdate(remove_order._id, {$set: { is_confirmed: 'true'}});
        if (!data) {
          return res.send({ code: 0, message: "confirm remove fail" });
        }
      }
    }

    if (status == RETURN_STATUS.UPDATE || status == RETURN_STATUS.REMOVE || status == RETURN_STATUS.UPDATE_REMOVE) {
      const data = await Orders.findByIdAndUpdate(log_order._id, {$set: { is_confirmed: 'true'}});
        if (!data) {
        return res.send({ code: 0, message: "confirm log fail" });
      }
    }

    return res.send({ code: 1, message: "confirm success" });
  } catch (err) {
    return res.send({ code: 0, message: err });
  }
};

exports.matchLimitOrder = async (req, res) => {
  var address = req.body.address;
  var pair_id = req.body.pair_id;
  var order_stock_amount = req.body.order_stock_amount;
  var current_stock_amount = req.body.current_stock_amount;
  var price = req.body.price;
  var is_buy = JSON.parse(req.body.is_buy);
  var type = req.body.type;

  if (!req.match_order) req.match_order = [];

  Orders.findOne({
    pair_id: pair_id,
    price: price,
    is_buy: !is_buy,
    current_stock_amount: { $ne: 0 },
    is_canceled: false,
    is_confirmed: true,
  })
    .then((data) => {
      if (!data) {
        // only add new order
        const order = new Orders({
          address: req.body.address,
          pair_id: req.body.pair_id,
          order_stock_amount: req.body.order_stock_amount,
          current_stock_amount: req.body.current_stock_amount,
          price: req.body.price,
          is_buy: req.body.is_buy,
          type: req.body.type,
        });

        order
          .save()
          .then((add_data) => {
            if (req.match_order?.length > 0) {
              return res.send({
                status: RETURN_STATUS.ADD_REMOVE,
                add_order: add_data,
                remove_match_orders: req.match_order,
              });
            } else {
              return res.send({
                status: RETURN_STATUS.ADD,
                add_order: add_data,
              });
            }
          })
          .catch((err) => {
            if (req.match_order?.length > 0) {
              revertRemoveOrders(req.match_order);
            }
            return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of add new order!" });
          });
      } else {
        // find match order
        if (current_stock_amount > data.current_stock_amount) {
          // add updated new order and remove match order
          req.body.current_stock_amount -= data.current_stock_amount;
          let origin_current_amount = data.current_stock_amount;
          data.current_stock_amount = 0;
          data
            .save()
            .then(async (remove_data) => {
              if (!remove_data) {
                if (req.match_order?.length > 0) {
                  revertRemoveOrders(req.match_order);
                }
                return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
              } else {
                remove_data.current_stock_amount = origin_current_amount;
                req.match_order = [...req.match_order, remove_data];
                await exports.matchLimitOrder(req, res);
              }
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
            });
        } else if (current_stock_amount == data.current_stock_amount) {
          // add for log
          const order = new Orders({
            address: req.body.address,
            pair_id: req.body.pair_id,
            order_stock_amount: req.body.order_stock_amount,
            current_stock_amount: 0,
            price: req.body.price,
            is_buy: req.body.is_buy,
            type: req.body.type,
          });
          order
            .save()
            .then((log_data) => {
              // remove match order
              let origin_current_amount = data.current_stock_amount;
              data.current_stock_amount = 0;
              data
                .save()
                .then((remove_data) => {
                  if (!remove_data) {
                    if (req.match_order?.length > 0) {
                      revertRemoveOrders(req.match_order);
                    }
                    return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
                  } else {
                    remove_data.current_stock_amount = origin_current_amount;
                    req.match_order = [...req.match_order, remove_data];
                    return res.send({
                      status: RETURN_STATUS.REMOVE,
                      remove_match_orders: req.match_order,
                      log_order: log_data
                    });
                  }
                })
                .catch((err) => {
                  if (req.match_order?.length > 0) {
                    revertRemoveOrders(req.match_order);
                  }
                  return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
                });
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of save log order!" });
            });

        } else {
          // add for log
          const order = new Orders({
            address: req.body.address,
            pair_id: req.body.pair_id,
            order_stock_amount: req.body.order_stock_amount,
            current_stock_amount: 0,
            price: req.body.price,
            is_buy: req.body.is_buy,
            type: req.body.type,
          });
          order
            .save()
            .then((log_data) => {
              // update match order
              data.current_stock_amount -= current_stock_amount;
              data
                .save()
                .then((update_data) => {
                  if (!update_data) {
                    if (req.match_order?.length > 0) {
                      revertRemoveOrders(req.match_order);
                    }
                    return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of update matching order!" });
                  } else {
                    update_data.current_stock_amount = current_stock_amount; // set change_amount to current_amount
                    if (req.match_order?.length > 0) {
                      return res.send({
                        status: RETURN_STATUS.UPDATE_REMOVE,
                        update_match_order: update_data,
                        remove_match_orders: req.match_order,
                        log_order: log_data
                      });
                    } else {
                      return res.send({
                        status: RETURN_STATUS.UPDATE,
                        update_match_order: update_data,
                        log_order: log_data
                      });
                    }
                  }
                })
                .catch((err) => {
                  if (req.match_order?.length > 0) {
                    revertRemoveOrders(req.match_order);
                  }
                  return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of update matching order!" });
                });
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of save log order!" });
            });
        }
      }
    })
    .catch((err) => {
      if (req.match_order?.length > 0) {
        revertRemoveOrders(req.match_order);
      }
      return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of find matching order!" });
    });
};

exports.matchMarketOrder = async (req, res) => {
  var address = req.body.address;
  var pair_id = req.body.pair_id;
  var order_stock_amount = req.body.order_stock_amount;
  var current_stock_amount = req.body.current_stock_amount;
  var price = req.body.price;
  var is_buy = JSON.parse(req.body.is_buy);
  var type = req.body.type;

  if (!req.match_order) req.match_order = [];
  var sortDirection = is_buy ? 1 : -1;

  Orders.findOne({
    pair_id: pair_id,
    is_buy: !is_buy,
    current_stock_amount: { $ne: 0 },
    is_canceled: false,
    is_confirmed: true,
  })
    .sort({ price: sortDirection })
    .then((data) => {
      if (!data) {
        if (req.match_order?.length > 0) {
          revertRemoveOrders(req.match_order);
        }
        return res.send({ status: RETURN_STATUS.ERROR, message: "No matching order!" });
      } else {
        // find match order
        if (current_stock_amount > data.current_stock_amount) {
          // add updated new order and remove match order
          req.body.current_stock_amount -= data.current_stock_amount;
          let origin_current_amount = data.current_stock_amount;
          data.current_stock_amount = 0;
          data
            .save()
            .then(async (remove_data) => {
              if (!remove_data) {
                if (req.match_order?.length > 0) {
                  revertRemoveOrders(req.match_order);
                }
                return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
              } else {
                remove_data.current_stock_amount = origin_current_amount;
                req.match_order = [...req.match_order, remove_data];
                await exports.matchMarketOrder(req, res);
              }
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
            });
        } else if (current_stock_amount == data.current_stock_amount) {
          // add for log
          const order = new Orders({
            address: req.body.address,
            pair_id: req.body.pair_id,
            order_stock_amount: req.body.order_stock_amount,
            current_stock_amount: 0,
            price: req.body.price,
            is_buy: req.body.is_buy,
            type: req.body.type,
          });
          order
            .save()
            .then((log_data) => {
              // remove match order
              let origin_current_amount = data.current_stock_amount;
              data.current_stock_amount = 0;
              data
                .save()
                .then((remove_data) => {
                  if (!remove_data) {
                    if (req.match_order?.length > 0) {
                      revertRemoveOrders(req.match_order);
                    }
                    return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
                  } else {
                    remove_data.current_stock_amount = origin_current_amount;
                    req.match_order = [...req.match_order, remove_data];
                    return res.send({
                      status: RETURN_STATUS.REMOVE,
                      remove_match_orders: req.match_order,
                      log_order: log_data
                    });
                  }
                })
                .catch((err) => {
                  if (req.match_order?.length > 0) {
                    revertRemoveOrders(req.match_order);
                  }
                  return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of remove matching order!" });
                });
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of save log order!" });
            });

        } else {
          // add for log
          const order = new Orders({
            address: req.body.address,
            pair_id: req.body.pair_id,
            order_stock_amount: req.body.order_stock_amount,
            current_stock_amount: 0,
            price: req.body.price,
            is_buy: req.body.is_buy,
            type: req.body.type,
          });
          order
            .save()
            .then((log_data) => {
              // update match order
              data.current_stock_amount -= current_stock_amount;
              data
                .save()
                .then((update_data) => {
                  if (!update_data) {
                    if (req.match_order?.length > 0) {
                      revertRemoveOrders(req.match_order);
                    }
                    return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of update matching order!" });
                  } else {
                    update_data.current_stock_amount = current_stock_amount; // set change_amount to current_amount
                    if (req.match_order?.length > 0) {
                      return res.send({
                        status: RETURN_STATUS.UPDATE_REMOVE,
                        update_match_order: update_data,
                        remove_match_orders: req.match_order,
                        log_order: log_data
                      });
                    } else {
                      return res.send({
                        status: RETURN_STATUS.UPDATE,
                        update_match_order: update_data,
                        log_order: log_data
                      });
                    }
                  }
                })
                .catch((err) => {
                  if (req.match_order?.length > 0) {
                    revertRemoveOrders(req.match_order);
                  }
                  return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of update matching order!" });
                });
            })
            .catch((err) => {
              if (req.match_order?.length > 0) {
                revertRemoveOrders(req.match_order);
              }
              return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of save log order!" });
            });
        }
      }
    })
    .catch((err) => {
      if (req.match_order?.length > 0) {
        revertRemoveOrders(req.match_order);
      }
      return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of find matching order!" });
    });
};

exports.estimateMarketPrice_to = async (req, res) => {
  var pair_id = req.body.pair_id;
  var current_stock_amount = req.body.current_stock_amount;
  var is_buy = JSON.parse(req.body.is_buy);

  if (!req.match_order) req.match_order = [];
  var sortDirection = is_buy ? 1 : -1;
  var marketPrice = 0;

  Orders.findOne({
    pair_id: pair_id,
    is_buy: !is_buy,
    current_stock_amount: { $ne: 0 },
    is_canceled: false,
    is_confirmed: true,
  })
    .sort({ price: sortDirection })
    .then(async (data) => {
      if (!data) {
        return res.send({ status: RETURN_STATUS.ERROR, message: "No matching order!" });
      } else {
        // find match order
        if (current_stock_amount > data.current_stock_amount) {
          // add updated new order and remove match order
          req.body.current_stock_amount -= data.current_stock_amount;
          req.match_order = [...req.match_order, data];
          await exports.estimateMarketPrice_to(req, res);
        } else {
          if (current_stock_amount == data.current_stock_amount) {
            req.match_order = [...req.match_order, data];
          } else {
            data.current_stock_amount = current_stock_amount;
            req.match_order = [...req.match_order, data];
          }

          var totalAmount = 0;
          var totalPrice = 0;
          if (req.match_order?.length > 0) {
            for (var i = 0; i < req.match_order.length; i++) {
              var match_order = req.match_order[i];
              totalAmount += match_order.current_stock_amount;
              totalPrice += match_order.current_stock_amount * match_order.price;
            }
          }
          if (totalAmount !== 0) {
            marketPrice = totalPrice / totalAmount;
          }
          return res.send({ status: RETURN_STATUS.SUCCESS, market_price: marketPrice });
        }
      }
    })
    .catch((err) => {
      return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of find matching order!" });
    });
};

exports.estimateMarketPrice_from = async (req, res) => {
  var pair_id = req.body.pair_id;
  var current_stock_total = req.body.current_stock_total;
  var is_buy = JSON.parse(req.body.is_buy);

  if (!req.match_order) req.match_order = [];
  var sortDirection = is_buy ? 1 : -1;
  var marketPrice = 0;

  Orders.findOne({
    pair_id: pair_id,
    is_buy: !is_buy,
    current_stock_amount: { $ne: 0 },
    is_canceled: false,
    is_confirmed: true,
  })
    .sort({ price: sortDirection })
    .then(async (data) => {
      if (!data) {
        return res.send({ status: RETURN_STATUS.ERROR, message: "No matching order!" });
      } else {
        // find match order
        if (current_stock_total > data.current_stock_amount * data.price) {
          // add updated new order and remove match order
          req.body.current_stock_total -= data.current_stock_amount * data.price;
          req.match_order = [...req.match_order, data];
          await exports.estimateMarketPrice_from(req, res);
        } else {
          if (current_stock_total == data.current_stock_amount * data.price) {
            req.match_order = [...req.match_order, data];
          } else {
            data.current_stock_amount = current_stock_total / data.price;
            req.match_order = [...req.match_order, data];
          }

          var totalAmount = 0;
          var totalPrice = 0;
          if (req.match_order?.length > 0) {
            for (var i = 0; i < req.match_order.length; i++) {
              var match_order = req.match_order[i];
              totalAmount += match_order.current_stock_amount;
              totalPrice += match_order.current_stock_amount * match_order.price;
            }
          }
          if (totalAmount !== 0) {
            marketPrice = totalPrice / totalAmount;
          }
          return res.send({ status: RETURN_STATUS.SUCCESS, market_price: marketPrice });
        }
      }
    })
    .catch((err) => {
      return res.send({ status: RETURN_STATUS.ERROR, message: "Fail of find matching order!" });
    });
};

exports.getOrderBook = (req, res) => {
  var pair_id = req.body.pair_id;
  var is_buy = req.body.is_buy;
  var type = req.body.type;
  var start = req.body.start ?? 0;
  var limit = req.body.limit ?? 0;

  Orders.aggregate([
    {
      $match: {
        pair_id: pair_id,
        is_buy: is_buy,
        type: type,
        current_stock_amount: { $ne: 0 },
        is_canceled: false,
        is_confirmed: true,
      },
    },
    {
      $group: {
        _id: { price: "$price" },
        total: { $sum: "$current_stock_amount" },
      },
    },
    { $sort: { "_id.price": -1 } }, // 1: ascending, -1: descending
    { $skip: start },
    { $limit: limit },
  ]).exec(function (err, result) {
    if (err) {
      console.log(err);
      return res.send({ status: 200, message: err.message });
    } else {
      return res.send({ status: 100, order_list: result });
    }
  });
};

exports.getTopOrder = (req, res) => {
  var pair_id = req.body.pair_id;
  var is_buy = req.body.is_buy;
  var type = req.body.type;

  Orders.aggregate([
    {
      $match: {
        pair_id: pair_id,
        is_buy: is_buy,
        type: type,
        current_stock_amount: { $ne: 0 },
        is_canceled: false,
        is_confirmed: true,
      },
    },
    {
      $group: {
        _id: { price: "$price" },
        total: { $sum: "$current_stock_amount" },
      },
    },
    { $sort: { total: -1 } }, // 1: ascending, -1: descending
    { $limit: 1 },
  ]).exec(function (err, result) {
    if (err) {
      console.log(err);
      return res.send({ status: 200, message: err.message });
    } else {
      return res.send({ status: 100, top_order: result.length == 0 ? 0 : result[0].total });
    }
  });
};

exports.getRecentOrders = (req, res) => {
  var pair_id = req.body.pair_id;
  var type = req.body.type;
  var start = req.body.start ?? 0;
  var limit = req.body.limit ?? 0;

  Orders.find({
    pair_id: pair_id,
    type: type,
    current_stock_amount: { $ne: 0 },
    is_canceled: false,
    is_confirmed: true,
  })
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(limit)
    .then((data) => {
      return res.send({ status: 100, data: data });
    })
    .catch((err) => {
      return res.send({ status: 200, message: err.message });
    });
};

exports.getOrderHistory = (req, res) => {
  const address = req.query.address;
  const isBuy = req.query.is_buy;
  const isOpen = Number(req.query.is_open);
  const field = req.query.field;
  const type = req.query.type;
  const status = Number(req.query.status);
  var start = req.query.start;
  var last = req.query.last;

  if (!address) {
    return res.send({ status: 200, message: 'connect wallet' });
  }

  let isBuyMsg = undefined;
  let sortMsg = undefined;
  let isOpenMsg = undefined;
  let statusMsg = undefined;

  if (isBuy === ORDER_SIDE.BUY) {
    isBuyMsg = { $match: { "is_buy": true } };
  } else if (isBuy === ORDER_SIDE.SELL) {
    isBuyMsg = { $match: { "is_buy": false } };
  }

  switch (field) {
    case SORT_FIELD.DATE:
      sortMsg = { $sort: { "createdAt": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    case SORT_FIELD.TYPE:
      sortMsg = { $sort: { "type": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    case SORT_FIELD.PRICE:
      sortMsg = { $sort: { "price": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    case SORT_FIELD.AMOUNT:
      sortMsg = { $sort: { "order_stock_amount": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    case SORT_FIELD.EXECUTED:
      sortMsg = { $sort: { "executed_amount": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    case SORT_FIELD.TOTAL:
      sortMsg = { $sort: { "total_amount": type == SORT_TYPE.ASC ? 1 : -1 } };
      break;
    default:
      sortMsg = { $sort: { "createdAt": -1 } };
      break;
  }

  switch (status) {
    case STATUS_TYPE.ALL:
      break;
    case STATUS_TYPE.OPEN:
      statusMsg = { $match: { "current_stock_amount": { $gt: 0 }, "is_canceled": false } };
      break;
    case STATUS_TYPE.COMPLETED:
      statusMsg = { $match: { "current_stock_amount": 0, "is_canceled": false } };
      break;
    case STATUS_TYPE.CANCELED:
      statusMsg = { $match: { "is_canceled": true } };
      break;
    default:
      statusMsg = { $match: { "is_canceled": false } };
      break;
  }

  if (isOpen) {
    isOpenMsg = { $match: { "current_stock_amount": { $gt: 0 } } };
  }

  let args = [];
  args.push({
    $match: {
      address
    }
  })
  args.push({
    $match: {
      "is_confirmed": true
    }
  })
  args.push({
    $addFields: {
      executed_amount: { $subtract: ["$order_stock_amount", "$current_stock_amount"] }
    }
  })
  args.push({
    $addFields: {
      total_amount: { $multiply: ["$price", "$executed_amount"] }
    }
  })
  if (isBuyMsg) args.push(isBuyMsg);
  if (sortMsg) args.push(sortMsg);
  if (isOpenMsg) args.push(isOpenMsg);
  if (statusMsg) args.push(statusMsg);
  args.push(
    {
      $skip: Number(start),
    }
  )
  args.push(
    {
      $limit: Number(last) - Number(start),
    }
  )
  Orders.aggregate(args).then((data) => {
    return res.send({ status: 100, list: data });
  })
    .catch((error) => {
      return res.send({ status: 200, message: error });
    });
}

exports.updateCancel = async (req, res) => {
  const id = req.body.id;
  const address = req.body.address;
  const isCancel = Number(req.body.isCancel);

  try {
    const data = await Orders.findById(id);
    if (!data) {
      return res.send({ status: 200, message: "update cancel fail" });
    } else {
      if (data.address != address) {
        return res.send({ status: 200, message: "not owner" });
      }
      data.is_canceled = isCancel === 1 ? true : false;
      await data.save();
      return res.send({ status: 100 });
    }
  } catch (error) {
    console.log(error);
    return res.send({ status: 200, message: error });
  }
}