const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../../database/index.js');
const orderStatusHelper = require('./helpers/order-status-helper.js');
const { authentication } = require('../middlewares');
const socket = require('../../../../processes/utilities/socket-io.js');
const moment = require('moment');
const _ = require('lodash');

var menuData, printerData, staffData;

(async () => {
  menuData = await db.knex('menu_items').then();
  printerData = await db.knex('printers').then();
  staffData = await db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').then();
})();

router.get('/', authentication, (req, res) => {
  db.knex('order_status').select('*').then(data => res.send(data))
  .catch(e => res.status(400).send(e));
})

// TODO: Redefine SQL JOIN DONE
router.get('/get-cooking-order/:outlet', async (req, res) => {
  //OLD SQL
  // db.knex.raw(`SELECT ior.id, cst.table_number, iot.from_table, mi.name, stf.short_name, ior.quantity, max_status.status, max_status.timestamp
  // FROM item_orders ior
  // LEFT JOIN customer_tables cst ON ior.customer_table_id = cst.id
  // LEFT JOIN menu_items mi ON ior.item_code = mi.code
  // LEFT JOIN printers pt ON mi.printer = pt.id
  // LEFT JOIN item_order_transfer iot ON iot.item_order_id = ior.id
  // LEFT JOIN staffs stf ON ior.create_by = stf.id
  // LEFT JOIN (
  // SELECT ios.* FROM item_order_status ios,
  // (SELECT item_order_id, MAX(timestamp) AS timestamp
  // FROM item_order_status
  // WHERE status != 'cancel'
  // GROUP BY item_order_id) max
  // WHERE max.item_order_id = ios.item_order_id
  // AND max.timestamp = ios.timestamp
  // ) max_status ON max_status.item_order_id = ior.id
  // WHERE ior.quantity != 0 and max_status.status != 'complete' AND pt.name = ?`, [req.params.outlet]).then((responseData) => {
  //   res.json(responseData[0]);
  // }).catch(e => {
  //   console.log(e);
  //   res.status(404);
  // })

  var itemOrderData = await db.knex('item_orders').whereNot('quantity', 0).then();
  var maxTimeData = await db.knex.raw(`SELECT ios.* FROM item_order_status ios,
  (SELECT item_order_id, MAX(timestamp) AS timestamp
  FROM item_order_status
  GROUP BY item_order_id) max
  WHERE max.item_order_id = ios.item_order_id
  AND max.timestamp = ios.timestamp`);
  var cstData = await db.knex('customer_tables').then();
  var iotData = await db.knex('item_order_transfer').then();


  var joinedData = itemOrderData.map((order, index) => {
    let maxTime = maxTimeData[0].find(o => o.item_order_id === order.id) || _.mapValues(maxTimeData[0][0], () => null);
    let filteredMaxTime = {timestamp: maxTime.timestamp, status: maxTime.status}
    return Object.assign({}, order, maxTime)
  }).map((order, index) => {
    let menuItem = menuData.find(o => parseInt(o.code) === order.item_code);
    let filteredMenu = { name: menuItem.name, printer: menuItem.printer}
    return Object.assign({}, order, filteredMenu)
  }).map((order, index) => {
    let printer = printerData.find(o => o.id === order.printer)
    let filteredPrinter = {printerName: printer.name}
    return Object.assign({}, order, filteredPrinter)
  }).map((order, index) => {
    let cst = cstData.find(o => o.id === order.customer_table_id) || _.mapValues(cstData[0], () => null)
    let filteredCst = {table_number: cst.table_number}
    return Object.assign({}, order, filteredCst)
  })
  .map((order, index) => {
    let iot = iotData.find(o => o.item_order_id === order.id) || _.mapValues(iotData[0], () => null)
    let filteredIot = {from_table: iot.from_table}
    return Object.assign({}, order, filteredIot)
  })
  .map((order, index) => {
    let staff = staffData.find(o => o.id === order.create_by) || _.mapValues(staffData[0], () => null)
    let filteredStaff = {short_name: staff.short_name}
    return Object.assign({}, order, filteredStaff)
  })
  // .map((order, index) => {
  //   let maxStatus = maxStatusData.find(o => o.item_order_id === order.id && o.timestamp === order.timestamp) || _.mapValues(maxStatusData[0], () => null)
  //   return Object.assign({}, order, maxStatus)
  // })
  var result = joinedData.filter(order => order.status !== 'complete' && order.status !== 'cancel' && order.printerName === req.params.outlet);
  // var result = joinedData.filter(order => order.table_number === null);

  res.json(result)


})


// TODO: Redefine SQL JOIN DONE
router.get('/get-complete-order/:outlet', async (req, res) => {
  //OLD SQL
  // db.knex.raw(`SELECT ior.id, cst.table_number, iot.from_table, mi.name, stf.short_name, ior.quantity, max_status.status, max_status.timestamp
  // FROM item_orders ior
  // LEFT JOIN customer_tables cst ON ior.customer_table_id = cst.id
  // LEFT JOIN menu_items mi ON ior.item_code = mi.code
  // LEFT JOIN printers pt ON mi.printer = pt.id
  // LEFT JOIN item_order_transfer iot ON iot.item_order_id = ior.id
  // LEFT JOIN staffs stf ON ior.create_by = stf.id
  // LEFT JOIN (
  // SELECT ios.* FROM item_order_status ios,
  // (SELECT item_order_id, MAX(timestamp) AS timestamp
  // FROM item_order_status
  // WHERE status != 'cancel'
  // GROUP BY item_order_id) max
  // WHERE max.item_order_id = ios.item_order_id
  // AND max.timestamp = ios.timestamp
  // ) max_status ON max_status.item_order_id = ior.id
  // WHERE ior.quantity != 0 and max_status.status = 'complete' AND pt.name = ? AND cst.status != 'paid' order by max_status.timestamp ASC`, [req.params.outlet]).then((responseData) => {
  //   res.json(responseData[0]);
  // }).catch(e => {
  //   console.log(e);
  //   res.status(404);
  // })

  var itemOrderData = await db.knex('item_orders').whereNot('quantity', 0).then();
  var maxTimeData = await db.knex.raw(`SELECT ios.* FROM item_order_status ios,
  (SELECT item_order_id, MAX(timestamp) AS timestamp
  FROM item_order_status
  GROUP BY item_order_id) max
  WHERE max.item_order_id = ios.item_order_id
  AND max.timestamp = ios.timestamp`);
  var cstData = await db.knex('customer_tables').then();
  var iotData = await db.knex('item_order_transfer').then();


  var joinedData = itemOrderData.map((order, index) => {
    let maxTime = maxTimeData[0].find(o => o.item_order_id === order.id) || _.mapValues(maxTimeData[0][0], () => null);
    let filteredMaxTime = {timestamp: maxTime.timestamp, status: maxTime.status}
    return Object.assign({}, order, maxTime)
  }).map((order, index) => {
    let menuItem = menuData.find(o => parseInt(o.code) === order.item_code);
    let filteredMenu = { name: menuItem.name, printer: menuItem.printer}
    return Object.assign({}, order, filteredMenu)
  }).map((order, index) => {
    let printer = printerData.find(o => o.id === order.printer)
    let filteredPrinter = {printerName: printer.name}
    return Object.assign({}, order, filteredPrinter)
  }).map((order, index) => {
    let cst = cstData.find(o => o.id === order.customer_table_id) || _.mapValues(cstData[0], () => null)
    let filteredCst = {table_number: cst.table_number, cstStatus: cst.status}
    return Object.assign({}, order, filteredCst)
  })
  .map((order, index) => {
    let iot = iotData.find(o => o.item_order_id === order.id) || _.mapValues(iotData[0], () => null)
    let filteredIot = {from_table: iot.from_table}
    return Object.assign({}, order, filteredIot)
  })
  .map((order, index) => {
    let staff = staffData.find(o => o.id === order.create_by) || _.mapValues(staffData[0], () => null)
    let filteredStaff = {short_name: staff.short_name}
    return Object.assign({}, order, filteredStaff)
  })

  var result = joinedData.filter(order => order.status === 'complete' && order.status !== 'cancel' && order.cstStatus !== 'paid' && order.cstStatus !== null  && order.printerName === req.params.outlet);


  res.json(result)
})

router.get('/:id', authentication, async (req, res) => {
  const orderStatus = await db.knex('order_status').where('item_order_id', '=', req.params.id)
  .then().catch(e => res.status(400).send(e));
  if(orderStatus.length == 0){
    res.status(404).json({msg: `Item order status is not found with id ${req.params.id}`});
  }else{
    res.json(orderStatus[0]);
  }
})

router.post('/add', authentication, async (req, res) => {
  const orderStatusObject = createOrderStatusObject(req.body);
  if(!orderStatusObject.status || !orderStatusObject.item_order_id ||
  !orderStatusObject.create_by){
    res.status(400).json({msg: `Please include the property 'status'`});
  }else{
    await orderStatusHelper.createItemOrderStatus(orderStatusObject.item_order_id, 'complete', orderStatusObject.create_by, null, parseInt(req.body.quantity));
    res.json({msg: 'Succesfully'});
    socket.clientUpdateOrders();
  }
})

router.put('/update', authentication, (req, res) => {
  const orderStatusObject = createOrderStatusObject(req.body);
  if(!orderStatusObject.status){
    res.status(400).json({msg: `Please include the property 'status'`});
  }else{
    db.knex('order_status').where('id', '=', orderStatusObject.id)
    .update(orderStatusObject)
    .then(data => {
      if(data == 0){
        res.status(404).json({msg: `Item status is not found with id ${orderStatusObject.id}`})
      }else{
        res.json({msg: `Successfully updated item status`})
      }
    })
    .catch(e => res.status(400).send(e))
  }
})

router.post('/delete-complete', authentication, (req, res) => {
  db.knex('item_order_status').where({item_order_id:req.body.id, status: 'complete'}).del()
  .then(data => {
    res.json({msg: `Successfully deleted order status`});
    socket.clientUpdateOrders();
  })
  .catch(e => res.status(400).send(e))
});

const createOrderStatusObject = body => {
  return {
    item_order_id: body.item_order_id,
    status: body.status,
    create_by: body.create_by,
    detail: body.detail || null,
    timestamp: new Date()
  }
}

module.exports = router;
