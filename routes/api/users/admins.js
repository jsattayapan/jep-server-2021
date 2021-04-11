const express = require('express');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../../../database/index.js');
const jwt = require('jsonwebtoken');

router.get('/', (req, res) => {
  db.knex('admins').select('*')
  .then(data => res.json(data))
  .catch(err => res.send(err));
})

router.post('/login', async (req, res) => {
  console.log(req.body.username);
  const admin = await db.knex('admins').select('*')
  .where('username', '=', req.body.username)
  .then().catch(err => res.send(err));
  if(admin.length !== 0){
    if(bcrypt.compareSync(req.body.password,
      admin[0].password)){
        var userInfo = await db.knex('employees').where('id', admin[0].id);
        var user = {
          id: admin[0].id,
          name: userInfo[0].name,
          short_name: userInfo[0].short_name,
          position: admin[0].position,
          username: admin[0].username
        }
        jwt.sign({user: user}, 'secretkey', (err, token) => {
          user.token = token;
          res.json({status: true, user});
        })
    }else{
      res.json({ status: false, msg: `No match.` });
    }
  }else{
    res.json({ status: false,  msg: `Admin not found.` });
  }
})

router.post('/add', (req, res) => {
  const newAdmin = createAdminObject(req.body);
  newAdmin.timestamp = new Date();
  if(!newAdmin.name || !newAdmin.short_name
    || !newAdmin.level || !newAdmin.username || !newAdmin.password){
      return res.status(400).json({msg: 'Please include all parameters.'});
    }else{
      db.knex('admins').insert(newAdmin)
      .then(data => res.json({msg:'Successfully add new Admin'}))
      .catch(err => {
        console.log(err);
        res.send(err)
      });
    }
});

router.put('/update', (req, res) => {
  const updateAdmin = createAdminObject(req.body);
  if(!updateAdmin.name || !updateAdmin.short_name
    || !updateAdmin.level || !updateAdmin.username || !updateAdmin.password){
      return res.status(400).json({msg: 'Please include all parameters.'});
    }else{
      db.knex('admins').where('id', '=', updateAdmin.id)
      .update(updateAdmin)
      .then(data => {
        if(data == 0){
          res.status(400).json({msg: `Admin is not found with id: ${updateAdmin.id}`})
        }else{
          res.json({msg:'Successfully update Admin'})
        }
      })
      .catch(err => res.send(err));
    }
})

router.delete('/delete', (req, res) => {
  if(!req.body.id){
    return res.status(400).json({msg: 'Please include id'});
  }else{
    db.knex('admins').where('id', '=', req.body.id).del()
    .then(data => res.json({msg:'Successfully delte Admin'}))
    .catch(err => res.send(err));
  }
})


// ********** Function ****************//
const createAdminObject = (body) => {
  const hash = bcrypt.hashSync(body.password, 10);
  return {
    id: body.id || uuid.v4(),
    name: body.name.trim(),
    short_name: body.short_name.trim(),
    level: parseInt(body.level),
    username: body.username.trim(),
    password: hash
  }
}

module.exports = router;
