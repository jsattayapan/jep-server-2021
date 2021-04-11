// Include the cluster module
var cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

  // Count the machine's CPUs
  var cpuCount = require('os').cpus().length;

  // Create a worker for each CPU
  for (var i = 0; i < cpuCount; i += 1) {
      cluster.fork();
  }

  // Listen for dying workers
cluster.on('exit', function (worker) {

    // Replace the dead worker,
    // we're not sentimental
    console.log('Worker %d died :(', worker.id);
    cluster.fork();

});

// Code to run if we're in a worker process
} else {
  const express = require('express');
  const path = require('path');
  const cors = require('cors');
  const http = require('http');
  const socketIO = require('./processes/utilities/socket-io.js');

  const port = 2222;

  const app = express();
  const server = http.createServer(app);
  socketIO.initSocket(server);



  // Body Parser Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }))

  app.use(cors());

  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  })

  app.use('/public/uploads', express.static('public/uploads'));

  app.use('/api/users/admins', require('./routes/api/users/admins'));
  app.use('/api/users/staffs', require('./routes/api/users/staffs').router);
  app.use('/api/restaurant/items/categories', require('./routes/api/restaurant/items/categories'));
  app.use('/api/utilities/printers', require('./routes/api/utilities/printers'));
app.use('/api/utilities/camera', require('./routes/api/utilities/camera'));
  app.use('/api/restaurant/items/menu-items', require('./routes/api/restaurant/items/menu-items'));
  app.use('/api/restaurant/tables/tables', require('./routes/api/restaurant/tables/tables'));
  app.use('/api/restaurant/tables/customer-tables',  require('./routes/api/restaurant/tables/customer-tables'));
  app.use('/api/restaurant/tables/item-orders', require('./routes/api/restaurant/tables/item-orders'));
  app.use('/api/restaurant/tables/order-status', require('./routes/api/restaurant/tables/order-status'));
  app.use('/api/restaurant/tables/shifts', require('./routes/api/restaurant/tables/shifts'));
  app.use('/api/restaurant/report', require('./routes/api/restaurant/report'));
  app.use('/api/hr/employees', require('./routes/api/hr/employees'));
  app.use('/api/hr/departments', require('./routes/api/hr/departments'));


  app.use((req, res, next) => {
    const error = new Error('Something went wrong!');
    error.status = 400;
    next(error);
  })

  app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({msg: error.message})
  })

  server.listen(port, () => {
    console.log(`Server is running on port ${port} || Cores: ${require('os').cpus().length}`);
    console.log('Wokring on cluster: ', cluster.worker.id);
  });
}
