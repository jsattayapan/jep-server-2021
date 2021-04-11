const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../database/index.js');
const path = require('path');

router.get('/', (req, res) => {
  db.knex('departments').then(data => {
    res.json({status: true, payload:data});
  }).catch(e => {
    console.log(e);
      res.json({status: false, msg: 'เกิดข้อผิดพลาดในระบบ'})
  })
})


module.exports = router;
