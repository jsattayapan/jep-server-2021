const express = require('express');
const router = express.Router();
const db = require('../../../database/index.js');

router.get('/', (req, res) => {
  db.knex('printers').select('*').then(data => res.json(data))
  .catch(e => res.status(400).json(e));
})



router.post('/add', (req, res) => {
  const printerObject = createPrinterObject(req.body);
  if(!printerObject.ip_address || !printerObject.name){
    res.status(400).json({msg: 'Please include all parameters.'});
  }else{
    db.knex('printers').insert(printerObject)
    .then(data => res.json({msg: 'New printer is added.'}))
    .catch(e => {
      console.log(e);
      res.send(e);
    });
  }
})

router.put('/update', (req, res) => {
  const printerObject = createPrinterObject(req.body);
  if(!printerObject.ip_address || !printerObject.name){
    res.status(400).json({msg: 'Please include all parameters.'});
  }else{
    db.knex('printers').where('ip_address', '=', printerObject.ip_address)
    .update(printerObject).then(data => {
      if(data == 0){
        res.status(404).json({msg: `Cannot find printer with ip address: ${printerObject.ip_address}`})
      }else{
        res.json({msg: 'Printer is updated.'})
      }
    }).catch(e => res.status(404).send(e))
  }
})

router.delete('/delete', (req, res) => {
  db.knex('printers').where('ip_address','=', req.body.ip_address).del()
  .then(data => res.json({msg: `Printer is deleted.`}))
  .catch(e => res.status(400).json(e))
})

const createPrinterObject = body => {
  return {
    ip_address: body.ip_address,
    name: body.name
  }
}

module.exports = router;
