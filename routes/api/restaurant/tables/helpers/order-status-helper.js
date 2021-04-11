const db = require('../../../../../database/index.js');
const socket = require('../../../../../processes/utilities/socket-io.js');

async function createItemOrderStatus(id, status, create_by, detail = null, quantity = null, timestamp = new Date()){
  return await db.knex('item_order_status').insert({
    item_order_id: id,
    status,
    create_by,
    detail,
    quantity,
    timestamp
  })
  .then(data => {
    socket.clientUpdateOrders();
  })
  .catch(e => e)
}

async function getOrderInfor(itemOrderObject, outlet){
  const {id, item_code, customer_table_id, quantity, remark, create_by} = itemOrderObject;

  const customerTable = await db.knex('customer_tables')
  .where({id: customer_table_id}).then();
  const {table_number, zone} = customerTable[0];

  const staff = await db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').where('staffs.id', '=', create_by).then();
  const {short_name} = staff[0];

  const priceType = outlet === 'staff' ? 'menu_items.staff_price' : 'menu_items.price';
  const menu = await db.knex.select('menu_items.name', priceType, 'printers.ip_address').from('menu_items').leftJoin('printers', 'printers.id', 'menu_items.printer')
  .where({code: item_code}).then();
  const price = menu[0].price || menu[0].staff_price;
  const {name, ip_address} = menu[0];

  const orderStatus = await db.knex('item_order_status')
  .where({item_order_id: id, status: 'sent'}).then();
  const {timestamp} = orderStatus[0];

  return {
    table_number, zone, create_by: short_name, time: timestamp,
    name, quantity, price, remark, printer_ip_address: ip_address
  }

}

function dateFormat(timestamp){
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
}

module.exports = {
  createItemOrderStatus,
  getOrderInfor
}
