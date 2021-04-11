const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../../database/index.js');

router.get('/', (req, res) => {
  db.knex('categories').select('*').then(data => res.send(data))
  .catch(e => res.status(400).send(e));
})

router.get('/:id', async (req, res) => {
  const category = await db.knex('categories').where('id', '=', req.params.id)
  .then().catch(e => res.status(400).send(e));
  if(category.length == 0){
    res.status(404).json({msg: `category is not found with id ${req.params.id}`});
  }else{
    res.json(category[0]);
  }
})

router.post('/add', (req, res) => {
  const categoryObject = createCategoryObject(req.body);
  if(!categoryObject.name || !categoryObject.food_type){
    res.status(400).json({msg: `Please include the property 'name' and 'food_type'`});
  }else{
    db.knex('categories').insert(categoryObject)
    .then(data => res.json({msg: `Successfully add new category`}))
    .catch(e => res.status(400).send(e))
  }
})

router.put('/update', (req, res) => {
  const categoryObject = createCategoryObject(req.body);
  if(!categoryObject.name || !categoryObject.food_type){
    res.status(400).json({msg: `Please include the property 'name' and 'food_type'`});
  }else{
    db.knex('categories').where('id', '=', categoryObject.id)
    .update(categoryObject)
    .then(data => {
      if(data == 0){
        res.status(404).json({msg: `Category is not found with id ${categoryObject.id}`})
      }else{
        res.json({msg: `Successfully updated category`})
      }
    })
    .catch(e => res.status(400).send(e))
  }
})

router.delete('/delete', (req, res) => {
  db.knex('categories').where('id', '=', req.body.id).del()
  .then(data => res.json({msg: `Successfully deleted category`}))
  .catch(e => res.status(400).send(e))
});

const createCategoryObject = body => {
  return {
    id: body.id || uuid.v4(),
    name: body.name,
    food_type: body.food_type
  }
}

module.exports = router;
