const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../../database/index.js');

router.get('/', (req, res) => {
  db.knex('item_status').select('*').then(data => res.send(data))
  .catch(e => res.status(400).send(e));
})

router.get('/:id', async (req, res) => {
  const itemStatus = await db.knex('item_status').where('id', '=', req.params.id)
  .then().catch(e => res.status(400).send(e));
  if(itemStatus.length == 0){
    res.status(404).json({msg: `Item status is not found with id ${req.params.id}`});
  }else{
    res.json(itemStatus[0]);
  }
})

router.post('/add', (req, res) => {
  const itemStatusObject = createItemStatusObject(req.body);
  if(!itemStatusObject.status){
    res.status(400).json({msg: `Please include the property 'status'`};)
  }else{
    db.knex('item_status').insert(itemStatusObject)
    .then(data => res.json({msg: `Successfully add new status`}))
    .catch(e => res.status(400).send(e))
  }
})

router.put('/update', (req, res) => {
  const itemStatusObject = createItemStatusObject(req.body);
  if(!itemStatusObject.status){
    res.status(400).json({msg: `Please include the property 'status'`};)
  }else{
    db.knex('item_status').where('id', '=', itemStatusObject.id)
    .update(itemStatusObject)
    .then(data => {
      if(data == 0){
        res.status(404).json({msg: `Item status is not found with id ${itemStatusObject.id}`})
      }else{
        res.json({msg: `Successfully updated item status`})
      }
    })
    .catch(e => res.status(400).send(e))
  }
})

router.delete('/delete', (req, res) => {
  db.knex('item_status').where('id', '=', req.body.id).del()
  .then(data => res.json({msg: `Successfully deleted item status`}))
  .catch(e => res.status(400).send(e))
});

const createItemStatusObject = body => {
  return {
    id: body.id || uuid.v4(),
    status: body.status
  }
}

module.exports = router;
