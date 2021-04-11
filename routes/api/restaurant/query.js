const express = require('express');
const router = express.Router();
const uuid = require('uuid');

const db = require('../../../database/index.js');

router.get('/', (req, res) => {
  db.knex.raw(`SELECT p.id, p.method, p.room_number as details,  ct.number_of_guest , ct.table_number, mi.name, ior.quantity, mi.price FROM avatara_server.customer_tables ct
    LEFT JOIN item_orders ior ON ct.id = ior.customer_table_id
    LEFT JOIN payment p ON ct.id = p.customer_table_id
    LEFT JOIN menu_items mi ON mi.code = ior.item_code
    LEFT JOIN shifts s ON ct.shift_id = s.id
    WHERE ct.status = 'paid' AND s.detail = '17/01/2020'
    `).then(rawData => {
      res.json(rawData[0]);
    }).catch(e => {
      res.status(400).json({msg: 'Something went wrong!'});
      console.log(e);
    })
});

router.post('/', (req, res) => {
  var date = req.body.date;
  db.knex.raw(`SELECT p.id, p.method, p.room_number as details,  ct.number_of_guest , ct.table_number, mi.name, ior.quantity, mi.price FROM avatara_server.customer_tables ct
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
  db.knex.raw(`select   t.number,  t.outlet, ct.number_of_guest, p.method, p.total_amount, p.discount_amount, s.period from shifts s
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
