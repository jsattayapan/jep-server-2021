const db = require('../../database/index.js');

const isShiftActived = (callback) => {
  db.knex('shifts').where({status: 'active'}).then(responseData => {
    if(responseData.length !== 0){
      callback(true);
    }else{
      callback(false);
    }
  })
}


module.exports = {
  isShiftActived
}
