const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../../../database/index.js');
const socket = require('../../../../processes/utilities/socket-io.js');
const moment = require('moment');
const printer = require('../../../../processes/utilities/printer.js');
const { authentication } = require('../middlewares');
const nodemailer = require('./helpers/nodemailer');
const line = require('./helpers/line');
const uniqid = require('uniqid')

router.get('/current-shift', (req, res) => {
  db.knex('shifts').where({status: 'active'}).then(shiftResponse => {
    if(shiftResponse.length != 0){
      res.json({status: 'active', period: shiftResponse[0].period});
    }else{
      res.json({status: 'inactive'});
    }
  }).catch(err => {
    console.log(err);
    res.status(401);
  })
});

router.post('/active-morning-shift', authentication, async (req, res) => {
  const {user_id} = req.body;
  try{
    let shifts = await db.knex('shifts').where({status: 'active'}).orWhere({detail: `${moment().format('DD/MM/YYYY')}`})
    if(shifts.length === 0){
      const now = new Date();
      await db.knex('shifts').insert({
        status: 'active',
        open_at: now,
        open_by: user_id,
        detail: `${moment().format('DD/MM/YYYY')}`,
        period: 'morning'
      })
      socket.clientUpdateShift();
      res.json({status: true, msg:'Succesfully active morning shift.'})
    }else{
      res.json({status: false, msg: 'ไม่สามารถเปิดรอบเช้าได้ เนื่องจากชิฟเช้าของวันนี้ได้ถูกเปิดไปแล้ว'});
    }
  } catch(e){
    console.log(e);
    res.json({status: false, msg: 'เกิดข้อผิดพลาดในระบบ'});
  }

  // db.knexBackup('shifts').where({status: 'active'}).orWhere({detail: `${moment().format('DD/MM/YYYY')}`}).then(shiftResponse => {
  //   if(shiftResponse.length == 0){
  //     const now = new Date();
  //     db.knex('shifts').insert({
  //       status: 'active',
  //       open_at: now,
  //       open_by: user_id,
  //       detail: `${moment().format('DD/MM/YYYY')}`,
  //       period: 'morning'
  //     }).then(() => {
  //       socket.clientUpdateShift();
  //       res.json({status: true, msg:'Succesfully active morning shift.'})
  //     })
  //   }else{
  //     res.json({status: false, msg: 'ไม่สามารถเปิดรอบเช้าได้ เนื่องจากชิฟเช้าของวันนี้ได้ถูกเปิดไปแล้ว'});
  //   }
  // }).catch(err => {
  //   console.log(err);
  //   res.status(401);
  // })
})

router.post('/save-afternoon-shift', authentication, async (req, res) => {
  const {user_id, passcode} = req.body;

  try{
    let cutData = await db.knex('customer_tables').whereNot({status: 'paid'})
    if(cutData.length === 0){
      checkUser(user_id, passcode, async result => {
        if(result){
          let shiftsData = await db.knex('shifts').where({status: 'active', period: 'afternoon'})
          if(shiftsData.length === 1){
            const shiftId = shiftsData[0].id;
            const openAt = shiftsData[0].open_at;
            const detail = shiftsData[0].detail;
            const now = new Date();
            printShiftInfo(shiftId, openAt, now, user_id, 'รอบบ่าย');
            await db.knex('shifts').where({id: shiftId}).update({status: 'inactive', close_by: user_id, close_at: now})
            socket.forceWaiterMobileLogout();
            socket.clientUpdateShift();

            const discount = await db.knex('customer_table_discount');
            const table_status = await db.knex('customer_table_status');
            const tables = await db.knex('customer_tables')
            const item_status = await db.knex('item_order_status')
            const item_transfer = await db.knex('item_order_transfer')
            const orders = await db.knex('item_orders')
            const payments = await db.knex('payment')
            const shifts = await db.knex('shifts')
            const menu_items_backup = await db.knex('menu_items')

            const employees = await db.knex('employees')
            const staffs = await db.knex('staffs')

            const multiple_payment = await db.knex('multiple_payment')



            await db.knexBackup('employees').del()
            await db.knexBackup('staffs').del()
            await db.knexBackup('employees').insert(employees)
            console.log('employees');
            await db.knexBackup('staffs').insert(staffs)
            console.log('staffs');

            await db.knexBackup('menu_items').del()
            await db.knexBackup('menu_items').insert(menu_items_backup)
            console.log('menu_items_backup');

            await db.knexBackup('multiple_payment').insert(multiple_payment)

            await db.knexBackup('customer_table_discount').insert(discount)
            console.log('discount');
            await db.knexBackup('customer_table_status').insert(table_status)
            console.log('table_status');
            await db.knexBackup('customer_tables').insert(tables)
            console.log('tables');
            await db.knexBackup('item_order_status').insert(item_status)
            console.log('item_status');
            await db.knexBackup('item_order_transfer').insert(item_transfer)
            console.log('item_transfer');

            await db.knexBackup('item_orders').insert(orders)
            console.log('orders');
            await db.knexBackup('payment').insert(payments)
            console.log('console.log(1);');
            await db.knexBackup('shifts').insert(shifts)
            console.log('shifts');

            await db.knex('customer_table_discount').del()
            await db.knex('customer_table_status').del()
            await db.knex('customer_tables').del()
            await db.knex('item_order_status').del()
            await db.knex('item_order_transfer').del()
            await db.knex('item_orders').del()
            await db.knex('payment').del()
            await db.knex('shifts').del()
            await db.knex('multiple_payment').del()

            prepareDailyReport(detail);
            var sentencesRandom = [
              'ขอบคุณสำหรับการทำงานวันนี้นะครับ',
              'เดินทางกลับบ้านปลอดภัยนะครับ',
              'พักผ่อนเยอะๆนะครับ',
              'ดูแลสุขภาพด้วยนะครับ',
            ]
            var selectedSentence = sentencesRandom[Math.floor(Math.random() * sentencesRandom.length)];
            if(now.getDate() === 29 || now.getDate() === 1){
              var firstNumber = thaiWordNumber(Math.floor(Math.random() * 10));
              var secondNumber = thaiWordNumber(Math.floor(Math.random() * 10));
              selectedSentence = `วันนี้มาใบ้หวยเบาๆ (${firstNumber} ${secondNumber})... อย่าบอกใครหล่ะ ^_^!`
            }
            res.json({status: true, msg:`ชิฟรอบเย็นถูกบันทึก สิ้นสุดการทำงาน \n ${selectedSentence}`});

          }else{
            res.json({status: false, msg: 'ไม่มี Shift ที่เปิดอยู่ ณ ตอนนี้'});
            return
          }
        }else{
          res.json({status:false, msg: 'รหัสไม่ถูกต้อง'});
          return
        }
      })
    }else{
      res.json({status:false, msg: 'ยังมีโต๊ะที่ยังไม่ได้เก็บเงิน'});
      return
    }
  }catch(e){
    console.log(e);
    res.json({status:false, msg: 'เกิดข้อผิดพลาดในระบบ'});
  }

  // db.knex('customer_tables').whereNot({status: 'paid'}).then((cutData) => {
  //   if(cutData.length === 0){
  //     checkUser(user_id, passcode, (result) => {
  //       if(result){
  //         db.knex('shifts').where({status: 'active', period: 'afternoon'}).then(shiftResponse => {
  //           if(shiftResponse.length === 1){
  //            const shiftId = shiftResponse[0].id;
  //            const openAt = shiftResponse[0].open_at;
  //               const detail = shiftResponse[0].detail;
  //            const now = new Date();
  //             printShiftInfo(shiftId, openAt, now, user_id, 'รอบบ่าย');
  //            db.knex('shifts').where({id: shiftId}).update({status: 'inactive', close_by: user_id, close_at: now}).then(async () => {
  //              socket.forceWaiterMobileLogout();
  //              socket.clientUpdateShift();
  //
  //              const discount = await db.knex('customer_table_discount');
  //              const table_status = await db.knex('customer_table_status');
  //              const tables = await db.knex('customer_tables')
  //              const item_status = await db.knex('item_order_status')
  //              const item_transfer = await db.knex('item_order_transfer')
  //              const orders = await db.knex('item_orders')
  //              const payments = await db.knex('payment')
  //              const shifts = await db.knex('shifts')
  //              const menu_items_backup = await db.knex('menu_items')
  //
  //              await db.knexBackup('menu_items').del()
  //
  //              await db.knexBackup('menu_items').insert(menu_items_backup)
  //              for(const x of menu_items_backup){
  //                await db.knexBackup('menu_items').insert(x)
  //              }
  //
  //              for(const x of discount){
  //                await db.knexBackup('customer_table_discount').insert(x)
  //              }
  //
  //              for(const x of table_status){
  //                await db.knexBackup('customer_table_status').insert(table_status)
  //              }
  //
  //              for(const x of tables){
  //                await db.knexBackup('customer_tables').insert(tables)
  //              }
  //
  //              for(const x of item_status){
  //                await db.knexBackup('item_order_status').insert(item_status)
  //              }
  //
  //              for(const x of item_transfer){
  //                await db.knexBackup('item_order_transfer').insert(item_transfer)
  //              }
  //
  //              for(const x of orders){
  //                await db.knexBackup('item_orders').insert(orders)
  //              }
  //
  //              for(const x of payments){
  //                await db.knexBackup('payment').insert(payments)
  //              }
  //
  //              for(const x of shifts){
  //                await db.knexBackup('shifts').insert(shifts)
  //              }
  //
  //
  //                 await db.knex('customer_table_discount').del()
  //                 await db.knex('customer_table_status').del()
  //                 await db.knex('customer_tables').del()
  //                 await db.knex('item_order_status').del()
  //                 await db.knex('item_order_transfer').del()
  //                 await db.knex('item_orders').del()
  //                 await db.knex('payment').del()
  //                 await db.knex('shifts').del()
  //
  //
  //
  //              prepareDailyReport(detail);
  //
  //
  //              var sentencesRandom =[
  //                'ขอบคุณสำหรับการทำงานวันนี้นะครับ',
  //                'เดินทางกลับบ้านปลอดภัยนะครับ',
  //                'พักผ่อนเยอะๆนะครับ',
  //                'ดูแลสุขภาพด้วยนะครับ',
  //              ]
  //              var selectedSentence = sentencesRandom[Math.floor(Math.random() * sentencesRandom.length)];
  //              if(now.getDate() === 29 || now.getDate() === 1){
  //                var firstNumber = thaiWordNumber(Math.floor(Math.random() * 10));
  //                var secondNumber = thaiWordNumber(Math.floor(Math.random() * 10));
  //                selectedSentence = `วันนี้มาใบ้หวยเบาๆ (${firstNumber} ${secondNumber})... อย่าบอกใครหล่ะ ^_^!`
  //              }
  //              res.json({status: true, msg:`ชิฟรอบเย็นถูกบันทึก สิ้นสุดการทำงาน \n ${selectedSentence}`});
  //            })
  //          }else{
  //            res.json({status: false, msg: 'ไม่มี Shift ที่เปิดอยู่ ณ ตอนนี้'});
  //          }
  //        });
  //      }else{
  //        res.json({status:false, msg: 'รหัสไม่ถูกต้อง'});
  //      }
  //    });
  //   }else{
  //     res.json({status:false, msg: 'ยังมีโต๊ะที่ยังไม่ได้เก็บเงิน'});
  //   }
  // })
});


async function prepareDailyReport(detailOfDay){
  const multiplePayment = await db.knexBackup('multiple_payment')
  var url = `SELECT *
     FROM customer_tables ct
     LEFT JOIN shifts ON shifts.id = ct.shift_id
     LEFT JOIN payment pay ON ct.id = pay.customer_table_id
     LEFT JOIN (SELECT refunds.customer_table_id, sum(amount) as refund_amount from refunds GROUP BY refunds.customer_table_id) rr ON ct.id = rr.customer_table_id
     LEFT JOIN tables ON ct.table_number = tables.number
     WHERE shifts.detail = ? AND (tables.outlet = 'customer' OR tables.outlet = 'staff')`;
     db.knexBackup.raw(url, [detailOfDay]).then((rawData) => {
       var payments = rawData[0];
        var morning_payment = payments.filter(payment => payment.period === 'morning');
        var afternoon_payment = payments.filter(payment => payment.period === 'afternoon');
       if(payments.length !== 0){
         var total_amount = payments.reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)
         var total_cash = payments.filter(payment => payment.method === 'cash').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)

         var total_service_charge = payments.reduce((total, pt) => {
           return total + pt.service_charge_amount
         }, 0)


         // Reduce Total Cash by Service Charge
         total_amount = total_amount - total_service_charge
         total_cash = total_cash - total_service_charge


         var morning_cash = morning_payment.filter(payment => payment.method === 'cash').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)

         let morningMultiplePayment = []
         let afternoonMultiplePayment = []

         multiplePayment.forEach(mPayment => {
           morning_payment.forEach(mnPayment => {
             if(mPayment.payment_id === mnPayment.id.toString()){
               morningMultiplePayment = [ ...morningMultiplePayment, mPayment]
             }
           })
           afternoon_payment.forEach(mnPayment => {
             if(mPayment.payment_id === mnPayment.id.toString()){
               afternoonMultiplePayment = [ ...afternoonMultiplePayment, mPayment]
             }
           })
         })

         let transferSumM = 0
         let creditCardSumM = 0
         let halfHalfSumM = 0
         let GWalletSumM = 0
         let ThaiChanaSumM = 0
         let cashSumM = 0

         morningMultiplePayment.forEach(pt => {
           if(pt.paymentType === 'cash'){
             cashSumM += pt.amount
           }
           if(pt.paymentType === 'creditCard'){
             creditCardSumM += pt.amount
           }
           if(pt.paymentType === 'halfHalf'){
             halfHalfSumM += pt.amount
           }
           if(pt.paymentType === 'transfer'){
             transferSumM += pt.amount
           }
           if(pt.paymentType === 'G-Wallet'){
             GWalletSumM += pt.amount
           }
           if(pt.paymentType === 'ThaiChana'){
             ThaiChanaSumM += pt.amount
           }
         })

         let transferSumA = 0
         let creditCardSumA = 0
         let halfHalfSumA = 0
         let GWalletSumA = 0
         let ThaiChanaSumA = 0
         let cashSumA = 0

         afternoonMultiplePayment.forEach(pt => {
           if(pt.paymentType === 'cash'){
             cashSumA += pt.amount
           }
           if(pt.paymentType === 'creditCard'){
             creditCardSumA += pt.amount
           }
           if(pt.paymentType === 'halfHalf'){
             halfHalfSumA += pt.amount
           }
           if(pt.paymentType === 'transfer'){
             transferSumA += pt.amount
           }
           if(pt.paymentType === 'G-Wallet'){
             GWalletSumA += pt.amount
           }
           if(pt.paymentType === 'ThaiChana'){
             ThaiChanaSumA += pt.amount
           }
         })

         var afternoon_cash = afternoon_payment.filter(payment => payment.method === 'cash').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)


         // Update cash_sale_balance
         db.stockDB('account_balance').where({name: 'รายได้เงินสด'}).increment({amount: total_cash}).then()

         db.stockDB('cash_sale_histrory').insert({date: detailOfDay, detail: 'เงินสดรายวัน ร้านอาหารเจี๊ยบ', type: 'in', timestamp: new Date(), amount: total_cash, createBy :'olotem321'}).then()

         morning_cash += cashSumM
         afternoon_cash += cashSumA

         var total_card = payments.filter(payment => payment.method === 'card').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0) + creditCardSumA + creditCardSumM
         var morning_card = morning_payment.filter(payment => payment.method === 'card').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)+ creditCardSumM
         var afternoon_card = afternoon_payment.filter(payment => payment.method === 'card').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0)+ creditCardSumA
         var total_transfer = payments.filter(payment => payment.method === 'transfer').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0) + transferSumA + transferSumM
         var morning_transfer = morning_payment.filter(payment => payment.method === 'transfer').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0) + transferSumM
         var afternoon_transfer = afternoon_payment.filter(payment => payment.method === 'transfer').reduce((total, payment) => {
           return total + payment.total_amount
         }, 0) + transferSumA
         var room = payments.filter(payment => payment.method === 'room').reduce((total, payment) => {
           var quantity = total.quantity + 1;
           var total = total.total + payment.total_amount;
           return {quantity, total}
         }, {quantity: 0, total: 0})
         var total_discount = payments.reduce((total, payment) => {
           return total + payment.discount_amount
         }, 0)

         var total_cash_refund = payments.filter(payment => payment.method === 'cash').reduce((total, payment) => {
           return payment.refund_amount !== null ? total + payment.refund_amount : total
         }, 0)
         var total_card_refund = payments.filter(payment => payment.method === 'card').reduce((total, payment) => {
           return payment.refund_amount !== null ? total + payment.refund_amount : total
         }, 0)

         db.knexBackup.raw(`SELECT *
            FROM customer_tables ct
            LEFT JOIN shifts ON shifts.id = ct.shift_id
            LEFT JOIN payment pay ON ct.id = pay.customer_table_id
            LEFT JOIN tables ON ct.table_number = tables.number
            WHERE shifts.detail = ? AND tables.outlet = 'customer' AND tables.section != 'ETC'`,  [moment().format('DD/MM/YYYY')]).then((rawData) => {
              var payments = rawData[0];
              var total_table = payments.length;
              var number_of_guest = payments.reduce((total, payment) => {
                return total + payment.number_of_guest
              }, 0)

              db.knexBackup.raw(`SELECT ct.table_number, mi.name, ios.quantity, mi.price, ios.detail, emp.short_name
      FROM item_order_status ios
      LEFT JOIN item_orders io ON ios.item_order_id = io.id
      LEFT JOIN menu_items mi ON mi.code = io.item_code
      LEFT JOIN customer_tables ct ON ct.id = io.customer_table_id
      LEFT JOIN shifts s ON s.id = ct.shift_id
      LEFT JOIN staffs sf ON sf.id = ios.create_by
      LEFT JOIN employees emp ON sf.id = emp.id
      WHERE ios.status = 'cancel' AND s.detail = ?`, [moment().format('DD/MM/YYYY')]).then((cancelData) => {
                  const cancelOrders = cancelData[0];
                  const totalQuantityCancel = cancelOrders.reduce((total, order) => {
                    return total + order.quantity;
                  }, 0);

                  db.knexBackup.raw(`select p.id, t.number, t.outlet, ct.number_of_guest, p.method, p.total_amount, p.discount_amount, s.period, p.room_number from shifts s
  LEFT JOIN customer_tables ct ON ct.shift_id = s.id
  LEFT JOIN payment p ON ct.id = p.customer_table_id
  LEFT JOIN tables t ON t.number = ct.table_number WHERE s.detail = ? order by p.id ASC`, [moment().format('DD/MM/YYYY')]).then(rawData => {
                      const tablesSummary = rawData[0];
                      nodemailer.emailDailyShifts({
                        number_of_guest,
                        total_table,
                        total_amount: total_amount - (total_cash_refund + total_card_refund),
                        total_cash: total_cash - total_cash_refund,
                          morning_cash,
                          afternoon_cash,
                        total_card: total_card - total_card_refund,
                          morning_card,
                          afternoon_card,
                        room,
                        total_transfer,
                          morning_transfer,
                          afternoon_transfer,
                        total_discount,
                        totalQuantityCancel,
                          cancelOrders,
                        total_refund: (total_cash_refund + total_card_refund),
                          tablesSummary,
                          detailOfDay,
                          ThaiChanaSumA,
                          ThaiChanaSumM,
                          GWalletSumA,
                          GWalletSumM,
                          halfHalfSumA,
                          halfHalfSumM,
                          total_service_charge
                      });
                      line.lineDailyShifts({
                        number_of_guest,
                        total_table,
                        total_amount: total_amount - (total_cash_refund + total_card_refund),
                        total_cash: total_cash - total_cash_refund,
                          morning_cash,
                          afternoon_cash,
                        total_card: total_card - total_card_refund,
                          morning_card,
                          afternoon_card,
                        room,
                        total_transfer,
                          morning_transfer,
                          afternoon_transfer,
                        total_discount,
                        totalQuantityCancel,
                          cancelOrders,
                        total_refund: (total_cash_refund + total_card_refund),
                          tablesSummary,
                          detailOfDay,
                          ThaiChanaSumA,
                          ThaiChanaSumM,
                          GWalletSumA,
                          GWalletSumM,
                          halfHalfSumA,
                          halfHalfSumM,
                          total_service_charge
                      });
                  db.backupDatabase();

                  })

                });

            })
       }
     })
}

function thaiWordNumber(number){
  var result;
  switch (number) {
    case 1: result = 'หนึ่ง'; break;
    case 2: result = 'สอง'; break;
    case 3: result = 'สาม'; break;
    case 4: result = 'สี่'; break;
    case 5: result = 'ห้า'; break;
    case 6: result = 'หก'; break;
    case 7: result = 'เจ็ด'; break;
    case 8: result = 'แปด'; break;
    case 9: result = 'เก้า'; break;
    default: result = 'ศูนย์';
  }
  return result;
}

router.post('/save-morning-shift', authentication, (req, res) => {
  const {user_id, passcode} = req.body;
  checkUser(user_id, passcode, (result) => {
    if(result){
      db.knex('shifts').where({status: 'active', period: 'morning'}).then(shiftResponse => {
        if(shiftResponse.length === 1){
         const shiftId = shiftResponse[0].id;
         const openAt = shiftResponse[0].open_at;
         const now = new Date();
        const morningDetail = shiftResponse[0].detail;
         //
         // Print INfor aout the shift
         printShiftInfo(shiftId, openAt, now, user_id, 'รอบเช้า');
         //
        db.knex('shifts').where({id: shiftId}).update({status: 'inactive', close_by: user_id, close_at: now}).then(() => {
          db.knex('shifts').insert({
            status: 'active',
            open_at: now,
            open_by: user_id,
            detail: morningDetail,
            period:'afternoon'
          }).then(() => {
            socket.clientUpdateShift();
            res.json({status: true, msg:'ชิฟรอบเช้าถูกบันทึก โต๊ะที่เก็บเงินหลังจากนี้ จะถูกบันทึกในชิฟรอบเย็น.'})
          })
        })
         db.knex
        }else{
            res.json({status: false, msg: 'ไม่มี Shift ที่เปิดอยู่ ณ ตอนนี้'});
        }
      })
    }else{
      res.json({status:false, msg: 'รหัสไม่ถูกต้อง'});
    }
  });

})

const printShiftInfo = (shiftId, openAt, now, user_id, period) => {
  db.knex.raw(`SELECT *
     FROM customer_tables ct
     LEFT JOIN payment pay ON ct.id = pay.customer_table_id
     LEFT JOIN tables ON ct.table_number = tables.number
     LEFT JOIN (SELECT refunds.customer_table_id, sum(amount) as refund_amount from refunds GROUP BY refunds.customer_table_id) rr ON ct.id = rr.customer_table_id
     WHERE ct.shift_id = ? AND tables.outlet = 'customer'`, [shiftId]).then((rawData) => {
       var payments = rawData[0];
       const totalTables = payments.length;
       var totalSale = 0;
       var totalCustomer = 0;
       var totalDiscount = 0;
       var totalRefund = 0;
       var totalCash = 0;
       var totalCard = 0;
       var totalRoom = 0;
       var totalCashRefund = 0;
       var totalCardRefund = 0;
       if(totalTables !== 0){
          totalSale = payments.reduce((total, table) => {
             return total + table.total_amount;
           }, 0);
           totalRefund = payments.reduce((total, payment) => {
             return payment.refund_amount !== null ? total + payment.refund_amount : total
           }, 0)
         totalCustomer = payments.reduce((total, table) => {
            return total + table.number_of_guest;
          }, 0);
          totalDiscount = payments.reduce((total, table) => {
            return total + table.discount_amount;
          }, 0);
         const cashes = payments.filter((table) => table.method === 'cash');
           if(cashes.length !== 0){
           totalCash = cashes.reduce((total, table) => {
               return total + table.total_amount;
             }, 0);
           }
         const cards = payments.filter((table) => table.method === 'card');
           if(cards.length !== 0){
           totalCard = cards.reduce((total, table) => {
               return total + table.total_amount;
             }, 0);
           }

         const rooms = payments.filter((table) => table.method === 'room');
           if(rooms.length !== 0){
           totalRoom = rooms.reduce((total, table) => {
               return total + table.total_amount;
             }, 0);
           }

           totalCashRefund = payments.filter(payment => payment.method === 'cash').reduce((total, payment) => {
             return payment.refund_amount !== null ? total + payment.refund_amount : total
           }, 0)
           totalCardRefund = payments.filter(payment => payment.method === 'card').reduce((total, payment) => {
             return payment.refund_amount !== null ? total + payment.refund_amount : total
           }, 0)

           totalCash -= totalCashRefund;
           totalCard -= totalCardRefund;
       }

       db.knex.raw(`SELECT ior.quantity, menu_items.price, cat.name
                 FROM item_orders ior
                 LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
                 LEFT JOIN menu_items ON ior.item_code = menu_items.code
                 LEFT JOIN categories cat ON menu_items.category_id = cat.id
                 LEFT JOIN tables tb ON ct.table_number = tb.number
                 WHERE ct.shift_id = ? AND tb.outlet = 'customer'`, [shiftId])
             .then((rawData) => {
               var orders = rawData[0];
               var foodInfo = orders.filter(order => (order.name !== 'เครื่องดื่ม' && order.name !== 'อื่นๆ')).reduce((object, order) => {
                 var total = object.total + (order.quantity * order.price);
                 var quantity = object.quantity + order.quantity;
                 return {quantity, total};
               }, {quantity:0, total: 0});
               var bevInfo = orders.filter(order => order.name === 'เครื่องดื่ม').reduce((object, order) => {
                 var total = object.total + (order.quantity * order.price);
                 var quantity = object.quantity + order.quantity;
                 return {quantity, total};
               }, {quantity:0, total: 0});
               var otherInfo = orders.filter(order => order.name === 'อื่นๆ').reduce((object, order) => {
                 var total = object.total + (order.quantity * order.price);
                 var quantity = object.quantity + order.quantity;
                 return {quantity, total};
               }, {quantity:0, total: 0});
               db.knex.raw(`SELECT ior.quantity, menu_items.staff_price, cat.name
                         FROM item_orders ior
                         LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
                         LEFT JOIN menu_items ON ior.item_code = menu_items.code
                         LEFT JOIN categories cat ON menu_items.category_id = cat.id
                         LEFT JOIN tables tb ON ct.table_number = tb.number
                         WHERE ct.shift_id = ? AND tb.outlet = 'staff'`, [shiftId]).then((staffRowData) => {
                           var orders = staffRowData[0];
                           const staff_foodInfo = orders.filter(order => (order.name !== 'เครื่องดื่ม' && order.name !== 'อื่นๆ')).reduce((object, order) => {
                             var total = object.total + (order.quantity * order.staff_price);
                             var quantity = object.quantity + order.quantity;
                             return {quantity, total};
                           }, {quantity:0, total: 0});
                           const staff_bevInfo = orders.filter(order => order.name === 'เครื่องดื่ม').reduce((object, order) => {
                             var total = object.total + (order.quantity * order.staff_price);
                             var quantity = object.quantity + order.quantity;
                             return {quantity, total};
                           }, {quantity:0, total: 0});
                           const staff_otherInfo = orders.filter(order => order.name === 'อื่นๆ').reduce((object, order) => {
                             var total = object.total + (order.quantity * order.staff_price);
                             var quantity = object.quantity + order.quantity;
                             return {quantity, total};
                           }, {quantity:0, total: 0});
                           foodInfo.quantity += staff_foodInfo.quantity;
                           foodInfo.total += staff_foodInfo.total;
                           bevInfo.quantity += staff_bevInfo.quantity;
                           bevInfo.total += staff_bevInfo.total;
                           otherInfo.quantity += staff_otherInfo.quantity;
                           otherInfo.total += staff_otherInfo.total;
                           db.knex.raw(`SELECT *
                              FROM customer_tables ct
                              LEFT JOIN payment pay ON ct.id = pay.customer_table_id
                              LEFT JOIN tables ON ct.table_number = tables.number
                              WHERE ct.shift_id = ? AND tables.outlet = 'staff'`, [shiftId]).then((rawData) => {
                                var payments = rawData[0];
                                var staffSale = 0;
                                if(payments.length !== 0){
                                   staffSale = payments.reduce((total, table) => {
                                      return total + table.total_amount;
                                    }, 0);

                                    var cashes = payments.filter((table) => table.method === 'cash');
                                      if(cashes.length !== 0){
                                      totalCash += cashes.reduce((total, table) => {
                                          return total + table.total_amount;
                                        }, 0);
                                      }

                                    var cards = payments.filter((table) => table.method === 'card');
                                      if(cards.length !== 0){
                                      totalCard += cards.reduce((total, table) => {
                                          return total + table.total_amount;
                                        }, 0);
                                      }
                                    }

                                db.knex('printers').where({name: 'แคชเชียร์'}).then((printerData) => {
                                  const printerIp = printerData[0].ip_address;
                                  db.knex('staffs').leftJoin('employees', 'employees.id' , 'staffs.id').where('staffs.id', '=', user_id).then((staffsData) => {
                                    const staff = staffsData[0].name;
                                    db.knex.raw(`SELECT ios.quantity
                                      FROM item_order_status ios
                                      LEFT JOIN item_orders ior ON ios.item_order_id = ior.id
                                      LEFT JOIN customer_tables ct ON ct.id = ior.customer_table_id
                                      WHERE ios.status = 'cancel' AND ct.shift_id = ?`, [shiftId]).then((cancelData) => {
                                        const cancelOrders = cancelData[0];
                                        const totalQuantityCancel = cancelOrders.reduce((total, order) => {
                                          return total + order.quantity;
                                        }, 0);
                                        printer.printShift({
                                          printerIp,
                                          shift: `${period} วันที่ ${moment().format('DD/MM/YYYY')}`,
                                          openAt,
                                          closeAt: now,
                                          staff,
                                          totalTables,
                                          totalCustomer,
                                          totalSale: totalSale - totalRefund,
                                          totalCash,
                                          totalCard,
                                          totalDiscount,
                                          foodInfo,
                                          bevInfo,
                                          totalQuantityCancel,
                                          totalRoom,
                                          staffSale,
                                          totalRefund,
                                          otherInfo
                                        });
                                      })
                                  })
                              })
                            })
                        })
             });
     });
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


module.exports = router;
