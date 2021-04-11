const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const generatePayload = require('promptpay-qr')
const text2png = require('text2png');
const fs = require('fs');
const pw = require('string-pixel-width');
const moment = require('moment');
const numeral = require('numeral');

async function printBankTransferImage({ip_address, image, name}){
    try{
        const printer = createPrinter(ip_address);
        await makeTitle(`พิมพ์โดย: ${name}`, printer);
        printer.newLine();
        fs.writeFileSync('tempImg.png', image);
        await printer.printImage('./tempImg.png');
        printer.cut();
        await printer.execute();
    }catch(err){
        console.log('error')

    }
}


async function printTransferOrders({fromTable, toTable, zone, timestamp, name, ip_address, transferOrders}){
  try{
      const printer = createPrinter(ip_address);
  await makeTitle('ย้ายโต๊ะ', printer);
  printer.newLine();
  printer.newLine();
  await makeRestaurantName(`จากโต๊ะ: ${fromTable}`,printer);
  printer.newLine();
  await makeRestaurantName(`ไปโต๊ะ: ${toTable} | Zone: ${zone}`,printer);
  printer.newLine();
  await makeMediumText(`เวลา: ${moment(timestamp).format('DD/MM/YYYY HH:mm')}`,printer);
  printer.newLine();
  await makeMediumText(`โดย: ${name}`,printer);
  printer.newLine();
  printer.drawLine();
  await makeMediumText(`รายการ.:`,printer);
  printer.newLine();
  for(const order of transferOrders){
      await makeMediumText(`${order.quantity} x ${order.name}`,printer);
      printer.newLine();
  }
  printer.cut();
  await printer.execute();
  }catch(err){
    console.log('Printer is not working!')
  }
}
async function printerNewItem(orderInfo){
    try{
    const {table_number, zone, create_by, time,
    name, quantity, price, remark, printer_ip_address} = orderInfo;
    const printer = createPrinter(printer_ip_address);

    var isConnected = await printer.isPrinterConnected();
    if(isConnected){
      // Template for printing
      console.log('Printer is connected');
        await makeTableNo(table_number, zone, printer);
        printer.newLine();
        await makeCreateByNTime(create_by, moment(time).format('HH:mm DD/MM'), printer);
        printer.newLine();
        printer.drawLine();
        printer.newLine();
        await makeName(name, quantity, printer);
        printer.newLine();
        if(remark){
          await makeRemark(remark, printer);
          printer.newLine();
        }
        printer.alignRight();
        printer.setTextSize(1,1);
        printer.println(`${price * quantity}.-`);
        printer.cut();
        await printer.execute();
    }else{
      console.log('Printer is not connected');
    }
        }catch(err){
    console.log('Printer is not working!')
  }
}

async function printerCancelItem({ table_number, create_by, timestamp, quantity, name, remark, printer_ip_address }){
    try{
  printer = createPrinter(printer_ip_address);

  await makeTitle('ยกเลิก', printer);
  printer.newLine();
  await makeTableNo(table_number, null, printer);
  printer.newLine();
  await makeCreateByNTime(create_by, moment(timestamp).format('DD/MM/YYYY HH:mm'), printer);
  printer.newLine();
  printer.drawLine();
  printer.newLine();
  await makeName(name, quantity, printer);
  printer.newLine();
  await makeRemark(remark, printer);
  printer.cut();
  await printer.execute();
        }catch(err){
    console.log('Printer is not working!')
  }
}

async function printShift({
  printerIp,
  shift,
  openAt,
  closeAt,
  staff,
  totalTables,
  totalCustomer,
  totalSale,
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
}){
    try{
  const printer = createPrinter(printerIp);
  await makeRestaurantName('รายงาน Shift',printer);
  printer.newLine();
  printer.newLine();
  await makeSmallText(`Shift: ${shift}`,printer);
  printer.newLine();
  await makeSmallText(`เริ่มเวลา: ${moment(openAt).format('HH:mm')} ถึงเวลา: ${moment(closeAt).format('HH:mm')}`,printer);
  printer.newLine();
  await makeSmallText(`พิมพ์โดย: ${staff}`,printer);
  printer.newLine();
  printer.newLine();
  await makeSmallText(`จำนวนโต๊ะ: ${totalTables} โต๊ะ`,printer);
  printer.newLine();
  await makeSmallText(`จำนวนลูกค้า: ${totalCustomer} คน`,printer);
  printer.newLine();
  printer.newLine();
  await makeSmallText(`จำนวนอาหาร: ${foodInfo.quantity} รายการ | ${numeral(foodInfo.total).format('0,0')} บาท`,printer);
  printer.newLine();
  await makeSmallText(`จำนวนเครื่องดื่ม: ${bevInfo.quantity} รายการ | ${numeral(bevInfo.total).format('0,0')} บาท`,printer);
  printer.newLine();
  await makeSmallText(`จำนวนรายการอื่นๆ: ${otherInfo.quantity} รายการ | ${numeral(otherInfo.total).format('0,0')} บาท`,printer);
  printer.newLine();
  await makeSmallText(`จำนวนยกเลิก: ${totalQuantityCancel} รายการ`,printer);
  printer.cut();
  await printer.execute();
        }catch(err){
    console.log('Printer is not working!')
  }
}

async function printReceipt({
  printerIp,
  table_number,
  zone,
  create_by,
  timestamp,
  orders,
  language,
  total,
  sub_total,
  total_bev,
  total_food,
  vat_total,
  total_discount,
  payment_id,
  total_amount,
  receive_amount,
  method,
  room_number,
  paymentInfo,
  paymentList,
  service_charge_amount,
  roomDelivery
}){
    try{
    const printer = createPrinter(printerIp);
      var totalPrice = 0;
      await makeSmallText('ใบเสร็จรับเงิน',printer);
      printer.newLine();
      await makeRestaurantName('ร้านเจี๊ยบ เกาะเสม็ด',printer);
      printer.newLine();
      await makeSmallText(`วันที่: ${moment(timestamp).format('DD/MM/YYYY HH:mm')}`, printer);
      await makeSmallText(`ใบเสร็จเลขที่: ${payment_id} | พิมพ์โดย: ${create_by}`, printer);
      printer.newLine();
      await makeRestaurantName(`โต๊ะ: ${table_number}`,printer);
      printer.drawLine();
      printer.newLine();
      await makeSmallText('รายการ.:', printer);
      printer.newLine();

      for(const item of orders){
        printer.alignLeft();
        await makeSmallText(`${item.quantity} x ${item.name}`, printer);
        printer.alignRight();
        await makeSmallText(`฿${numeral(item.price * item.quantity).format('0,0 ')}.-`, printer);
        totalPrice += item.price * item.quantity;
      }
      printer.alignLeft();
      printer.newLine();
      printer.drawLine();
      printer.newLine();
      printer.alignRight();
      await makeSmallText(`ราคาอาหาร: ฿${numeral(total_food).format('0,0.00')}`, printer);
      await makeSmallText(`ราคาเครื่องดื่ม: ฿${numeral(total_bev).format('0,0.00')}`, printer);
      await makeSmallText(`ส่วนลด: -฿${numeral(total_discount).format('0,0')}`, printer);
      await makeSmallText(`Vat(7%): ฿${numeral(vat_total).format('0,0.00')}`, printer);
      if(roomDelivery){
        await makeSmallText(`Service Charge(10%): ฿${numeral(service_charge_amount).format('0,0.00')}`, printer);
      }
      printer.newLine();
      await makeRestaurantName(`รวมเป็นเงิน: ฿${numeral(total).format('0,0')}.-บาท`,printer);
      printer.newLine();
      await makeSmallText(`ชำระโดย: ${method === 'cash' ? 'เงินสด' : method === 'card' ? 'บัตร เครดิต/เดบิต' : method === 'multiple' ? 'แบ่งจ่าย' : method === 'room' ? 'ใส่บัญชีห้องพัก' : method === 'transfer' ? 'โอนเงิน' : 'Complimentary'}`, printer);

      if(method === 'card'){
        printer.newLine();
        await makeSmallText(`ค่าธรรมเนียมบัตร (3% ): ฿${numeral(total_amount - total).format('0,0')}`, printer);
        printer.newLine();
        await makeSmallText(`หมายเลขบัตร: ${paymentInfo}`, printer);
        printer.newLine();
        await makeSmallText(`รวมทั้งสิ้น: ฿${numeral(total_amount).format('0,0')}`, printer);
      }else if(method === "cash"){
        printer.newLine();
        await makeSmallText(`รับเงิน: ฿${numeral(receive_amount).format('0,0')}`, printer);
        printer.newLine();
        await makeSmallText(`ทอนเงิน: ฿${numeral(total - receive_amount).format('0,0')}`, printer);
      }else if (method === "room"){
        printer.newLine();
        await makeSmallText(`หมายเลขห้องพัก: ${room_number}`, printer);
        printer.newLine();
      }else if (method === "transfer"){
        printer.newLine();
        await makeSmallText(`Ref.: ${room_number}`, printer);
        printer.newLine();
      }else if (method === 'multiple'){
        printer.newLine();
        for(const p of paymentList){
          let type = p.paymentType === 'cash' ? 'เงินสด' :
          p.paymentType === 'creditCard' ? 'บัตร' :
          p.paymentType === 'halfHalf' ? 'คนละครึ่ง' :
          p.paymentType === 'G-Wallet' ? 'G-Wallet' : 'ไทยชนะ';
          printer.alignLeft();
          await makeSmallText(`${type}: ฿${numeral(p.amount).format('0,0')}`, printer);
          if(p.paymentType !== 'cash'){
            printer.alignRight();
            await makeSmallText(`${p.reference}`, printer);
          }
        }
      }

      printer.alignLeft();
      printer.newLine();
      printer.drawLine();
      printer.newLine();
      await makeSmallText(`ขอขอบคุณทุกท่านทีใช้บริการ`, printer);

      printer.cut();
      await printer.execute();

        }catch(err){
          console.log(err);
    console.log('Printer is not working!')
  }

}

async function printerCheckBill({table_number, zone, create_by, timestamp, orders, language, printer_ip_address,   total,
  sub_total,
  total_bev,
  total_food,
  vat_total,
  total_discount, payment_id, printerIp, roomDelivery
}){
    try{

      const qrString = generatePayload('089-606-7146', {amount: Math.ceil(total)})
  const printer = createPrinter(printerIp);
    var totalPrice = 0;
  if(language === 'ไทย'){
    await makeSmallText('ใบแจ้งยอดชำระ',printer);
    printer.newLine();
    await makeRestaurantName('ร้านเจี๊ยบ เกาะเสม็ด',printer);
    printer.newLine();
    await makeSmallText(`วันที่: ${moment(timestamp).format('DD/MM/YYYY HH:mm')}`, printer);
    await makeSmallText(`ใบเสร็จเลขที่: ${payment_id} | พิมพ์โดย: ${create_by}`, printer);
    printer.newLine();
    await makeRestaurantName(`โต๊ะ: ${table_number}`,printer);
    printer.drawLine();
    printer.newLine();
    await makeSmallText('รายการ.:', printer);
    printer.newLine();

    for(const item of orders){
      printer.alignLeft();
      await makeSmallText(`${item.quantity} x ${item.name}`, printer);
      printer.alignRight();
      await makeSmallText(`฿${numeral(item.price * item.quantity).format('0,0 ')}.-`, printer);
      totalPrice += item.price * item.quantity;
    }
    printer.alignLeft();
    printer.newLine();
    printer.drawLine();
    printer.newLine();
    printer.alignRight();
    await makeSmallText(`ราคาอาหาร: ฿${numeral(total_food).format('0,0.00')}`, printer);
    await makeSmallText(`ราคาเครื่องดื่ม: ฿${numeral(total_bev).format('0,0.00')}`, printer);
    await makeSmallText(`ส่วนลด: -฿${numeral(total_discount).format('0,0')}`, printer);
    await makeSmallText(`Vat(7%): ฿${numeral(vat_total).format('0,0.00')}`, printer);
    if(roomDelivery){
      await makeSmallText(`Service Charge(10%): ฿${numeral(((total_bev + total_food) * 1.1 )- (total_bev + total_food)).format('0,0.00')}`, printer);
    }
    printer.newLine();
    await makeRestaurantName(`รวม: ฿${numeral(total).format('0,0')}.-บาท`,printer);
    printer.alignLeft();
    printer.newLine();
    printer.drawLine();
    printer.newLine();
    await makeSmallText(`ขอขอบคุณทุกท่านทีใช้บริการ`, printer);
    printer.newLine();
    printer.alignCenter();
    // await printer.printImage('./qr.png');
    await printer.printImage('./prompt-pay.png');
    printer.newLine();
    printer.printQR(qrString);
    printer.cut();
    await printer.execute();
  }else{
    await makeSmallText('Invoice',printer);
    printer.newLine();
    await makeRestaurantName('Jep\'s Restaurant Koh Samed',printer);
    printer.newLine();
    await makeSmallText(`Date: ${moment(timestamp).format('DD/MM/YYYY HH:mm')}`, printer);
    await makeSmallText(`Bill No: ${payment_id} | Staff: ${create_by}`, printer);
    printer.newLine();
    await makeRestaurantName(`Table No.: ${table_number}`,printer);
    printer.drawLine();
    printer.newLine();
    await makeSmallText('Details.:', printer);
    printer.newLine();

    for(const item of orders){
      printer.alignLeft();
      await makeSmallText(`${item.quantity} x ${item.english_name}`, printer);
      printer.alignRight();
      await makeSmallText(`฿${item.price * item.quantity}.-`, printer);
      totalPrice += item.price * item.quantity;
    }
    printer.alignLeft();
    printer.newLine();
    printer.drawLine();
    printer.newLine();
    printer.alignRight();
    await makeSmallText(`Food: ฿${numeral(total_food).format('0,0.00')}`, printer);
    await makeSmallText(`Beverage: ฿${numeral(total_bev).format('0,0.00')}`, printer);
    await makeSmallText(`Discount: -฿${numeral(total_discount).format('0,0')}`, printer);
    await makeSmallText(`Vat(7%): ฿${numeral(vat_total).format('0,0.00')}`, printer);
    if(roomDelivery){
      await makeSmallText(`Service Charge(10%): ฿${numeral(((total_bev + total_food) * 1.1 )- (total_bev + total_food)).format('0,0.00')}`, printer);
    }
    printer.newLine();
    await makeRestaurantName(`Total: ฿${numeral(Math.ceil(total)).format('0,0')}.-`,printer);
    printer.alignLeft();
    printer.newLine();
    printer.drawLine();
    printer.newLine();
    await makeSmallText(`Thank you and enjoy your stay`, printer);
    await makeSmallText(`@ Samed Island`, printer);
    printer.newLine();
    printer.alignCenter();
    // await printer.printImage('./qr.png');
    await printer.printImage('./prompt-pay.png');
    printer.newLine();
    printer.printQR(qrString);
    printer.cut();
    await printer.execute();
  }
}catch(err){
  console.log(err);
    console.log('Printer is not working!')
  }

}

async function makeMediumText(text, printer){
  fs.writeFileSync('tempText.png', text2png(text ,{
    font: '40px sans'
      })
    );
    await printer.printImage('./tempText.png');
}

async function makeSmallText(text, printer){
  fs.writeFileSync('tempText.png', text2png(text ,{
    font: '30px sans'
      })
    );
    await printer.printImage('./tempText.png');
}

async function makeRestaurantName(label, printer){
  fs.writeFileSync('tempText.png', text2png(label ,{
    font: '50px sans'
      })
    );
    await printer.printImage('./tempText.png');
}

async function makeTitle(title, printer){
  let text = `======${title}======`;

  fs.writeFileSync('tempText.png', text2png(text ,{
    font: '50px sans'
      })
    );
    await printer.printImage('./tempText.png');
}

async function makeTableNo(number, zone = null, printer){
  let text = `โต๊ะ: ${number}`;

  if(zone !== null){
    let width = pw(text, {size: 10})

    while (width < 80){
      text += `\xa0`;
      width = pw(text, {size: 10})
    }

    text += `โซน: ${zone}`
  }

  fs.writeFileSync('tempText.png', text2png(text ,{
    font: '40px sans'
    })
  );
  await printer.printImage('./tempText.png');
}

async function makeCreateByNTime(create_by, time, printer){
  let text = `รับโดย: ${create_by}`;
  let width = pw(text, {size: 10})

  while (width < 80){
    text += `\xa0`;
    width = pw(text, {size: 10})
  }

  text += `เวลา: ${time}`
  fs.writeFileSync('tempText.png', text2png(text,{
    font: '30px sans'
    }));
  await printer.printImage('./tempText.png');
}

async function makeName(name, quantity, printer){
  let text = `(${quantity})`;
  let width = pw(text, {size: 10})

  while (width < 20){
    text += `\xa0`;
    width = pw(text, {size: 10})
  }

  text += `${name}`
  fs.writeFileSync('tempText.png', text2png(text,{
    font: '40px sans'
    }));
  await printer.printImage('./tempText.png');
}

async function makeRemark(remark, printer){
  fs.writeFileSync('tempText.png', text2png(`** ${remark} **`,{
    font: '35px sans'
    }));
  await printer.printImage('./tempText.png');
}

function createPrinter(ip_address){
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${ip_address}`,
    characterSet: 'SLOVENIA',
    removeSpecialCharacters: false,
    lineCharacter: '=',
    options: {
      timeout: 5000
    }
  })
}

module.exports = {
  printerNewItem,
  printerCancelItem,
  printerCheckBill,
  printReceipt,
  printShift,
  printTransferOrders,
    printBankTransferImage
}
