const express = require('express');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../../../database/index.js');
const jwt = require('jsonwebtoken');
const { authentication } = require('./../restaurant/middlewares');

const { jwtKey, secretkey } = require('../../../constant');

router.get('/', (req, res) => {
  db.knex('staffs AS sf').select('sf.*', 'emp.name', 'emp.short_name', 'dept.position', 'dept.id AS dept_id')
  .leftJoin('employees AS emp', 'sf.id', 'emp.id')
  .leftJoin('departments AS dept', 'dept.id', 'emp.dept_id')
  .then(data => res.json(data))
  .catch(err => res.send(err));
})

router.get('/:id', (req, res) => {
  db.knex('employees')
  .leftJoin('departments', 'departments.id', 'employees.dept_id')
  .where('employees.id', req.params.id)
  .then((responseData) => {
    if(responseData.length !== 0){
      res.json({
        name: responseData[0].name,
        short_name: responseData[0].short_name,
        position: responseData[0].position,
      })
    }else{
      res.json({status: false, msg: 'ไม่พบข้อมูล'});
    }
  }).catch(e => {
    console.log(e);
    res.json({status: false, msg: 'ไม่พบข้อมูล'});
  })
});

router.post('/login', (req, res) => {
  if(req.body.number == "" || req.body.passcode == ""){
    res.status(404).json({ msg: `ข้อมูลไม่ถูกต้อง!` });
  }else{
    const number = parseInt(req.body.number);
    if(!isNaN(number)){
      db.knex('staffs AS sf').select('sf.*', 'emp.name', 'emp.short_name', 'dept.position', 'dept.id AS dept_id')
      .leftJoin('employees AS emp', 'sf.id', 'emp.id')
      .leftJoin('departments AS dept', 'dept.id', 'emp.dept_id')
      .where('number', '=', parseInt(req.body.number))
      .then(data => {
        if(data.length !== 0){
          if(bcrypt.compareSync(req.body.passcode, data[0].passcode)){
            if(req.body.platform == 'web-app-cashier'){
              if(data[0].dept_id == 'fbch'){
                db.knex('user_signed_in').where({user_id: data[0].id})
                .then(signInData => {
                  if(signInData.length == 0){
                    //Pass
                    db.knex('user_signed_in').insert({user_id: data[0].id}).then();
                    var user = data[0];
                    jwt.sign({key: jwtKey}, secretkey, (err, token) => {
                      delete user.passcode;
                      user.token = token;
                      res.json(user);
                    })
                  }else{
                    res.status(400).json({msg: 'บัญชีนี้กำลังถูกใช้ในระบบ!'});
                  }
                })
                .catch(err => {
                  res.status(400).json({msg: 'เกิดข้อผิดพลาดในระบบ!'})
                });
              }else{
                res.status(400).json({msg: 'บัญชีนี้ไม่สามารถใช้บนระบบแคชเชียได้!'});
              }
            }else if(req.body.platform == 'mobile-app-waiter'){
              //Pass
              db.knex('shifts').where({status: 'active'}).then((shiftData) => {
                if(shiftData.length !== 0){
                  if(data[0].dept_id == 'fbch' || data[0].dept_id == 'fbwt'){
                    db.knex('user_signed_in').where({user_id: data[0].id})
                    .then(signInData => {
                      if(signInData.length == 0){
                        db.knex('user_signed_in').insert({user_id: data[0].id}).then();
                        var user = data[0];
                        jwt.sign({key: jwtKey}, secretkey, (err, token) => {
                          delete user.passcode;
                          user.token = token;
                          res.json(user);
                        })
                      }else{
                        res.status(400).json({msg: 'บัญชีนี้กำลังถูกใช้ในระบบ!'})
                      }
                    })
                    .catch(err => res.status(400).json({msg: 'เกิดข้อผิดพลาดในระบบ!'}));
                  }else{
                      res.status(400).json({msg: 'บัญชีนี้ไม่สามารถใช้บนระบบรับออร์เดอร์ได้!'});
                  }
                }else{
                  res.status(400).json({msg: 'ไม่สามารถเข้าระบบได้เนื่องจากรอบในระบบยังไม่ถูกเปิด!'});
                }
              })
            }else if(req.body.platform == 'mobile-app-checker'){
              if(data[0].dept_id == 'ktck'){
                db.knex('user_signed_in').insert({user_id: data[0].id}).then();
                var user = data[0];
                jwt.sign({key: jwtKey}, secretkey, (err, token) => {
                  delete user.passcode;
                  user.token = token;
                  res.json(user);
                })
              }else{
                  res.status(400).json({msg: 'บัญชีนี้ไม่สามารถใช้บนระบบเช็คออร์เดอร์ได้!'});
              }
            }else {
                res.status(400).json({msg: 'สิทธิ์ในการเข้าระบบไม่ถูกต้อง!'});
            }
          }else{
            res.status(400).json({msg: 'ข้อมูลไม่ถูกต้อง!'});
          }
        }else{
          res.status(400).json({msg: 'ข้อมูลไม่ถูกต้อง!'});
        }
      })
      .catch(err => res.status(400).json({msg: err}));
    }else{
      res.status(400).json({msg: 'ข้อมูลไม่ถูกต้อง!'});
    }
  }
});


 router.post('/add', (req, res) => {
   const newStaff = createStaffObject(req.body);
   newStaff.timestamp = new Date();
   if(!newStaff.name || !newStaff.short_name ||
      !newStaff.position || !newStaff.passcode || !newStaff.number){
     return res.status(400).json({msg: 'Please include all parameters.', payload: newStaff});
   }else{
       var staffTable = {
           id: newStaff.id,
           passcode: newStaff.passcode,
           timestamp: newStaff.timestamp,
           number: newStaff.number,

       }
       var employeeTable = {
           id: newStaff.id,
           name: newStaff.name,
           short_name: newStaff.short_name,
           dept_id: newStaff.position
       }
     db.knex('staffs').insert(staffTable)
     .then(data => {
         db.knex('employees').insert(employeeTable).then(data => {
             res.json({msg:'Successfully added new staff'})
            })
     })
     .catch(err => res.send(err));
   }
 });

// router.put('/update', (req, res) => {
//   const newStaff = createStaffObject(req.body);
//   if(!newStaff.id || !newStaff.name || !newStaff.short_name ||
//      !newStaff.position || !newStaff.passcode || !newStaff.number){
//     return res.status(400).json({msg: 'Please include all parameters.'});
//   }else{
//     db.knex('staffs')
//     .where('id', '=', newStaff.id)
//     .update(newStaff)
//     .then(data => {
//       if(data == 0){
//         res.status(400).json({msg:`Staff is not found with id: ${newStaff.id}`})
//       }else{
//         res.json({msg:'Successfully updated staff.'})
//       }
//     })
//     .catch(err => res.send(err));
//   }
// });

// router.delete('/delete', (req, res) => {
//   if(!req.body.id){
//     return res.status(400).json({msg: 'Please include id'});
//   }else{
//     db.knex('staffs').where('id', '=', req.body.id).del()
//     .then(data => res.json({msg:'Successfully deleted staff'}))
//     .catch(err => res.send(err));
//   }
// })

router.post('/logout', (req, res) => {
  logout(req.body.id);
})

router.get('/is-sign-in/:id', (req, res) => {
  db.knex('user_signed_in').where({user_id : req.params.id}).then(data => {
    data.length !== 0 ? res.json({result: true}) : res.json({result: false});
  })
  .catch(err => console.log(err));
});

router.post('/reset-signed-in', authentication, (req, res) => {
  const { user_id, passcode } = req.body;
  checkUser(user_id, passcode, (status) => {
    if(status){
      db.knex('user_signed_in').del().then(() => {
        res.json({status: true, msg: 'ทำการรีเซ็ทสถาณะของผู้ใช้สำเร็จ'});
      })
    }else{
      res.json({status: false, msg: 'รหัสผ่านไม่ถูกต้อง'})
    }
  })
})


//*********** Functions ***********//
const createStaffObject = (body) => {
  const hash = bcrypt.hashSync(body.passcode, 10);
  return{
    id: body.id || uuid.v4(),

    name: body.name,
    short_name: body.short_name,
    position: body.position,
    number: parseInt(body.number),
    passcode: hash
  }
}

async function logout(user_id){
  if(user_id){
  await db.knex('user_signed_in').where({user_id}).del().then();
  await db.knex('tables').where({hold_by: user_id}).update({status: 'available', hold_by: null}).then();
  }
}

 function getSignInUser(user_id, callback){
  db.knex('user_signed_in').where({user_id}).then(data => {
    callback(data.length);
  })
  .catch(err => console.log(err));
}

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

module.exports = {
  router,
  logout
}
