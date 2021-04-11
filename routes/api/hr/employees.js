const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const db = require('../../../database/index.js');
const path = require('path');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function(req, file, callback){
    callback(null, './public/uploads/')
  },
  filename:function(req, file, callback){
    const filename = req.body.id+path.extname(file.originalname);
    req.body.filename = filename;
    console.log(file);
    callback(null, filename);
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 *1024 * 5
  },
  fileFilter: function(req, file, callback){
    checkFileType(file, callback);
  }
}).single('imageFile')

const checkFileType = (file, callback) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype && extname){
    return callback(null, true)
  }else{
    return callback('Error: Images Only!')
  }
}

router.post('/update-profile-image', (req, res) => {
  upload(req, res, (err) => {
    if(err){
      res.json({status: false, msg: 'กรุณาอัพโหลดไฟล์ที่เป็น jpeg, jpg, png ขนาดไม่เกิน 5 MB'})
    }else{
      db.knex('employees').update({employeeImage: req.body.filename}).where({id: req.body.id}).then(resp => {
        res.json({status:true});
      }).catch(e => {
        console.log(e);
        res.json({status: false, msg: 'เกิดข้อผิดพลาดในระบบ'})
      })
    }
  })
})

router.get('/', async (req, res) => {
  var data = await db.knex('employees AS emp').select('emp.*', 'dept.title as dept_title', 'dept.position')
  .leftJoin('departments AS dept', 'dept.id', 'emp.dept_id')
  .then();
  res.json({status: true, payload: data});
})

router.post('/add-leave', async (req, res) => {
    var leaveObj = {
        emp_id: req.body.emp_id,
        type: req.body.type,
        remark: req.body.remark,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        create_at: req.body.create_at,
        create_by: req.body.create_by
    }
    db.knex('employee_leaves').insert(leaveObj).then(resp => {
        res.json({status: true});
    }).catch(e => {
        console.log(e);
        res.json({status: false, msg:'เกิดข้อผิดพลาดในระบบ ไม่สามารถบันทึกรายการลาได้'});
    })
});

router.post('/add-employee', async (req, res) => {
  var id = uuid.v4();
  var employeesObj = {
    id: id,
    title: req.body.data.title,
    name: req.body.data.name,
    short_name: req.body.data.short_name,
    nationality: req.body.data.nationality,
    national_id: req.body.data.nationalId,
    dob: req.body.data.dob,
    start_job: req.body.data.startJob,
    dept_id: req.body.data.position,
    salary: req.body.data.salary,
    budget: req.body.data.budget,
    address: req.body.data.address,
    tel: req.body.data.tel,
    email: req.body.data.email,
    room: req.body.data.room
  }

  db.knex('employees').insert(employeesObj).then(async resp => {
    var employee = await db.knex('employees AS emp').select('emp.*', 'dept.title', 'dept.position')
    .leftJoin('departments AS dept', 'dept.id', 'emp.dept_id')
    .where('emp.id', id)
    .then();
    if(employee.length !== 0){
      res.json({status: true, payload: employee[0]});
    }
  }).catch((err) => {
    console.log(err);
    res.json({status: false, msg:'เกิดข้อผิดพลาดในระบบ ไม่สามารถบันทึกข้อมูลพนักงานใหม่ได้'});
  })

})


router.get('/:id', async (req, res) => {
  var id = req.params.id;
  var employee = await db.knex('employees AS emp').select('emp.*', 'dept.title', 'dept.position')
  .leftJoin('departments AS dept', 'dept.id', 'emp.dept_id')
  .where('emp.id', id)
  .then();
  if(employee.length !== 0){
    res.json({status: true, payload: employee});
  }else{
    res.json({status: false, msg: 'ไม่พบข้อมูลพนักงาน'});
  }
})

router.post('/update-profile-info', (req, res) => {
  db.knex('employees').update({
    start_job: req.body.start_job,
    email: req.body.email,
    tel: req.body.tel,
    address: req.body.address
  }).where({id: req.body.id}).then(resp => {
    res.json({status:true});
  }).catch(e =>{
    res.json({status:false, msg: 'เกิดข้อผิดพลาดในระบบ ไม่สามารถบันทึกข้อมูลได้'})
  })
});

module.exports = router;
