var staff = require('./../../routes/api/users/staffs');
var { isShiftActived } = require('./helpers');
var highSocket;
var highIo;



function initSocket(server){
    highIo = require('socket.io')(server);
    highIo.set("transports", ["websocket"]);
    highIo.on('connection', function(socket){
    highSocket = socket;
    clientUpdateOrders();
    setTimeout(() => {
        clientUpdateTables();
    }, 1000)
    isShiftActived((status) => {
      if(!status){
        forceWaiterMobileLogout();
      }
    });

    var userId;
    socket.on('setUserId', (data) => {
      userId = data;
      console.log('SetUpId: ',userId);
    })
    socket.on('disconnect', () => {
      console.log('User disconnected!');
      console.log('Disconnect: ',userId);
      staff.logout(userId);
    })

    socket.on('clientCreateTable', () => {
      console.log('clientCreateTable!');
       highIo.emit('tableUpdate');
    })
      
    socket.on('error', function (err) {
        console.log(err);
    });
  })
 }


function clientUpdateTables(){
 console.log('tableUpdate Function');
 highIo.emit('tableUpdate');
}

function clientUpdateOrders(){
  console.log('updateOrders');
  highIo.emit('updateOrders');
}

function clientUpdateShift(){
console.log('shiftUpdate');
  highIo.emit('shiftUpdate');
}

function forceWaiterMobileLogout(){
console.log('forceWaiterMobileLogout');
  highIo.emit('forceWaiterMobileLogout');
}

function updateHistoryTables(){
console.log('historyTablesUpdate');
  highIo.emit('historyTablesUpdate');
}

module.exports = {
  initSocket,
  clientUpdateTables,
  clientUpdateOrders,
  clientUpdateShift,
  forceWaiterMobileLogout,
  updateHistoryTables
}
