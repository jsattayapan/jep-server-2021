const express = require('express');
const router = express.Router();
const db = require('../../../database/index.js');
const printer = require('../../../processes/utilities/printer.js');


router.post('/print', (req, res) => {
    console.log('camera APrint call');
    var name = req.body.name;
    var img = req.body.image;
    var realFile = Buffer.from(img,"base64");
    db.knex('printers').where({name: 'แคชเชียร์'}).then(printerData => {
        printer.printBankTransferImage({
            ip_address: printerData[0].ip_address,
            name,
            image: realFile
        })
        res.json({msg: 'พิมพ์ใบโอนเงินสำเร็จ'})
    })
})


module.exports = router;