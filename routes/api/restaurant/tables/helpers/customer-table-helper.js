const db = require('../../../../../database/index.js');

async function isTableOccupied(table_number){
  const table = await db.knex('tables').where({number: table_number}).then();
  if(table[0].status != 'available'){
    return true;
  }else{
    return false;
  }
}

async function updateTableStatus(number, status){
  await db.knex('tables').where({number}).update({status}).then();
}

module.exports = {
  isTableOccupied,
  updateTableStatus
}
