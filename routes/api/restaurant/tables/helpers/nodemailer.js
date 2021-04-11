const nodemailer = require('nodemailer');
const moment = require('moment');
const numeral = require('numeral');

async function emailDailyShifts({
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

  var output = `
  <h3>Daily Report ร้านอาหารเจี๊ยบ</h3>
  <p><b>วันที่: </b>${detailOfDay}</p>
  <br />
  <p><b>ยอดขาย (หักส่วนลด): </b>${numeral(total_amount).format('0,0')} บาท</p>
  <p><b>จำนวนลูกค้า: </b>${numeral(number_of_guest).format('0,0')} คน</p>
  <p><b>จำนวนโต๊ะที่เปิด: </b>${numeral(total_table).format('0,0')} โต๊ะ</p>
  <p><b>จ่ายโดยเงินสด: </b>${numeral(total_cash).format('0,0')} บาท (เช้า: ${numeral(morning_cash).format('0,0')} บาท) (เย็น: ${numeral(afternoon_cash).format('0,0')} บาท)</p>
  <p><b>Service Charge: </b>${numeral(total_service_charge).format('0,0')} บาท</p>
  <p><b>จ่ายโดยบัตร: </b>${numeral(total_card).format('0,0')} บาท (เช้า: ${numeral(morning_card).format('0,0')} บาท) (เย็น: ${numeral(afternoon_card).format('0,0')} บาท)</p>
<p><b>จ่ายโดยโอนเงิน: </b>${numeral(total_transfer).format('0,0')} บาท (เช้า: ${numeral(morning_transfer).format('0,0')} บาท) (เย็น: ${numeral(afternoon_transfer).format('0,0')} บาท)</p>

<p><b>จ่ายโดยคนละครึ่ง: </b>${numeral(halfHalfSumM+halfHalfSumA).format('0,0')} บาท (เช้า: ${numeral(halfHalfSumM).format('0,0')} บาท) (เย็น: ${numeral(halfHalfSumA).format('0,0')} บาท)</p>
<p><b>จ่ายโดยเราชนะ: </b>${numeral(ThaiChanaSumM+ThaiChanaSumA).format('0,0')} บาท (เช้า: ${numeral(ThaiChanaSumM).format('0,0')} บาท) (เย็น: ${numeral(ThaiChanaSumA).format('0,0')} บาท)</p>
<p><b>จ่ายโดย G-Wallet: </b>${numeral(GWalletSumM+GWalletSumA).format('0,0')} บาท (เช้า: ${numeral(GWalletSumM).format('0,0')} บาท) (เย็น: ${numeral(GWalletSumA).format('0,0')} บาท)</p>

  <p><b>โอนเข้าบัญชีห้องพัก: </b>${numeral(room.quantity).format('0,0')} ห้อง | รวมมูลค่า : ${numeral(room.total).format('0,0')} บาท</p>
  <p><b>ส่วนลด: </b>${numeral(total_discount).format('0,0')} บาท</p>
  <p><b>คืนเงิน: </b>${numeral(total_refund).format('0,0')} บาท</p>
  <p><b>จำนวนยกเลิก: </b>${numeral(totalQuantityCancel).format('0,0')} รายการ</p>
                <br/>
    <table><thead><tr>
<th>จำนวน</th>
<th>รายการ</th>
<th>โต๊ะ</th>
<th>โดย</th>
<th>หมายเหตุ</th>
<th>ราคารวม</th>
</tr></thead><tbody>
`;
    cancelOrders.forEach(x => {
        output += `<tr>
    <td>${x.quantity}</td>
<td>${x.name}</td>
<td>${x.table_number}</td>
<td>${x.short_name}</td>
<td>${x.detail}</td>
<td>${numeral(x.price * x.quantity).format('0,0')}</td>
</tr>`;
    })

    output += `</tbody></table>`;

    output += `<br/>
    <table><thead><tr>
<th>ID</th>
<th>โต๊ะ</th>
<th>ประเภทลูกค้า</th>
<th>จ่ายเงินโดย</th>
<th>ส่วนลด</th>
<th>ยอดชำระ</th>
<th>เลขอ้างอิง</th>
<th>จำนวนลูกค้า</th>
<th>รอบ</th>
</tr></thead><tbody>`;


    tablesSummary.forEach(x => {
        output += `<tr>
    <td>${x.id}</td>
<td>${x.number}</td>
<td>${x.outlet}</td>
<td>${x.method}</td>
<td>${numeral(x.discount_amount).format('0,0')}</td>
<td>${numeral(x.total_amount).format('0,0')}</td>
<td>${x.room_number}</td>
<td>${x.number_of_guest}</td>
<td>${x.period}</td>
</tr>`;
    })

    output += `</tbody></table>`;
  let transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: 'triple.t.server@gmail.com', // generated ethereal user
              pass: 'mytripletservergmail' // generated ethereal password
          }
      });

      let email_list = ['jboiedition@gmail.com', 'ac@samedpavilionresort.com', 'avaacc@samedpavilionresort.com', 'jepjep146@hotmail.com'];

      // send mail with defined transport object
      let info = await transporter.sendMail({
          from: '"Triple T Reporter 👻" <triple.t.server@gmail.com>', // sender address
          to: email_list, // list of receivers
          subject: `Report ร้านอาหารเจี๊ยบ ประจำวันที่ ${moment().format('DD/MM/YYY')}`, // Subject line
          text: '', // plain text body
          html: output // html body
      });
}

module.exports = {
  emailDailyShifts
}
