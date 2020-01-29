const ORDER_SIDE = {
  ALL: 'all',
  BUY: 'buy',
  SELL: 'sell'
}

const ORDER_TYPE = {
  ALL: 0,
  LIMIT: 1,
  MARKET: 2,
  COMPLETED: 2,
  CANCELED: 3
}

const RETURN_STATUS = {
  SUCCESS: 100,
  ADD: 101,
  UPDATE: 102,
  REMOVE: 103,
  ADD_REMOVE: 104,
  UPDATE_REMOVE: 105,
  ERROR: 200,
}

const SORT_FIELD = {
  DATE: 'Date',
  TYPE: 'Type',
  PRICE: 'Price',
  AMOUNT: 'Amount',
  EXECUTED: 'Executed',
  TOTAL: 'Total'
}

module.exports = { ORDER_SIDE, ORDER_TYPE, SORT_TYPE, STATUS_TYPE, SORT_FIELD, RETURN_STATUS };