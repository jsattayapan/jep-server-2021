const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../../database/index.js');


// var menuItems;

// (async () => {
//   const categories = await db.knex('categories').select('name').groupBy('name').then();
//   const sub_category = await db.knex('categories').then();
//   const items = await db.knex('menu_items').then();
// var result = [];
//   categories.forEach((cate) => {
//     var selected_sub = sub_category.filter(sub => sub.name == cate.name);
//
//     selected_sub = selected_sub.sort((a,b) => a.order_number - b.order_number);
//     const sub_result = [];
//     selected_sub.forEach((sub) => {
//       const seleted_item = items.filter(item => item.category_id == sub.id);
//       sub_result.push({sub_category: sub.food_type, items: seleted_item});
//     })
//     result.push({category: cate.name, sub_category: sub_result});
//   })
//   menuItems = result;
// })()

router.get('/', async (req, res) => {

  const categories = await db.knex('categories').select('name').groupBy('name').then();
  const sub_category = await db.knex('categories').then();
  const items = await db.knex('menu_items').then();
  var result = [];
  categories.forEach((cate) => {
    var selected_sub = sub_category.filter(sub => sub.name == cate.name);

    selected_sub = selected_sub.sort((a,b) => a.order_number - b.order_number);
    const sub_result = [];
    selected_sub.forEach((sub) => {
      const seleted_item = items.filter(item => item.category_id == sub.id);
      sub_result.push({sub_category: sub.food_type, items: seleted_item});
    })
    result.push({category: cate.name, sub_category: sub_result});
  })

res.json( await result);

})

router.get('/:id', async (req, res) => {
  const menuItem = await db.knex('menu_items').select('*')
  .where('id', '=', req.params.id)
  .then().catch(err => res.send(err));
  if(menuItem.length !== 0){
    res.json(menuItem[0]);
  }else{
    res.status(400).json({ msg: `No menu item with the id of ${req.params.id}` });
  }
})

router.post('/add', (req, res) => {
  const menuItemObject = createMenuItemObject(req.body);
  if(!menuItemObject.code || !menuItemObject.name ||
      !menuItemObject.english_name || !menuItemObject.category_id || !menuItemObject.price ||
      !menuItemObject.printer_ip_address || !menuItemObject.status || !menuItemObject.create_by){
        res.status(400).json({msg: 'Please include all parameters.'});
      }else{
        db.knex('menu_items').insert(menuItemObject)
        .then(data => res.json({msg:'Successfully add new food item'}))
        .catch(e => res.send(e));
      }
})

router.put('/update', (req, res) => {
  const menuItemObject = createMenuItemObject(req.body);
  if(!menuItemObject.code || !menuItemObject.name ||
      !menuItemObject.english_name || !menuItemObject.category_id || !menuItemObject.price ||
      !menuItemObject.printer_ip_address || !menuItemObject.status || !menuItemObject.create_by){
        res.status(400).json({msg: 'Please include all parameters.'});
      }else{
        db.knex('menu_items').where('code', '=', menuItemObject.code).update(menuItemObject)
        .then(data => {
          if(data == 0){
            res.status(404).json({msg: `Menu item is not found with id ${menuItemObject.id}`})
          }else{
            res.json({msg:'Successfully updated food item'})
          }
        })
        .catch(e => {
          console.log(e);
          res.send(e)}
        );
      }
})

router.put('/update-status', (req, res) =>{
  const {code, status} = req.body;
  if(!code || !status){
    res.status(400).json({msg: `Please include key of code and status!`});
  }else{
    db.knex('menu_items').where('code', '=', parseInt(code))
    .update({status}).then(data => {
      if(data == 0){
      res.status(404).json({msg: `Menu item is not found with id ${menuItemObject.id}`})
    }else{
      res.json({msg:'Successfully updated status food item'})
    }
    })
    .catch(e => {
      console.log(e);
      res.send(e)}
    );
  }
})

router.delete('/delete', (req, res) => {
  db.knex('menu_items').where('code', '=', req.body.code).del()
  .then(data => res.json({msg: `Successfully deleted menu item code: ${req.body.code}`}))
})

const createMenuItemObject = body =>{
  return {
    code: parseInt(body.code),
    name: body.name,
    english_name: body.english_name,
    category_id: body.category_id,
    price: parseFloat(body.price),
    printer_ip_address: body.printer_ip_address,
    status: body.status,
    create_by: body.create_by
  }
}

module.exports = router;
