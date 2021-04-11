const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const moment = require('moment')

const db = require('../../../../database/index.js');
const ctHelper = require('./helpers/customer-table-helper.js');
const orderHelper = require('./helpers/order-status-helper.js');

const socket = require('../../../../processes/utilities/socket-io.js');
const printer = require('../../../../processes/utilities/printer.js');
const { authentication, isShiftActived } = require('../middlewares');

// Get all customer tables
router.get('/', authentication, (req, res) => {
  db.knex('customer_tables').then(data => res.json(data))
  .catch(e => {
    console.log(e);
    res.status(400).json({msg: `Somthing went wrong!`})
  })
})

router.get('/customer-table-status/:id', authentication, async (req, res) => {
  const status = await db.knex('customer_table_status')
  .where({customer_table_id: req.params.id}).then()
  .catch(e => {
    console.log(e);
    res.status(400).json({msg:`Somting went wrong!`});
  })
  if(status.length !== 0){
    res.json(status);
  }else{
    res.status(400).json({ msg: `No customer table with the id of ${req.params.id}` });
  }
})

router.get('/:id', authentication , (req, res) => {
  db.knex('customer_tables').where({id: req.params.id}).then((data) => {
    res.json(data[0]);
  }).catch(e => {
    console.log(e);
    res.status(400).json({msg: 'Something went wrong!'})
  })
})

router.get('/payment/:id', authentication, async (req, res) => {
  let customerTable = await db.knex('customer_tables').where({id: req.params.id})

  db.knex('payment').where({customer_table_id: req.params.id}).then((data) => {
    res.json({...data[0], roomDelivery: customerTable[0].roomDelivery});
  }).catch(e => {
    console.log(e);
    res.status(400).json({msg: 'Something went wrong!'})
  })
})

router.post('/complete-payment', authentication, (req, res) => {
  const {total_amount, receive_amount, method, table_id, user_id, room_number, creditCardType, creditCardNumber, paymentList, service_charge_amount} = req.body;
  db.knex.select('tables.outlet').from('customer_tables').leftJoin('tables', 'tables.number', 'customer_tables.table_number').where({id: table_id}).then((outletData) => {
    completePayment({total_amount, receive_amount, method, table_id, user_id, res, room_number, outlet: outletData[0].outlet, creditCardType, creditCardNumber, paymentList, service_charge_amount});
  })
})


router.post('/void-payment', authentication, async (req, res) => {
  const {table_id} = req.body;

  let payment = await db.knex('payment').where('customer_table_id', table_id)
  let ctmTable = await db.knex('customer_tables').where('id', table_id);
  await db.knex('multiple_payment').where({payment_id: payment[0].id.toString()}).del()

  db.knex('payment').where('customer_table_id', table_id).del().then(() => {
    db.knex('customer_tables').where('id', table_id).update({status: 'opened', shift_id: null}).then(() => {
      db.knex('customer_table_status').where('customer_table_id', table_id).andWhere('status', 'checked').del().then(() => {
        db.knex('customer_table_status').where('customer_table_id', table_id).andWhere('status', 'paid').del().then(() => {
          db.knex('customer_table_discount').where('customer_table_id', table_id).del().then()
          socket.clientUpdateTables();
          // console.log(chalk.red(`${moment().format('kk:mm:ss')} VOID PAYMENT: `) + 'Table No.' + ctmTable[0].table_number );
          res.json({msg: 'ทำการยกเลิกการจ่ายเงินสำเร็จ'});
        });
      });
    });
  }).catch(e => {
    console.log(e);
    res.status(404).json({msg: 'เกิดข้อผิดพลาดในระบบ'})
  });
});

router.post('/close', authentication, async (req, res) => {
  const {customer_table_id} = req.body;
  await db.knex('customer_tables').where('id', customer_table_id).del().then();
  await db.knex('customer_table_status').where('customer_table_id', customer_table_id).del().then();
  socket.clientUpdateTables();
})

router.post('/check-bill', authentication, (req, res) => {
  const {customer_table_id, user_id} = req.body;
  db.knex('customer_tables').where({id: customer_table_id}).then((customerTableData) => {
    db.knex('tables').where({number: customerTableData[0].table_number}).then(async (tableData) => {
      const outlet = tableData[0].outlet;
      if(outlet === 'customer' || outlet === 'staff'){
        checkBill({customer_table_id, user_id, res, outlet});
      }else {
        db.knex('customer_table_discount').insert({
          customer_table_id: customer_table_id,
          type: 'complimentary',
          amount: 0,
          section: 'f&b',
          remark: 'VIP Table'
        }).then(() => {
          checkBill({customer_table_id, user_id, res, outlet});
        })
      }
    })
  })
})

const checkBill = async ({customer_table_id, user_id, res, outlet}) => {
  await db.knex('customer_tables').where('id', customer_table_id).update({status: 'checked'});
  const timestamp = new Date();
  //Create Customer table status
  await db.knex('customer_table_status')
  .insert({
    customer_table_id: customer_table_id,
    status: 'checked',
    create_by: user_id,
    timestamp
  }).then();
  socket.clientUpdateTables();
  var tableInfo = await db.knex('customer_tables').where('id', customer_table_id).then();
  // console.log(chalk.green(`${moment().format('kk:mm:ss')} CHECK BILL: `) + 'Table No.' + tableInfo[0].table_number);
  getOrders(customer_table_id, outlet,  (ordersData) => {
    const orders = ordersData;
    db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').where('staffs.id', '=', user_id).then((data) => {
      db.knex('customer_table_discount').where({customer_table_id}).then((discountData) => {
          const sub_total = getSubTotal(orders);
          const total_bev = getBeverageTotal(orders);
          const total_food = getFoodTotal(orders);
          const vat_total = sub_total - total_bev - total_food;
          var total_discount = 0;
          if(discountData.length !== 0){
             total_discount =  getDiscountTotal( discountData[0].type,
               discountData[0].amount,
               discountData[0].section,
               total_bev,
               total_food,
               sub_total
             );
          }
          const total = sub_total;
          const short_name = data[0].short_name;
          let service_charge_amount = 0;

          if(tableInfo[0].roomDelivery){
            service_charge_amount = ((total_bev + total_food) * 1.1) - (total_bev + total_food)
          }

          db.knex('payment').where({customer_table_id}).then((returnData) => {
            if(returnData.length === 0){
              db.knex('payment').insert({
                customer_table_id, sub_total_amount : total, discount_amount: total_discount, service_charge_amount
              }).then(() => {
                db.knex('payment').where({customer_table_id}).then((rawData) => {
                  var payment_id = rawData[0].id;
                  db.knex('printers').where({name: 'แคชเชียร์'}).then((printerData) => {
                    const printerIp = printerData[0].ip_address;
                    let total = 0;
                    if(tableInfo[0].roomDelivery){
                      total = ((total_bev + total_food) * 1.1) + vat_total - total_discount
                    }else{
                      total = sub_total - total_discount
                    }
                    printer.printerCheckBill({
                      table_number:tableInfo[0].table_number,
                      zone:tableInfo[0].zone,
                      create_by: short_name,
                      timestamp,
                      orders,
                      language: tableInfo[0].language,
                      total,
                      sub_total,
                      total_bev,
                      total_food,
                      vat_total,
                      total_discount,
                      payment_id,
                      printerIp,
                      roomDelivery: tableInfo[0].roomDelivery
                    });
                  });
                  if(sub_total - total_discount === 0){
                    completePayment({total_amount: 0, receive_amount: 0, method: 'complimentary', table_id: customer_table_id, user_id, res, outlet});
                  }else{
                    res.json({msg: 'Succesfully checked bill'});
                  }
                })
              })
            }else{
              db.knex('payment').where({customer_table_id}).update({ sub_total_amount : total, discount_amount: total_discount, service_charge_amount
              }).then(() => {
                db.knex('payment').where({customer_table_id}).then((rawData) => {
                  var payment_id = rawData[0].id;
                  db.knex('printers').where({name: 'แคชเชียร์'}).then((printerData) => {
                    const printerIp = printerData[0].ip_address;
                    let total = 0;
                    if(tableInfo[0].roomDelivery){
                      total = ((total_bev + total_food) * 1.1) + vat_total - total_discount
                    }else{
                      total = sub_total - total_discount
                    }
                    printer.printerCheckBill({
                      table_number:tableInfo[0].table_number,
                      zone:tableInfo[0].zone,
                      create_by: short_name,
                      timestamp,
                      orders,
                      language: tableInfo[0].language,
                      total,
                      sub_total,
                      total_bev,
                      total_food,
                      vat_total,
                      total_discount,
                      payment_id,
                      printerIp,
                      roomDelivery: tableInfo[0].roomDelivery
                    });
                  });

                  if(sub_total - total_discount === 0){
                    completePayment({total_amount: 0, receive_amount: 0, method: 'complimentary', table_id: customer_table_id, user_id, res, outlet});
                  }else{
                    res.json({msg: 'Succesfully checked bill'});
                  }
                })
              })
            }
          })
        })
      })
  })
}



const getOrders = (table_id, outlet, callback) => {
  const paymentType = outlet === 'staff' ? 'mi.staff_price' : 'mi.price';
    db.knex.raw(`SELECT mi.name, mi.english_name, SUM(ior.quantity) as quantity, ${paymentType} as price, cate.name as category_name
  FROM item_orders ior
  LEFT JOIN menu_items mi on ior.item_code = mi.code
  LEFT JOIN categories cate on cate.id = mi.category_id
  WHERE ior.customer_table_id = ? and ior.quantity != 0 group by ior.item_code`, [table_id])
  .then(rawData => {
    callback(rawData[0]);
  }).catch(e => {
    console.log(e);
  })
}

const getSubTotal = (orders) => {
  return orders.reduce((total, order) => {
    return total + (order.quantity * order.price);
  }, 0);
}

const getBeverageTotal = (orders) => {
  const beverage = orders.filter(order => (order.category_name === 'เครื่องดื่ม'));
  return parseFloat(beverage.reduce((total, order) => {
    return total + (order.quantity * order.price);
  }, 0)/107 * 100);
}

const getFoodTotal = (orders) => {
  const beverage = orders.filter(order => (order.category_name !== 'เครื่องดื่ม'));
  return parseFloat(beverage.reduce((total, order) => {
    return total + (order.quantity * order.price);
  }, 0)/107 * 100);
}

const getDiscountTotal = ( type, amount, section, total_bev, total_food, sub_total ) => {
  var total_discount = 0;

  if(type === 'percentage'){
    if(section === 'f&b'){
      total_discount = (total_bev + total_food) * amount / 100;
    }else if(section === 'f'){
      total_discount = total_food * amount / 100;
    }else{
      total_discount = total_bev * amount / 100;
    }
  }else if(type === 'amount'){
    total_discount = amount;
  }else if(type === 'complimentary'){
    total_discount = sub_total;
  }
  return parseInt(total_discount);
}

const completePayment = ({total_amount, receive_amount, method, table_id, user_id, res, room_number = null, outlet, creditCardType = null, creditCardNumber = null, paymentList = [], service_charge_amount = 0}) => {
  const paymentInfo = method === 'card' ? `${creditCardType} ${creditCardNumber}` : room_number;

  db.knex('payment').where({customer_table_id: table_id}).update({total_amount, receive_amount, method, room_number: paymentInfo, service_charge_amount}).then(() => {
    db.knex('payment').where({customer_table_id: table_id}).then((rawData) => {
      if(method === 'multiple'){
        paymentList.forEach(paymentItem => {
          db.knex('multiple_payment').insert({payment_id: rawData[0].id, paymentType: paymentItem.paymentType, amount: paymentItem.amount, reference: paymentItem.reference}).then()
        })
      }
      const paymentId = rawData[0].id;
      db.knex('shifts').where({status: 'active'}).then((shiftData) => {
        const shift_id = shiftData[0].id;
        db.knex('customer_tables').where({id: table_id}).update({status: 'paid', shift_id}).then(() => {
          db.knex('customer_table_status').insert({
            customer_table_id: table_id,
            status: 'paid',
            create_by: user_id,
            timestamp: new Date(),
            detail: paymentId
          }).then(() => {
            db.knex('item_orders').where({customer_table_id: table_id}).then((item_orders) =>{
              item_orders.forEach(item_order => {
                orderHelper.createItemOrderStatus(item_order.id, 'complete', user_id, 'ปรุงเสร็จโดยเก็บเงิน' );
              });
            })
            socket.clientUpdateTables();
            res.json({msg: 'Succesfully paid!'})
             db.knex('customer_tables').where('id', table_id).then((rawData) => {
               const table_number = rawData[0].table_number;
               const roomDelivery = rawData[0].roomDelivery;
               const zone = rawData[0].zone;
               const language = rawData[0].language;
               // console.log(chalk.green(`${moment().format('kk:mm:ss')} COMPLETE PAYMENT: `) + 'Table NO.' + table_number);
               db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').where('staffs.id', '=', user_id).then((rawData) => {
                   db.knex('customer_table_discount').where({customer_table_id: table_id}).then((discountData) => {
                     getOrders(table_id, outlet, (ordersData) => {
                       const orders = ordersData;
                       const short_name = rawData[0].short_name;
                       const sub_total = getSubTotal(orders);
                       const total_bev = getBeverageTotal(orders);
                       const total_food = getFoodTotal(orders);
                       const vat_total = sub_total - total_bev - total_food;
                       var total_discount = 0;
                       if(discountData.length !== 0){
                          total_discount =  getDiscountTotal( discountData[0].type,
                            discountData[0].amount,
                            discountData[0].section,
                            total_bev,
                            total_food,
                            sub_total
                          );
                       }
                      const total = sub_total - total_discount + service_charge_amount;
                      db.knex('printers').where({name: 'แคชเชียร์'}).then((printerData) => {
                        const printerIp = printerData[0].ip_address;
                        printer.printReceipt({
                          printerIp,
                          table_number,
                          zone,
                          create_by: short_name,
                          timestamp: new Date(),
                          orders,
                          language,
                          total,
                          sub_total,
                          total_bev,
                          total_food,
                          vat_total,
                          total_discount,
                          payment_id:paymentId,
                          total_amount: total_amount + service_charge_amount,
                          receive_amount,
                          method,
                          room_number,
                          paymentInfo,
                          paymentList,
                          roomDelivery,
                          service_charge_amount
                        });
                      })
                     })
                  })
               })
             });
          })
        })
      })
    })
  }).catch(e => {
    console.log(e);
    res.status(400).json({msg: 'Something went wrong!'});
  })
}


//New Customer - Open a new table
router.post('/add', authentication, async (req, res) => {
  const customerTableObject = createCustomertable(req.body);
  if(!customerTableObject.table_number ||
    !customerTableObject.number_of_guest || !customerTableObject.language ||
    !customerTableObject.create_by || !customerTableObject.zone){
      res.status(400).json({msg: `Please include all the attributes`});
    }else{
      // Create Customer Table
      await db.knex('customer_tables').insert(customerTableObject).then();

      const timestamp = new Date();
      //Create Customer table status
      await db.knex('customer_table_status')
      .insert({
        customer_table_id: customerTableObject.id,
        status: 'opened',
        create_by: customerTableObject.create_by,
        timestamp
      }).then();


      //Set table status to "occupied"
      await db.knex('tables').where({number: customerTableObject.table_number})
      .update({status: 'on_order', hold_by:customerTableObject.create_by}).then();
      db.knex('tables').where({number: customerTableObject.table_number}).then(tableData => {
        socket.clientUpdateTables();
        customerTableObject.timestamp = timestamp;
        customerTableObject.section = tableData[0].section;
        customerTableObject.outlet = tableData[0].outlet;
        // console.log(chalk.green(`${moment().format('kk:mm:ss')} CREATE NEW TALBE: `) + 'Table No.' + customerTableObject.table_number + ' by: ' + customerTableObject.create_by);
        res.json(customerTableObject);
      })

    }
})

router.get('/get-table-status/:id', authentication, (req, res) => {
  db.knex.select('customer_table_status.timestamp', 'customer_table_status.status','customer_table_status.detail' , 'employees.short_name').from('customer_table_status')
  .leftJoin('staffs', 'staffs.id', 'customer_table_status.create_by')
  .leftJoin('employees', 'employees.id' , 'staffs.id')
  .where({customer_table_id: req.params.id}).then(data => {
    res.json(data)
  })
})

router.post('/updateRoomDelivery/', authentication, (req, res) => {
  const {customerTableId, roomDelivery} = req.body
  db.knex('customer_tables').where({id: customerTableId}).update({roomDelivery, status: 'opened'}).then(() => {
    db.knex('customer_tables').where({id: customerTableId}).then(data => {
      if(roomDelivery){
        // console.log(chalk.green(`${moment().format('kk:mm:ss')} APPLIED ROOM DELIVERY: `) + 'Table No.' + data[0].table_number);
      }else{
        // console.log(chalk.red(`${moment().format('kk:mm:ss')} UNAPPLIED ROOM DELIVERY: `) + 'Table No.' + data[0].table_number);
      }
      res.json({status: true})
    })
  })
})


router.get('/customer-table-discount/:id', authentication, (req, res) => {
  const { id } = req.params;
  db.knex('customer_table_discount').where({customer_table_id: id}).then((data) => {
    res.json(data)
  }).catch(e => {
    console.log(e);
    json.status(400).json({msg: 'Something went wrong!'})
  })
})

router.post('/customer-table-discount/', authentication, (req, res) => {
  const { table_id, user_id, payload } = req.body;
  // db.knex('customer_tables').where({id: table_id}).then(ctmObject => {
  //   console.log(chalk.green(`${moment().format('kk:mm:ss')} APPLIED DISCOUNT: `) + 'Table No.' + ctmObject[0].table_number + ' Type: ' + payload.type + ' Amount: ' + payload.amount + ' Section: ' + payload.section);
  // })
  db.knex('customer_table_discount').where({customer_table_id: table_id}).then((data) => {
    if(data.length === 0){
      db.knex('customer_table_discount').insert({
        customer_table_id: table_id,
        type: payload.type,
        amount: payload.amount || payload.percentage || 0,
        section: payload.section,
        remark: payload.remark
      }).then(() => {
        var detail = '';
        switch (payload.type) {
          case 'percentage':
            detail = `${payload.percentage}% จาก ${payload.section === 'f&b' ? 'อาหารและเครื่องดื่ม': payload.section === 'f' ? 'อาหาร' : 'เครื่องดื่ม'}`;
            break;
          case 'amount':
            detail = `${payload.amount} บาท`;
              break;
          case 'complimentary':
            detail = `โต๊ะ Complimentary เนื่องจาก ${payload.remark}`;
              break;
          default:
          detail =''
        }
        db.knex('customer_table_status')
        .insert({
          customer_table_id: table_id,
          status: 'discount',
          create_by: user_id,
          timestamp : new Date(),
          detail
        }).then(() => {
          db.knex('customer_tables').where({id: table_id}).update({status: 'opened'}).then(() => {
            res.json({msg:'Succesfully add discount'});
          });
        });
      })
    }else{
      db.knex('customer_table_discount').where({customer_table_id: table_id}).update({
        type: payload.type,
        amount: payload.amount || payload.percentage,
        section: payload.section,
        remark: payload.remark
      }).then(() => {
        var detail = '';
        switch (payload.type) {
          case 'percentage':
            detail = `${payload.percentage}% จาก ${payload.section === 'f&b' ? 'อาหารและเครื่องดื่ม': payload.section === 'f' ? 'อาหาร' : 'เครื่องดื่ม'}`;
            break;
          case 'amount':
            detail = `${payload.amount} บาท`;
              break;
          case 'complimentary':
            detail = `โต๊ะ Complimentary เนื่องจาก ${payload.remark}`;
              break;
          default:
          detail =''
        }
        db.knex('customer_table_status')
        .insert({
          customer_table_id: table_id,
          status: 'discount',
          create_by: user_id,
          timestamp : new Date(),
          detail
        }).then(() => {
          db.knex('customer_tables').where({id: table_id}).update({status: 'opened'}).then(() => {
            res.json({msg:'Succesfully add discount'});
          });
        });
      })
    }
  }).catch(e => {
    console.log(e);
    json.status(400).json({msg: 'Something went wrong!'})
  })
})


router.post('/submit-refund', authentication, (req, res) => {
  var {user_id, table_id, remark, amount} = req.body;
  db.knex('refunds').insert({
    customer_table_id: table_id,
    remark : remark,
    amount: parseInt(amount),
    create_by: user_id,
    create_at: new Date()
  }).then(() => {
    res.json({msg: 'บันทึกการคืนเงินสำเร็จ',status: true});
    socket.updateHistoryTables();
  }).catch((e) => {
    console.log(e);
    res.json({msg: 'ไม่สามารถบันทึกการคืนเงินได้', status: false})
  })
})

router.post('/transfer-orders', authentication, (req, res) => {
  var { tableNumber, orders, create_by, oldTableId, transferType, newTable } = req.body;
  if(typeof orders === 'string'){
    orders = JSON.parse(orders);
  }

  // db.knex('customer_tables').where({id: oldTableId}).then(ctmObject => {
  //   console.log(chalk.green(`${moment().format('kk:mm:ss')} TABLE TRANSFER: `) + ' From Table No.' + ctmObject[0].table_number + ' To Table No.: ' + tableNumber + ' total ' + orders.length + ' item/s');
  // })

  db.knex.raw(`SELECT *
    FROM tables
    LEFT JOIN customer_tables ct
    ON ct.table_number = tables.number
    AND ct.status != 'paid'
    WHERE tables.number = ?`, [tableNumber]).then(responseData => {
    const rows = responseData[0];
    db.knex('customer_tables').where({id: oldTableId}).then((responseData) => {
      const oldTableNumber = responseData[0].table_number;
      if(rows[0].id === null){
        //New Table
        if(transferType === 'full'){
            db.knex('customer_tables').where({id: oldTableId}).update({table_number: newTable.tableNumber, zone: newTable.zone, language: newTable.language, number_of_guest: newTable.number_of_guest, status:'opened'}).then(() => {
              db.knex('item_orders').where({customer_table_id: oldTableId}).then((responseData) => {
                responseData.forEach(row => {

                  db.knex('item_order_transfer').where({item_order_id: row.id}).then((responseData) => {
                    if(responseData.length == 0){
                      db.knex('item_order_transfer').insert({
                        item_order_id:  row.id,
                        create_by,
                        from_table: oldTableNumber,
                        timestamp: new Date()
                      }).then(() => socket.clientUpdateOrders());
                    }else{
                      db.knex('item_order_transfer').where({item_order_id: row.id}).update({
                        create_by,
                        from_table: oldTableNumber,
                        timestamp: new Date()
                      }).then(() => socket.clientUpdateOrders());
                    }
                  })
                })
                printTransferOrdersForNewTable({oldTableId, tableNumber,oldTableNumber, zone: newTable.zone, create_by});
                socket.clientUpdateTables();
                res.json();
              })

            })
        }else{
          const zone = newTable.zone;
          const tableNumber = newTable.tableNumber;
          const number_of_guest = newTable.number_of_guest;
          const language = newTable.language;
          const id = uuid.v4();
          db.knex('customer_tables').insert({
            id: id,
            table_number: tableNumber,
            number_of_guest: parseInt(number_of_guest),
            language: language,
            create_by,
            status: 'opened',
            zone: zone
          }).then(() => {
            db.knex('customer_table_status').insert({
              customer_table_id: id,
              status: 'opened',
              create_by: create_by,
              timestamp: new Date()
            }).then(() => {
              orders.forEach(order => {
                const itemId =  uuid.v4();
                 db.knex('item_orders').where({id: order.id}).then((responseData) => {
                  db.knex('menu_items').where({code:responseData[0].item_code}).then(nameData => {
                    db.knex('customer_table_status').insert({
                      customer_table_id: oldTableId,
                      status: 'transfer',
                      create_by,
                      timestamp: new Date(),
                      detail: `${nameData[0].name} x ${order.quantity} => โต๊ะ:${tableNumber}`
                    }).then()
                  })
                  const quantity = responseData[0].quantity;
                  if(quantity > order.quantity){
                    const remain = quantity - order.quantity;
                    // Update old item_orders order with the remaining quantity
                    db.knex('item_orders').where({id: order.id}).update({quantity: remain}).then(() => {
                      //Create new item_order for new table
                      db.knex('item_orders').insert({
                        id: itemId,
                        item_code: responseData[0].item_code,
                        customer_table_id: id,
                        quantity: order.quantity,
                        create_by: responseData[0].create_by
                      }).then(() => {
                        //Get old table Informat4ion
                          db.knex('item_order_status').where({item_order_id: order.id}).then((responseData) => {
                            //Create trnsfer status to new table
                            responseData.forEach(ios =>{
                              db.knex('item_order_status').insert({
                                item_order_id: itemId,
                                status: ios.status,
                                create_by: ios.create_by,
                                timestamp: ios.timestamp,
                                quantity: order.quantity
                              }).then()
                            })
                            db.knex('item_order_transfer').where({item_order_id:itemId}).then((responseData) => {
                              if(responseData.length == 0){
                                db.knex('item_order_transfer').insert({
                                  item_order_id: itemId,
                                  create_by,
                                  from_table: oldTableNumber,
                                  timestamp: new Date()
                                 }).then(() => socket.clientUpdateOrders());
                              }else{
                                db.knex('item_order_transfer').where({item_order_id:itemId}).update({
                                  create_by,
                                  from_table: oldTableNumber,
                                  timestamp: new Date()
                                }).then(() => socket.clientUpdateOrders());
                              }
                            })
                          })
                      })
                    })
                  }else{
                    // item_orders to new customer_table_id
                    db.knex('item_orders').where({id: order.id}).update({customer_table_id: id}).then(() => {
                          // Add transfer status to item_order
                          db.knex('item_order_transfer').where({item_order_id:order.id}).then((responseData) => {
                            if(responseData.length == 0){
                              db.knex('item_order_transfer').insert({
                                item_order_id: order.id,
                                create_by,
                                from_table: oldTableNumber,
                                timestamp: new Date()
                               }).then(() => socket.clientUpdateOrders());
                            }else{
                              db.knex('item_order_transfer').where({item_order_id:order.id}).update({
                                create_by,
                                from_table: oldTableNumber,
                                timestamp: new Date()
                              }).then(() => socket.clientUpdateOrders());
                            }
                          })
                      })
                  }
                })
              })
              db.knex('customer_tables').where({id: oldTableId}).update({status:'opened'}).then(() => {
                db.knex('customer_tables').where({id: id}).update({status:'opened'}).then(() => {
                  setTimeout(() => {
                    printTransferOrdersForNewTable({oldTableId: id, tableNumber,oldTableNumber, zone: newTable.zone, create_by});
                  }, 1000)
                  socket.clientUpdateTables();
                  res.json();
                })
              })
            })
          })

        }
      }else{
        //Existed Table
        const existTableId = rows[0].id
        if(transferType === 'full'){
          printTransferOrdersForNewTable({oldTableId, tableNumber,oldTableNumber, zone: rows[0].zone, create_by});
          db.knex('item_orders').where({customer_table_id: oldTableId}).then((responseData) => {
            responseData.forEach(row => {
              db.knex('item_order_transfer').where({item_order_id:row.id}).then((responseData) => {
                if(responseData.length == 0){
                  db.knex('item_order_transfer').insert({
                    item_order_id: row.id,
                    create_by,
                    from_table: oldTableNumber,
                    timestamp: new Date()
                   }).then(() => socket.clientUpdateOrders());
                }else{
                  db.knex('item_order_transfer').where({item_order_id:row.id}).update({
                    create_by,
                    from_table: oldTableNumber,
                    timestamp: new Date()
                  }).then(() => socket.clientUpdateOrders());
                }
              })
            })
            db.knex('item_orders').where({customer_table_id: oldTableId}).update({customer_table_id: existTableId}).then(() => {
              db.knex('customer_tables').where({id: existTableId}).update({status: 'opened'}).then(
                db.knex('customer_tables').where({id: oldTableId}).del().then(() => {
                  socket.clientUpdateTables();
                  res.json();
                })
              )
            })
          })
        }else{

          var sortedOrders = [];
          orders.forEach(order => {

            db.knex.raw(`SELECT ior.id, ior.quantity, max_status.status, ior.item_code, mi.name, pt.ip_address
          FROM item_orders ior,
          (SELECT ios.* FROM item_order_status ios,
          (SELECT item_order_id, max(timestamp) as timestamp
          FROM item_order_status
          GROUP BY item_order_id) max
          WHERE max.item_order_id = ios.item_order_id
            AND max.timestamp = ios.timestamp) max_status,
           menu_items mi,  printers pt
           WHERE ior.id = ?
           AND max_status.item_order_id = ior.id AND mi.code = ior.item_code
          AND max_status.status = 'sent' AND pt.id = mi.printer`, [order.id]).then((rawOrderData) => {
            if(rawOrderData[0].length !== 0){
              var rawOrder = rawOrderData[0][0];
              rawOrder.quantity = order.quantity;
              sortedOrders = [...sortedOrders, rawOrder];
            }
          }).then(() => {
            const itemId =  uuid.v4();
            db.knex('item_orders').where({id: order.id}).then((responseData) => {
              const quantity = responseData[0].quantity;
              db.knex('menu_items').where({code:responseData[0].item_code}).then(nameData => {
                db.knex('customer_table_status').insert({
                  customer_table_id: oldTableId,
                  status: 'transfer',
                  create_by,
                  timestamp: new Date(),
                  detail: `${nameData[0].name} x ${order.quantity} => โต๊ะ:${tableNumber}`
                }).then()
              })
              if(quantity > order.quantity){
                const remain = quantity - order.quantity;

                // Update old item_orders order with the remaining quantity
                db.knex('item_orders').where({id: order.id}).update({quantity: remain}).then(() => {
                  //Create new item_order for new table
                  db.knex('item_orders').insert({
                    id: itemId,
                    item_code: responseData[0].item_code,
                    customer_table_id: existTableId,
                    quantity: order.quantity,
                    create_by: responseData[0].create_by
                  }).then(() => {

                    //Get old table Information
                      db.knex('item_order_status').where({item_order_id: order.id}).then((responseData) => {
                        const ios = responseData[0];
                        //Create trnsfer status to new table
                        responseData.forEach(ios => {
                            db.knex('item_order_status').insert({
                              item_order_id: itemId,
                              status: ios.status,
                              create_by: ios.create_by,
                              timestamp: ios.timestamp,
                              quantity: order.quantity
                          }).then()
                        })
                          // Add transfer status to item_order
                          db.knex('item_order_transfer').where({item_order_id:itemId}).then((responseData) => {
                            if(responseData.length == 0){
                              db.knex('item_order_transfer').insert({
                                item_order_id: itemId,
                                create_by,
                                from_table: oldTableNumber,
                                timestamp: new Date()
                               }).then(() => socket.clientUpdateOrders());
                            }else{
                              db.knex('item_order_transfer').where({item_order_id:itemId}).update({
                                create_by,
                                from_table: tableNumber,
                                timestamp: new Date()
                              }).then(() => socket.clientUpdateOrders());
                            }
                          })
                      })
                  })
                })
              }else{
                // item_orders to new customer_table_id
                db.knex('item_orders').where({id: order.id}).update({customer_table_id: existTableId}).then(() => {
                      // Add transfer status to item_order
                      db.knex('item_order_transfer').where({item_order_id:order.id}).then((responseData) => {
                        if(responseData.length == 0){
                          db.knex('item_order_transfer').insert({
                            item_order_id: order.id,
                            create_by,
                            from_table: oldTableNumber,
                            timestamp: new Date()
                           }).then(() => socket.clientUpdateOrders());
                        }else{
                          db.knex('item_order_transfer').where({item_order_id:order.id}).update({
                            create_by,
                            from_table: oldTableNumber,
                            timestamp: new Date()
                          }).then(() => socket.clientUpdateOrders());
                        }
                      })
                  })
              }
            })
          })

          })
          db.knex('customer_tables').where({id: oldTableId}).update({status:'opened'}).then(() => {
            db.knex('customer_tables').where({id: existTableId}).update({status:'opened'}).then(() => {
              setTimeout(() => {
                printTransferOrdersForNewTable({sortedOrders, tableNumber,oldTableNumber, zone: rows[0].zone, create_by});
              }, 1000)
              socket.clientUpdateTables();
              res.json();
            })
          })
        }
      }
    })
  }).catch(e => {
    console.log(e);
    res.status(400);
  })
  console.log('Update order sattus');
});

function createCustomertable(body){
  return {
    id: uuid.v4(),
    table_number: body.table_number,
    number_of_guest: parseInt(body.number_of_guest),
    language: body.language,
    create_by: body.create_by,
    status: 'opened',
    zone: body.zone,
    roomDelivery: false
  }
}

function printTransferOrdersForNewTable({sortedOrders = null, oldTableId = 'nothing', tableNumber,oldTableNumber, zone, create_by}){
  db.knex.raw(`SELECT ior.id, ior.quantity, max_status.status, ior.item_code, mi.name, pt.ip_address
          FROM item_orders ior,
          (SELECT ios.* FROM item_order_status ios,
          (SELECT item_order_id, max(timestamp) as timestamp
          FROM item_order_status
          GROUP BY item_order_id) max
          WHERE max.item_order_id = ios.item_order_id
            AND max.timestamp = ios.timestamp) max_status,
           menu_items mi,  printers pt
          WHERE ior.customer_table_id = ?
          AND max_status.item_order_id = ior.id AND mi.code = ior.item_code
          AND max_status.status = 'sent' AND pt.id = mi.printer`, [oldTableId]).then((rawData) => {
            var orders = sortedOrders || rawData[0];
            if(orders.length !== 0){
              var formatOrders = orders.reduce((objects, order) => {
                var existed = false;
                var objIndex;
                objects.forEach((object, index) => {
                  if(object.ip_address === order.ip_address){
                    existed = true;
                    objIndex = index;
                  }
                })
                if(existed){
                  objects[objIndex].orders = [...objects[objIndex].orders, order]
                }else{
                  objects = [...objects, {ip_address: order.ip_address, orders:[order] }]
                }
                return objects
              }, []);
              db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').where('staffs.id', '=', create_by).then((staffData) => {
                const name = staffData[0].name;
                const toTable = tableNumber;
                const fromTable = oldTableNumber;

                formatOrders.forEach((ordersByip, index) => {
                  var transferOrders = ordersByip.orders;
                  var ip_address = ordersByip.ip_address;
                  printer.printTransferOrders({fromTable, toTable, zone, timestamp: new Date(), name, ip_address, transferOrders});
                })

              })
            }
          })
}

module.exports = router;
