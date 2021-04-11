const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const db = require('../../../../database/index.js');
const printer = require('../../../../processes/utilities/printer.js');
const orderHelper = require('./helpers/order-status-helper.js');
const socket = require('../../../../processes/utilities/socket-io.js');
const { authentication } = require('../middlewares');
const _ = require('lodash');
const moment = require('moment')

router.get('/:id', authentication, async (req, res) =>{
  var customer_table_id = req.params.id;
  const outlet = await db.knex.select('tables.outlet').from('customer_tables').leftJoin('tables', 'tables.number', 'customer_tables.table_number').where({id: customer_table_id}).then();
  var priceType = outlet[0].outlet === 'staff' ? 'staff_price' : 'price';

  var itemOrderData = await db.knex.raw(`SELECT * FROM item_orders WHERE customer_table_id = ? AND quantity != 0 GROUP BY id`, [customer_table_id]).then();
  var menuData = await db.knex('menu_items').then();
  var statusData = await db.knex('item_order_status').whereNot('status', 'cancel').then();
  var maxTimeData = statusData.reduce((total, record) => {
    let existed = total.find(o => o.item_order_id === record.item_order_id);
    if(existed){
      if(existed.timestamp.getTime() < record.timestamp.getTime()){
        let newTotal = total.filter(x => x.item_order_id !== record.item_order_id);

        return newTotal.concat(record);
      }else{
          return total;
      }
    }else{
      return total.concat(record);
    }
  }, [])

  var sentIosData = await db.knex('item_order_status').where('status','sent').then();
  var staffData = await db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').then();

  var result = itemOrderData[0].map((order, index) => {
    let menu = menuData.find(o => parseInt(o.code) === order.item_code) || _.mapValues(menuData[0], () => null);
    let filteredMenu = {name: menu.name, english_name: menu.english_name, price: menu[priceType]}
    return Object.assign({}, order, filteredMenu);
  }).map((order, index) => {
    let maxTime = maxTimeData.find(o => o.item_order_id === order.id) || _.mapValues(maxTimeData[0], () => null);
    let filteredMaxTime = {status: maxTime.status, status_updateAt: maxTime.timestamp, updateById: maxTime.create_by}
    return Object.assign({}, order, filteredMaxTime);
  }).map((order, index) => {
    let sentIos = sentIosData.find(o => o.item_order_id === order.id) || _.mapValues(sentIosData[0], () => null);
    let filteredSentIos = {createAt: sentIos.timestamp, createById: sentIos.create_by}
    return Object.assign({}, order, filteredSentIos);
  }).map((order, index) => {
    let sentStaff = staffData.find(o => o.id === order.createById) ||  _.mapValues(staffData[0], () => null);
    let filteredSentStaff = {createBy: sentStaff.short_name}
    return Object.assign({}, order, filteredSentStaff);
  }).map((order, index) => {
    let staff = staffData.find(o => o.id === order.updateById) ||  _.mapValues(staffData[0], () => null);
    let filteredStaff = {status_updateBy: staff.short_name}
    return Object.assign({}, order, filteredStaff);
  })

  res.json(result);

})

router.post('/getOnlineItemsByNumber', async (req, res) => {
  let items = await db.knex('online_order').where({number: req.body.number})
  res.json({items});
})

//Get new Order from customer
router.post('/add', authentication, async (req, res) => {

var items = JSON.parse(req.body.items);
var count = 1;
var error = false;
items.forEach((item) => {

  const itemOrderObject = createitemOrderObject({item_code: item.code, customer_table_id: req.body.tableId, quantity: item.quantity, remark: item.remark, create_by: req.body.userId});
  if(!itemOrderObject.customer_table_id || !itemOrderObject.item_code ||
    !itemOrderObject.quantity || !itemOrderObject.create_by){
      res.status(400).json({msg: `Please include all the parameters`})
      error = true;
    }else{
        db.knex('item_orders').insert(itemOrderObject)
        .then(async data => {
          //Set status for order as "Sent"
          await orderHelper.createItemOrderStatus(itemOrderObject.id, 'sent', itemOrderObject.create_by, item.remark, item.quantity);
          // Send itemOrderObject to Printer and Display on screen
          const outlet = await db.knex.select('tables.outlet').from('customer_tables').leftJoin('tables', 'tables.number', 'customer_tables.table_number').where({id: itemOrderObject.customer_table_id}).then();
          const orderInfo = await orderHelper.getOrderInfor(itemOrderObject, outlet[0].outlet);
          setTimeout(()=>{
            printer.printerNewItem(orderInfo)},1000*count);
          count++;
        }).catch(e => {
          console.log(e);
          error = true;
          res.status(400).send(e);
        })
    }
  })
  if(!error){
    await db.knex('customer_tables').where('id', req.body.tableId).update({status: 'opened'});
    socket.clientUpdateTables();
    res.json({msg: 'Succesfully add New item'});
  }
})

router.post('/daily-total-items', authentication, (req, res) => {
  db.knexBackup.raw(`SELECT mi.name, ior.item_code ,sum(quantity) as quantity, cat.name as category_name
    FROM item_orders ior
    LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
    LEFT JOIN shifts ON shifts.id = ct.shift_id
    LEFT JOIN menu_items mi ON mi.code = ior.item_code
    LEFT JOIN categories cat ON cat.id = mi.category_id
    WHERE shifts.detail = ?
    group by item_code`, [req.body.date]).then(response => {
      res.json(response[0])
    }).catch(e => {
      console.log(e)
      res.status(400);
    })
})

router.post('/cancel', authentication, (req, res) => {
  const { order_id, quantity, remark, create_by  } = req.body;
  if(!order_id || !quantity || !remark || !create_by || !Number.isInteger(quantity)){
    res.status(400).json({msg: `Please include all the parameters`})
  }else{
    db.knex('item_orders').where({id: order_id}).then((data) => {
      if(data.length !== 0){
        const customer_table_id = data[0].customer_table_id;
        const item_code = data[0].item_code;
        const order_create_by = data[0].create_by;
        if(data[0].quantity >= quantity){
          const remainQuantity = parseInt(data[0].quantity) - parseInt(quantity);
          const timestamp = new Date();
          orderHelper.createItemOrderStatus(order_id, 'cancel', create_by, remark, quantity, timestamp);
          db.knex('item_orders').update({quantity: remainQuantity}).where({id:order_id}).then(() => {
            //TODO: Send cancel order to printer
            db.knex.raw(`SELECT ct.table_number, stf.short_name, mi.name, mi.printer_ip_address
                        FROM
                        (SELECT table_number FROM customer_tables WHERE id = ?) ct,
                        (SELECT employees.short_name FROM staffs LEFT JOIN employees ON employees.id = staffs.id WHERE staffs.id = ?) stf,
                        (SELECT menu_items.name, printers.ip_address as printer_ip_address FROM menu_items
                          LEFT JOIN printers ON printers.id = menu_items.printer
                           WHERE code = ?) mi`,
                      [customer_table_id, create_by, item_code]).then((data) => {
                        printer.printerCancelItem({
                          table_number: data[0][0].table_number,
                          create_by: data[0][0].short_name,
                          timestamp,
                          quantity,
                          name: data[0][0].name,
                          remark,
                          printer_ip_address: data[0][0].printer_ip_address
                        });
                        db.knex('customer_tables').where({id: customer_table_id}).update({status: 'opened'}).then(() => {
                          res.json({msg: 'Succesfully cancel order.'});
                          })
                      })
          })
        }else{
          res.status(400).json({msg: `Quantity exceed remaining`});
          console.log(`Quantity exceed remaining`);
        }
      }else{
        console.log(`Cannot find order item`);
        res.status(400).json({msg: `Cannot find order item`});
      }
    }).catch(e => {
      console.log(e);
      res.status(400).json({error: e});
    })
  }
})


// {
//   const { order_id, quantity, remark, create_by  } = req.body;
//   if(!order_id || !quantity || !remark || !create_by || !Number.isInteger(quantity)){
//     res.status(400).json({msg: `Please include all the parameters`})
//     return
//   }
//
//   let order = await db.knex('item_orders').where({id: order_id});
//   if(order.length === 0){
//     res.status(400).json({msg: `ไม่พบรายการอาหารที่ต้องการยกเลิก`})
//     return
//   }else {
//     order = order[0]
//   }
//
//   const customer_table_id = order.customer_table_id;
//   const item_code = order.item_code;
//   const order_create_by = order.create_by;
//   if(order.quantity >= quantity){
//
//   } else {
//     res.status(400).json({msg: `Quantity exceed remaining`});
//     console.log(chalk.red(`${moment().format('kk:mm:ss')} ERROR CANCEL ORDER: Quantity exceed remaining`));
//   }
// }

router.get('/get-all-orders-status/:table_id', authentication, (req, res) => {
  db.knex.raw(`SELECT ios.status, emp.short_name, ios.detail, ios.timestamp, ios.quantity, menu_items.name, iof.from_table
                FROM item_orders
                LEFT JOIN item_order_status ios ON ios.item_order_id = item_orders.id
                LEFT JOIN staffs ON staffs.id = ios.create_by
                LEFT JOIN employees emp ON emp.id = staffs.id
                LEFT JOIN menu_items ON menu_items.code = item_orders.item_code
                LEFT JOIN item_order_transfer iof ON iof.item_order_id = item_orders.id
                WHERE item_orders.customer_table_id = ?`, [req.params.table_id]).then((rawData) => {
          res.json(rawData[0]);
    }).catch(e => {
      console.log(e);
      res.status(400).json({error: e});
    })
})


const createitemOrderObject = body => {
  return {
    id: uuid.v4(),
    item_code:parseInt (body.item_code),
    customer_table_id: body.customer_table_id,
    quantity: parseInt(body.quantity),
    remark: body.remark || null,
    create_by: body.create_by
  }
}

module.exports = router;
