const request = require('request');
const moment = require('moment');
const numeral = require('numeral');

// Line Engineer
// C04d125d5834291a3ae47cffb5d0b7224

// Tay Line
//U9fe2a1b7a904b81702745cd749424de5

// Tripl T Server Line Token
// 4wH6/mM8lVGhLNl0F3JICYFOwEoynsZU+yjPpliA+OtULNbed+Wlfzc4nLJNDSXxeTlC6646xXVSG+GVv67olzLoMZZh/MrmJEIqsWHw3WA4kwdEwmc7ai5Hxvd2ua1PUJ/EQ0LNDiA9nsqM1WSmagdB04t89/1O/w1cDnyilFU=

// Triple T System Line Token
// Ff3pIcj/iIs87t+e8BZhiPNCalt4Ewy7gr21WelNxaRTWvEl4ZN+WQQumNkBtggsrdBPw9Vaquc1IyLZdS0OBzOCvSewbnm9JGdln6wSLmWd5QOE+ZM+lj9mcpc9j6CebHNvxD0fB5D960VSLiTn5gdB04t89/1O/w1cDnyilFU=

async function lineDailyShifts({
  number_of_guest,
  total_table,
  total_amount,
  total_cash,
  total_card,
  room,
  total_discount,
  totalQuantityCancel,
  total_refund,
    total_transfer,
    morning_cash,
 afternoon_cash,
morning_card,
    afternoon_card,
morning_transfer,
 afternoon_transfer,
    cancelOrders,
    tablesSummary,
    detailOfDay,
    ThaiChanaSumA,
    ThaiChanaSumM,
    GWalletSumA,
    GWalletSumM,
    halfHalfSumA,
    halfHalfSumM,
    total_service_charge
}){
    console.log('inside line')
    console.log(total_amount)
    let headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer {4wH6/mM8lVGhLNl0F3JICYFOwEoynsZU+yjPpliA+OtULNbed+Wlfzc4nLJNDSXxeTlC6646xXVSG+GVv67olzLoMZZh/MrmJEIqsWHw3WA4kwdEwmc7ai5Hxvd2ua1PUJ/EQ0LNDiA9nsqM1WSmagdB04t89/1O/w1cDnyilFU=}'
    }
    let cancelOrder = 'รายการยกเลิก\n';
    cancelOrders.forEach(x => {
        cancelOrder += `จำนวน ${x.quantity} ${x.name} ${x.detail} บันทึกโดย ${x.short_name}\n`
    })
    let body = JSON.stringify({
        to: 'Caece0e65454a9ad73584d684e3a8f279',
        messages: [{
            type: 'text',
            text: `🔈 Report ร้านอาหารเจี๊ยบวันที่ ${detailOfDay}\n
                    \n
                    💵 ยอดขาย: ${numeral(total_amount).format('0,0')} บาท\n
                    👨‍ จำนวนลูกค้า: ${numeral(number_of_guest).format('0,0')} คน\n
                    🪑 จำนวนโต๊ะ: ${numeral(total_table).format('0,0')} โต๊ะ\n
                    ❌ จำนวนยกเลิก: ${numeral(totalQuantityCancel).format('0,0')} รายการ
                    \n
                    ไทยชนะ: ${numeral(ThaiChanaSumA + ThaiChanaSumM).format('0,0')} บาท\n
                    G-Wallet: ${numeral(GWalletSumA + GWalletSumM).format('0,0')} บาท\n
                    คนละครึ่ง: ${numeral(halfHalfSumA + halfHalfSumM).format('0,0')} บาท\n

                    service_charge: ${numeral(total_service_charge).format('0,0')} บาท\n
`
        },
        {
            type: 'text',
            text: cancelOrder
        }]
    })
    request.post({
        url: 'https://api.line.me/v2/bot/message/push',
        headers: headers,
        body: body
    }, (err, res, body) => {
        console.log('status = ' + res.statusCode);
    });
}

module.exports = {
  lineDailyShifts
}
