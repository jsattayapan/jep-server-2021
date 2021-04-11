const jwt = require('jsonwebtoken');
const { jwtKey, secretkey } = require('../../../../constant');
const db = require('../../../../database/index.js');
const socket = require('../../../../processes/utilities/socket-io.js');

const authentication = (req, res, next) => {
  jwt.verify(req.headers.authentication, secretkey, function(err, decoded) {
    if(decoded.key === jwtKey){
      next();
    }else{
        res.status(403);
    }
  });
}

const isShiftActived = (req, res, next) => {
  socket.clientUpdateShift();
  db.knex('shifts').where({status: 'active'}).then(responseData => {
    if(responseData.length !== 0){
      next();
    }else{
      res.status(403).json({msg: 'ไม่สามารถทำรายการได้เนื่องจากไม่มีรอบในระบบที่เปิดอยู่'});
    }
  })
}

module.exports = {
  authentication,
  isShiftActived
}
