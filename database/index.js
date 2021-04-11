const mysqldump = require('mysqldump');
const path = require('path');
// var knex = require('knex')({
//   client: 'sqlite3',
//   connection: {
//     filename: path.join(__dirname, 'restaurant-project.sqlite')
//   }
// })


var knex = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'mytaysql',
    database: 'avatara_server'
  }
})

var knexBackup = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'mytaysql',
    database: 'avatara_backup'
  }
})

var stockDB = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'mytaysql',
    database: 'stockunion'
  }
})

const something = 1;

const backupDatabase = () => {
  mysqldump({
      connection: {
          host: '127.0.0.1',
          user: 'root',
          password: 'mytaysql',
          database: 'avatara_backup',
      },
      dumpToFile: './dailyBackup.sql',
  });
}

module.exports ={
  knex, something, backupDatabase, knexBackup, stockDB
}
