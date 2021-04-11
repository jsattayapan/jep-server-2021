const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const moment = require('moment');
const _ = require('lodash');

const db = require('../../../database/index.js');

var shiftDefault = {
  open_at: "-",
    close_at: "-",
    open_by: "-",
    close_by: "-",
    tables: 0,
    guests: 0,
    totalSale: 0,
    staffSale: 0,
    cash: 0,
    card: 0,
    room: 0,
    discount: 0,
    foodsInfo: {
        quantity: 0,
        price: 0
    },
    drinksInfo: {
        quantity: 0,
        price: 0
    },
    othersInfo: {
        quantity: 0,
        price: 0
    }}

router.get('/', (req, res) => {
  db.knex.raw(`SELECT p.id, p.method, p.room_number as details,  ct.number_of_guest , ct.table_number, mi.name, ior.quantity, mi.price FROM avatara_server.customer_tables ct
    LEFT JOIN item_orders ior ON ct.id = ior.customer_table_id
    LEFT JOIN payment p ON ct.id = p.customer_table_id
    LEFT JOIN menu_items mi ON mi.code = ior.item_code
    LEFT JOIN shifts s ON ct.shift_id = s.id
    WHERE ct.status = 'paid'
    `).then(rawData => {
      res.json(rawData[0]);
    }).catch(e => {
      res.status(400).json({msg: 'Something went wrong!'});
      console.log(e);
    })
});


router.post('/daily-summary', async (req, res) => {
  try{
    var inputDate = req.body.date;

    var payload = {status: true, morning:{}, afternoon: {}};

    var shifts = await db.knex('shifts').where({detail: inputDate}).then();
    if(shifts.length !== 0){

      var moringShift = shifts.find(o => o.period === "morning");
      payload.morning = moringShift !== undefined ? await getSumsByDate(moringShift) : shiftDefault;
      var afternoonShift = shifts.find(o => o.period === "afternoon");
      payload.afternoon = afternoonShift !== undefined ? await getSumsByDate(afternoonShift) : shiftDefault;

      res.json(payload);
    }else{
      payload.status = false;
      payload.msg = 'ไม่พบข้อมูล';
      res.json(payload);
    }
  }catch(e){
    console.log(e);
  }

})

router.post('/items-sold', async (req, res) => {
  var itemsData =  await db.knex.raw(`SELECT mi.name, sum(ior.quantity) as qty, mi.price, cat.name as cat
    FROM customer_tables ct
    LEFT JOIN item_orders ior ON ct.id = ior.customer_table_id
    LEFT JOIN menu_items mi ON mi.code = ior.item_code
    LEFT JOIN categories cat ON cat.id = mi.category_id
    LEFT JOIN shifts s ON ct.shift_id = s.id
    WHERE ct.status = 'paid' AND s.detail = ? AND ior.quantity != 0
    GROUP BY mi.name`,[req.body.date]).then();

    if(itemsData[0].length !== 0){
      res.json({status:true, payload: itemsData[0]});
    }else{
      res.json({status:false, msg: 'ไม่พบข้อมูล'});
    }

});

router.post('/items-cancel', async (req, res) => {
  var itemsData =  await db.knex.raw(`SELECT ct.table_number, mi.name, ios.quantity, mi.price, ios.detail, emp.short_name
      FROM item_order_status ios
      LEFT JOIN item_orders io ON ios.item_order_id = io.id
      LEFT JOIN menu_items mi ON mi.code = io.item_code
      LEFT JOIN customer_tables ct ON ct.id = io.customer_table_id
      LEFT JOIN shifts s ON s.id = ct.shift_id
      LEFT JOIN staffs sf ON sf.id = ios.create_by
      LEFT JOIN employees emp ON sf.id = emp.id
      WHERE ios.status = 'cancel' AND s.detail = ?`,[req.body.date]).then();
    if(itemsData[0].length !== 0){
      res.json({status:true, payload: itemsData[0]});
    }else{
      res.json({status:false, msg: 'ไม่พบข้อมูล'});
    }

});

router.post('/customer-tables', async (req, res) => {
  var ct = await db.knex.raw(`select p.id, t.number, t.outlet, ct.number_of_guest, p.method, p.total_amount, p.discount_amount, s.period from shifts s
  LEFT JOIN customer_tables ct ON ct.shift_id = s.id
  LEFT JOIN payment p ON ct.id = p.customer_table_id
  LEFT JOIN tables t ON t.number = ct.table_number
  WHERE s.detail = ?`, [req.body.date]).then();
  if(ct[0].length !== 0){
    res.json({status:true, payload: ct[0]});
  }else{
    res.json({status:false, msg: 'ไม่พบข้อมูล'});
  }
})


router.post('/history-tables', async (req, res) => {
    var customerTablesData = await db.knex.raw(`SELECT ct.id, ct.table_number, ct.number_of_guest, ct.language, ct.create_by
      from customer_tables ct
      LEFT JOIN shifts on shifts.id = ct.shift_id
      WHERE ct.status = 'paid' AND shifts.detail = ?`, [req.body.date]).then(); //moment().format('DD/MM/YYYY')
    var staffsData = await db.knex('staffs').leftJoin('employees', 'staffs.id', 'employees.id').then();
    var refundData = await db.knex.raw(`SELECT refunds.customer_table_id, sum(amount) as refund_amount from refunds GROUP BY refunds.customer_table_id`).then();
    var discountData = await db.knex('customer_table_discount').then();
    var paymentData = await db.knex('payment').then();
   //
    const joinedData = customerTablesData[0].map((table, index) => {
     let staffs = staffsData.find(o => o.id === table.create_by) || _.mapValues(staffsData[0], () => null);
     let filteredStaff = {short_name: staffs.short_name}
     return Object.assign({}, table, filteredStaff)
   }).map((table, index) => {
    let refund = refundData[0].find(o => o.customer_table_id === table.id) || {refund_amount: null};
    let filteredRefund = {refund_amount: refund.refund_amount}
    return Object.assign({}, table, filteredRefund)
  }).map((table, index) => {
    let discount = discountData.find(o => o.customer_table_id === table.id) || _.mapValues(discountData[0], () => null);
    let filteredDiscount = {discount_type: discount.type, discount_amount: discount.amount, discount_section: discount.section, discount_remark: discount.remark}
    return Object.assign({}, table, filteredDiscount)
  }).map((table, index) => {
    let payment = paymentData.find(o => o.customer_table_id === table.id) || _.mapValues(paymentData[0], () => null)
    let filteredPayment = {billNo: payment.id, room_number: payment.room_number, total_amount: payment.total_amount, method: payment.method}
    return Object.assign({}, table, filteredPayment)
  })

  if(joinedData.length !== 0){
    var tables = joinedData;
    Promise.all(tables.map(table => {
      return db.knex.raw(`select mi.name, SUM(io.quantity) as quantity
        FROM item_orders io
        LEFT JOIN menu_items mi ON io.item_code = mi.code
        where io.customer_table_id = ?
        GROUP BY mi.name`, [table.id]).then(rawOrders => {
          table['order'] = rawOrders[0];
          return db.knex('customer_table_status').where({customer_table_id: table.id, status: 'opened'}).then(statusData => {
            table['open_at'] = statusData[0].timestamp;
            return db.knex('customer_table_status').where({customer_table_id: table.id, status: 'checked'}).then(statusData => {
              table['close_at'] = statusData[0].timestamp;
              return table;
            })
          })
        })
    })
  ).then((response) => {
    if(response.length !== 0){
      res.json({status:true, payload: response});
    }else{
      res.json({status:false, msg: 'ไม่พบข้อมูล'});
    }
  })

  }else{
    res.json({status:false, msg: 'ไม่พบข้อมูล'});
  }
})

router.get('/getStaffsSaleDaily', async (req, res) => {
    console.log('getStaffsSaleDaily')
    try{
        let momentDate = moment().format('DD/MM/YYYY')
    let staffsList = await db.knex('staffs')
    .leftJoin('employees', 'employees.id', 'staffs.id')
    
    let result = await db.knex('item_orders')
    .select('menu_items.price', 'item_orders.quantity', 'employees.short_name', 'employees.id', 'customer_tables.table_number', 'tables.section')
    .leftJoin('employees', 'employees.id', 'item_orders.create_by')
    .leftJoin('menu_items', 'menu_items.code', 'item_orders.item_code')
    .leftJoin('customer_tables', 'customer_tables.id', 'item_orders.customer_table_id')
    .leftJoin('tables', 'customer_tables.table_number', 'tables.number')
    .leftJoin('shifts', 'shifts.id', 'customer_tables.shift_id')
    .where('shifts.detail', momentDate)
    .whereNot('item_orders.quantity', 0)
    
    result = result.filter(x => x.section !== 'VIP')
    result = result.filter(x => x.table_number !== 'Cash')
    result = result.filter(x => x.table_number !== 'Staffs')
        
    let some = staffsList.reduce((list, staff) => {
        let totalAmount = result.reduce((total, x) => {
            if(x.id === staff.id){
                return total + (x.quantity * x.price)
            }
            return total
        }, 0)
        return [...list, { short_name: staff.short_name, total: totalAmount}]
    }, [])
    some = some.filter(x => x.total !== 0)
    console.log(some)
    res.json({ status: true, staffs: some})
    } catch(e){
        console.log(e)
        res.json({ status: false, msg: 'Something Went Wrong'})
    }
})

router.post('/get-customer-detail', async (req, res) => {
  var id = req.body.id;
  var staffs = await db.knex('staffs').leftJoin('employees', 'staffs.id', 'employees.id').then();
  var payment = await db.knex('payment').where({id}).then();
  if(payment.length !== 0){
    var customer = await db.knex('customer_tables').where({id: payment[0].customer_table_id}).then();
    var table = await db.knex('tables').where({number:customer[0].table_number}).then();
    var shift = await db.knex('shifts').where({id: customer[0].shift_id}).then();
    var cStatus = await db.knex('customer_table_status').where({customer_table_id: customer[0].id}).then();
    var open = cStatus.find(o => o.status === 'opened');
    var close = cStatus.find(o => o.status === 'paid');
    var openBy = staffs.find(o => o.id === open.create_by);
    var closeBy = staffs.find(o => o.id === close.create_by);
    var payload = {
      id: id,
      number: customer[0].table_number,
      outlet: table[0].outlet,
      guest: customer[0].number_of_guest,
      language: customer[0].language,
      zone: customer[0].zone,
      shift: `${shift[0].detail} ${shift[0].period === 'morning' ? 'รอบเช้า' : 'รอบบ่าย'}`,
      discount: payment[0].discount_amount,
      total: payment[0].total_amount,
      receive: payment[0].receive_amount,
      method: `${payment[0].method === "cash" ? 'เงินสด' : payment[0].method === "card" ? `บัตรเครดิต ${payment[0].room_number}` : `โอนเข้าห้อง ${payment[0].room_number}`}`,
      open_at: open.timestamp,
      close_at: close.timestamp,
      open_by: openBy.name,
      close_by: closeBy.name
    }
    var cancelItems =  await db.knex.raw(`SELECT mi.name, ios.quantity as qty, mi.price, ios.detail, emp.name as staff
        FROM item_order_status ios
        LEFT JOIN item_orders io ON ios.item_order_id = io.id
        LEFT JOIN menu_items mi ON mi.code = io.item_code
        LEFT JOIN customer_tables ct ON ct.id = io.customer_table_id
        LEFT JOIN shifts s ON s.id = ct.shift_id
        LEFT JOIN staffs sf ON sf.id = ios.create_by
        LEFT JOIN employees emp ON sf.id = emp.id
        WHERE ios.status = 'cancel' AND ct.id = ?`,[customer[0].id]).then();

        var itemsData =  await db.knex.raw(`SELECT mi.name, ior.quantity as qty, mi.price, emp.name as staff, ior.remark
          FROM item_orders ior
          LEFT JOIN menu_items mi ON mi.code = ior.item_code
          LEFT JOIN staffs sf ON sf.id = ior.create_by
          LEFT JOIN employees emp ON sf.id = emp.id
          WHERE ior.customer_table_id = ? AND ior.quantity != 0`,[customer[0].id]).then();
          payload.orderItems = itemsData[0];
          payload.cancelItems = cancelItems[0];
    res.json({status: true, payload})
  }else{
    res.json({status:false, msg: 'ไม่พบข้อมูล'});
  }
});

router.post('/get-vip-monthly', async (req, res) => {
  var date = new Date(req.body.date), y = date.getFullYear(), m = date.getMonth();
  var firstDay = new Date(y, m, 1);
  var lastDay = new Date(y, m +1, 1, 0, 0, -1);

  var allItems = await db.knex.raw(`SELECT ior.item_code, ior.quantity, mi.staff_price, tb.number
  FROM item_orders ior
  LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
  LEFT JOIN menu_items mi ON mi.code = ior.item_code
  LEFT JOIN tables tb ON tb.number = ct.table_number
  LEFT JOIN shifts sf ON sf.id = ct.shift_id
  WHERE ior.quantity != 0 AND tb.section = "VIP" AND sf.close_at BETWEEN ? AND ?`, [firstDay, lastDay]).then();

  var employees = await db.knex('employee').then();

  var result = employees.reduce((total, emp) => {
    var items = allItems[0].filter(x => x.number === emp.table_number);
    var amount = items.reduce((sum, item) => {
      return sum += (item.staff_price * item.quantity);
    }, 0);
    return [...total, {name: emp.table_number, total: amount, limit: emp.limit}]
  }, [])

  res.json({status: true, payload: result});

})

router.post('/get-staffs-sale-monthly', async (req, res) => {
  var date = new Date(req.body.date), y = date.getFullYear(), m = date.getMonth();
  var firstDay = new Date(y, m, 1);
  var lastDay = new Date(y, m +1, 1, 0, 0, -1);

  var allItems = await db.knex.raw(`SELECT ior.create_by, ior.quantity, mi.price
FROM item_orders ior
LEFT JOIN menu_items mi ON mi.code = ior.item_code
LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
LEFT JOIN tables tb ON tb.number = ct.table_number
LEFT JOIN shifts sf ON sf.id = ct.shift_id
WHERE ior.quantity != 0 AND tb.outlet = "customer" AND sf.close_at BETWEEN ? AND ?`, [firstDay, lastDay]).then();

  var staffs = await db.knex('staffs').leftJoin('employees', 'staffs.id', 'employees.id').then();

  var result = staffs.map(x => {
    var items = allItems[0].filter(y => y.create_by === x.id);
    var amount = items.reduce((sum, item) => {
      return sum += (item.price * item.quantity);
    }, 0);
    return {name: x.name, short_name: x.short_name, total: amount}
  })

  res.json({status: true, payload: result})
})

const getSumsByDate = async (moringShift) => {
  var staffs = await db.knex('staffs').leftJoin('employees', 'staffs.id', 'employees.id').then();
  var payload = {};
  payload.open_at = moringShift.open_at || '-';
  payload.close_at = moringShift.close_at || '-';
  payload.open_by = staffs.find(o => o.id === moringShift.open_by).name || '-';
  payload.close_by = staffs.find(o => o.id === moringShift.close_by).name || '-';
  var morningTables = await db.knex.raw(
    `SELECT ct.id, ct.table_number, ct.number_of_guest, ct.language, ct.shift_id, p.method, p.total_amount, p.discount_amount, tables.outlet
    FROM customer_tables ct
    LEFT JOIN payment p ON ct.id = p.customer_table_id
    LEFT JOIN tables ON tables.number = ct.table_number
    WHERE ct.shift_id = ?`,[moringShift.id]
    ).then();
  var morningCustomer = morningTables[0].filter(o => o.outlet === 'customer');
  var morningStaff = morningTables[0].filter(o => o.outlet === 'staff');
  payload.tables = morningCustomer.length;
  payload.guests = morningCustomer.reduce((total, table) => {
    return total += table.number_of_guest;
  }, 0);
  payload.totalSale = morningCustomer.reduce((total, table) => {
    return total += table.total_amount;
  }, 0);
  payload.staffSale = morningStaff.reduce((total, table) => {
    return total += table.total_amount;
  }, 0);
  payload.cash = morningTables[0].filter(o => o.method === 'cash').reduce((total, table) => {
    return total += table.total_amount
  }, 0);
  payload.card = morningTables[0].filter(o => o.method === 'card').reduce((total, table) => {
    return total += table.total_amount
  }, 0);
  payload.room = morningTables[0].filter(o => o.method === 'room').reduce((total, table) => {
    return total += table.total_amount
  }, 0);
  payload.discount = morningCustomer.reduce((total, table) => {
    return total += table.discount_amount
  }, 0);

  var orders = await db.knex.raw(`SELECT ior.quantity, menu.price, cat.name as food_type
    FROM item_orders ior
    LEFT JOIN menu_items menu ON ior.item_code = menu.code
    LEFT JOIN categories cat ON cat.id = menu.category_id
    LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
    WHERE ct.shift_id = ?`, [moringShift.id]).then();

    var foods = orders[0].filter(x => x.food_type !== "เครื่องดื่ม" && x.food_type !== "อื่นๆ");
    var drinks = orders[0].filter(x => x.food_type === "เครื่องดื่ม");
    var others = orders[0].filter(x => x.food_type === "อื่นๆ");
    var foodsInfo = foods.reduce((total, food) => {
      var quantity = food.quantity + total.quantity || 0;
      var price = total.price + (food.price * food.quantity) || 0;
      return {quantity, price}
    }, {quantity: 0, price: 0});
    var drinksInfo = drinks.reduce((total, food) => {
      var quantity = food.quantity + total.quantity || 0;
      var price = total.price + (food.price * food.quantity) || 0;
      return {quantity, price}
    }, {quantity: 0, price: 0})
    var othersInfo = others.reduce((total, food) => {
      var quantity = food.quantity + total.quantity || 0;
      var price = total.price + (food.price * food.quantity) || 0;
      return {quantity, price}
    }, {quantity: 0, price: 0})

    var cancelData = await db.knex.raw(`SELECT ios.quantity
      FROM item_order_status ios
      LEFT JOIN item_orders ior ON ios.item_order_id = ior.id
      LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
      WHERE ios.status = 'cancel' AND ct.shift_id = ?`, [moringShift.id]).then()
        const cancelOrders = cancelData[0];
        const cancels = cancelOrders.reduce((total, order) => {
          return total + order.quantity;
        }, 0);

  return {...payload, foodsInfo, drinksInfo, othersInfo, cancels};
}
router.post('/', (req, res) => {
  var date = req.body.date;
  db.knex.raw(`SELECT p.id, p.method, p.room_number as details,  ct.number_of_guest , ct.table_number, mi.name, ior.quantity, mi.price FROM avatara_server.customer_tables ct
    LEFT JOIN item_orders ior ON ct.id = ior.customer_table_id
    LEFT JOIN payment p ON ct.id = p.customer_table_id
    LEFT JOIN menu_items mi ON mi.code = ior.item_code
    LEFT JOIN shifts s ON ct.shift_id = s.id
    WHERE ct.status = 'paid' AND s.detail = ?
    `, [date] ).then(rawData => {
      res.json(rawData[0]);
    }).catch(e => {
      res.status(400).json({msg: 'Something went wrong!'});
      console.log(e);
    })
});

router.post('/daily-report', (req, res) => {
  var date = req.body.date;
  db.knex.raw(`select   t.number,  t.outlet, ct.number_of_guest, p.method, p.total_amount, p.discount_amount, s.period from shifts s
LEFT JOIN customer_tables ct ON ct.shift_id = s.id
LEFT JOIN payment p ON ct.id = p.customer_table_id
LEFT JOIN tables t ON t.number = ct.table_number
WHERE s.detail = ?`, [date]).then(rawData => {
    res.json(rawData[0]);
  }).catch(e => {
    res.status(400).json({msg: 'Something went wrong!'});
    console.log(e);
  })
})

router.post('/cancel-report', (req, res) => {
  var date = req.body.date;
  db.knex.raw(`SELECT ct.table_number, mi.name, ios.quantity, mi.price, ios.detail, sf.short_name
FROM item_order_status ios
LEFT JOIN item_orders io ON ios.item_order_id = io.id
LEFT JOIN menu_items mi ON mi.code = io.item_code
LEFT JOIN customer_tables ct ON ct.id = io.customer_table_id
LEFT JOIN shifts s ON s.id = ct.shift_id
LEFT JOIN staffs sf ON sf.id = ios.create_by
WHERE ios.status = 'cancel' AND s.detail = ?`, [date]).then(rawData => {
      res.json(rawData[0]);
    }).catch(e => {
      res.status(400).json({msg: 'Something went wrong!'});
      console.log(e);
    })
});

router.post('/staffs-orders-value', (req, res) => {
  var date = req.body.date;
  db.knex.raw(`SELECT sf.short_name, io.quantity, mi.price FROM item_orders io
LEFT JOIN menu_items mi ON io.item_code = mi.code
LEFT JOIN customer_tables ct ON ct.id = io.customer_table_id
LEFT JOIN tables t ON t.number = ct.table_number
LEFT JOIN staffs sf ON io.create_by = sf.id
LEFT JOIN shifts sh ON sh.id = ct.shift_id
WHERE t.outlet = 'customer' AND sh.detail = ? AND io.quantity != 0`, [date]).then(rawData => {
      res.json(rawData[0]);
    }).catch(e => {
      res.status(400).json({msg: 'Something went wrong!'});
      console.log(e);
    })
});




module.exports = router;
