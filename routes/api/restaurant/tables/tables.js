const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../../../database/index.js');
const socket = require('../../../../processes/utilities/socket-io.js');
const moment = require('moment');
const _ = require('lodash');

const { authentication } = require('../middlewares');

router.get('/getSomtumPrinter', async (req, res) => {
    const kitchen = await db.knex('printers').where({name: 'ครัวกลาง'}).then()
    const bbq = await db.knex('printers').where({name: 'BBQ'}).then()
    if(kitchen[0].ip_address === bbq[0].ip_address){
        res.json({value: 'บาร์น้ำ'})
    }else{
       res.json({value: 'ครัว'})
    }
})

router.post('/changeSomtumPrinter', async (req, res) => {
    try{
        const kitchen = await db.knex('printers').where({name: 'ครัวกลาง'}).then()
        const bbq = await db.knex('printers').where({name: 'BBQ'}).then()
         const bar = await db.knex('printers').where({name: 'บาร์น้ำ'}).then()
        if(kitchen[0].ip_address === bbq[0].ip_address){
            await db.knex('printers').where({name:'BBQ'}).update({ip_address: bar[0].ip_address}).then()
            res.json({value: 'ครัว'})
        }else{
            await db.knex('printers').where({name:'BBQ'}).update({ip_address: kitchen[0].ip_address}).then()
           res.json({value: 'บาร์น้ำ'})
        }
    }catch (e){
        console.log(e)
        res.json({value:'errer'})
    }
})

// TODO: Redefine SQL JOIN DONE
router.get('/history-tables', authentication, async (req, res) => {


    var customerTablesData = await db.knex.raw(`SELECT ct.id, ct.table_number, ct.number_of_guest, ct.language, ct.create_by
      from customer_tables ct
      LEFT JOIN shifts on shifts.id = ct.shift_id
      WHERE ct.status = 'paid' AND shifts.detail = ?`, [moment().format('DD/MM/YYYY')]).then(); //moment().format('DD/MM/YYYY')
    var staffsData = await db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').then();
    var refundData = await db.knex.raw(`SELECT refunds.customer_table_id, sum(amount) as refund_amount from refunds GROUP BY refunds.customer_table_id`).then();
    var discountData = await db.knex('customer_table_discount').then();
    var paymentData = await db.knex('payment').then();
    var multiplePaymentData = await db.knex('multiple_payment').then();

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
    let filteredPayment = {room_number: payment.room_number, total_amount: payment.total_amount, method: payment.method, payment_id: payment.id, service_charge_amount: payment.service_charge_amount}
    return Object.assign({}, table, filteredPayment)
  }).map((table, index) => {
    let payment = multiplePaymentData.filter(o => o.payment_id === table.payment_id.toString())
    let filteredPayment = {multiple_payment: payment}
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
    res.json({tables: response});
  })

  }else{
    res.json({tables: []});
  }

})


// TODO: Redefine SQL JOIN DONE
router.get('/', authentication, async (req, res) => {

  var sections = await db.knex('tables').select('section').groupBy('section').then()
  .catch(e => {
    console.log(e);
    res.status(400).json({msg: `Somthing went wrong!`})
  });

  var result = await Promise.all(await sections.map(async (sect) => {



  var tables = await db.knex('tables').where('section', sect.section).then();
  var customerTables = await db.knex('customer_tables').where('status', 'opened').orWhere('status', 'checked').then();
  var maxTime = await db.knex.raw(`SELECT cst.* FROM customer_table_status cst,
  (SELECT customer_table_id,  MAX(timestamp) as max_time FROM avatara_server.customer_table_status group by customer_table_id)
  max_cst
  where cst.customer_table_id = max_cst.customer_table_id and cst.timestamp = max_cst.max_time`).then();
  var minTime = await db.knex.raw(`SELECT customer_table_id, MIN(timestamp) as timestamp
  FROM customer_table_status group by customer_table_id`).then();


  const newOrderList = tables.map((table, index) => {
   let ctable = customerTables.find(o => o.table_number === table.number) || {id: null, table_number: null, number_of_guest: null, language: null, zone: null};
   return {...table, ...ctable}
 }).map((table, index) => {
   let mTime = maxTime[0].find(o => o.customer_table_id === table.id && o.status === table.status) || {customer_table_id: null, status: null, create_by: null, timestamp: null,detail: null};
   return {...table, ...mTime}
 }).map((table, index) => {
   let miTime = minTime[0].find(o => o.customer_table_id === table.id) || {customer_table_id: null};
   return {...table, ...miTime, id: miTime.customer_table_id}
 });
    // return {section: sect.section, tables:joinTables[0]}
    return {section: sect.section, tables:newOrderList}
  }))
  res.json(result);

})

router.get('/:id', authentication, async (req, res) => {
var table = await db.knex.raw('select tables.* , emp.short_name from tables left join staffs s on tables.hold_by = s.id left join employees emp on emp.id = s.id where tables.number = ?', [req.params.id]).then();
  if(table[0].length !== 0){
    res.json(table);
  }else{
    res.status(400).json({ msg: `No table with the number of ${req.params.id}` });
  }

})

router.put('/update-table-status', authentication, (req, res) =>{
  const {number, status, hold_by} = req.body;
  if(!number || !status){
    res.status(400).json({msg: `Please include all the attributes`});
  }else{
    db.knex('tables').where({number}).update({status, hold_by: hold_by}).then(data => {
      if(data == 0){
        res.status(400).json({msg:`Table is not found with number: ${newStaff.id}`})
      }else{
        res.json({msg:'Successfully updated tables status.'})
        socket.clientUpdateTables();
      }
    })
  }
})

router.post('/add', (req, res) =>{
  const {number, outlet, status, section} = req.body;
  if(!number || !outlet || !status || !section){
    res.status(400).json({msg: `Please include all the attributes`});
  }else{
    db.knex('tables').insert({
      number,
      outlet,
      status,
      section
    }).then(data => {
      res.json({msg:`Successfully add new table no.: ${number}`});
      socket.clientUpdateTables();
    })
    .catch(e => {
      console.log(e);
      res.status(400).send(4)
    })
  }

})


router.delete('/delete', (req, res) => {
  const {number} = req.body;
  db.knex('tables').where({number}).del()
  .then(data => res.json({msg: `Successfully deleted table no.: ${number}`}))
  .catch(e => res.status(400).send(e));
})

router.post('/reset-status', authentication, (req, res) => {
  const { user_id, passcode } = req.body;
  checkUser(user_id, passcode, (status) => {
    if(status){
      db.knex('tables').update({status:'available', hold_by: ''}).then(() => {
        res.json({status: true, msg: 'ทำการรีเซ็ทสถาณะของโต๊ะสำเร็จ'});
      })
    }else{
      res.json({status: false, msg: 'รหัสผ่านไม่ถูกต้อง'})
    }
  })
})

const checkUser = (user_id, passcode, callback) => {
  db.knex('staffs').where({id: user_id}).then((staffData) => {
    if(passcode !== ''){
      if(bcrypt.compareSync(passcode, staffData[0].passcode)){
        callback(true);
      }else{
        callback(false);
      }
    }else{
      callback(false);
    }
  });
}

module.exports = router;
