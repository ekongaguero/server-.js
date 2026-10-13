const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());

const PAYSTACK_SECRET = "sk_live_YOUR_KEY_HERE"; // <-- PUT YOUR sk_live HERE
const DB_FILE = './db.json';
let db = { users: [], payments: [] };
if(fs.existsSync(DB_FILE)){ try{ db = JSON.parse(fs.readFileSync(DB_FILE)); }catch(e){} }
function saveDB(){ fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
function isOwner(phone){ const c=(phone||'').replace(/\s/g,''); return c.includes("09020274023")||c.includes("9020274023"); }

function verifyPaystack(ref){
  return new Promise((resolve,reject)=>{
    https.request({ hostname:'api.paystack.co', path:`/transaction/verify/${ref}`, method:'GET', headers:{Authorization:`Bearer ${PAYSTACK_SECRET}`}}, res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    }).on('error',reject).end();
  });
}

app.get('/', (req,res)=> res.send('ASSESS AUTO ONLY'));
app.get('/api/check-phone/:phone', (req,res)=>{ const clean=req.params.phone.replace(/\s/g,''); const user=db.users.find(u=>u.phone.replace(/\s/g,'')===clean); res.json({exists:!!user,user,isOwner:isOwner(clean)}); });
app.get('/api/users', (req,res)=> res.json(db.users));
app.get('/api/payments', (req,res)=> res.json(db.payments));

app.post('/api/pay', (req,res)=>{
  const {email,name,phone,referralCode,plan,type,price}=req.body;
  if(isOwner(phone)) return res.json({success:true,isOwner:true});
  let user=db.users.find(u=>u.email===email);
  if(!user){ db.users.push({email,name,phone,referralCode:referralCode||'',type,plan,price,isPremium:false,referrals:0,freeDays:0,createdAt:new Date()}); }
  const payload=JSON.stringify({email,amount:price*100,metadata:{phone,plan,type,referralCode},reference:'ASSESS-'+Date.now()});
  const payReq=https.request({hostname:'api.paystack.co',path:'/transaction/initialize',method:'POST',headers:{Authorization:`Bearer ${PAYSTACK_SECRET}`,'Content-Type':'application/json'}}, payRes=>{
    let data=''; payRes.on('data',d=>data+=d); payRes.on('end',()=>{
      const p=JSON.parse(data);
      if(p.status){
        db.payments.push({email,phone,name,referralCode,plan,type,price,reference:p.data.reference,verified:false,createdAt:new Date(),paystackUrl:p.data.authorization_url});
        saveDB();
        res.json({success:true,reference:p.data.reference,paystackUrl:p.data.authorization_url,price});
      }else res.json({success:false,error:p.message});
    });
  });
  payReq.on('error',e=>res.json({success:false,error:e.message})); payReq.write(payload); payReq.end();
});

app.post('/api/confirm', async (req,res)=>{
  const {reference,email}=req.body;
  const payment=db.payments.find(p=>p.reference===reference);
  if(!payment) return res.json({autoConnected:false,message:'Invalid reference'});
  if(payment.verified) return res.json({autoConnected:true,message:`AUTO VERIFIED! ${payment.plan} active. Code: ${payment.phone}`});
  try{
    const v=await verifyPaystack(reference);
    if(v.status && v.data.status==='success'){
      payment.verified=true;
      const user=db.users.find(u=>u.email===email); if(user) user.isPremium=true;
      if(user&&user.referralCode){ const ru=db.users.find(u=>u.phone.replace(/\s/g,'')===user.referralCode.replace(/\s/g,'')); if(ru) ru.freeDays=(ru.freeDays||0)+1; }
      saveDB();
      return res.json({autoConnected:true,message:`PAYMENT AUTO CONFIRMED! N${payment.price} received. ${payment.plan} active. Your Code: ${payment.phone}`});
    }else return res.json({autoConnected:false,message:`Not yet paid. Status: ${v.data?.status||'pending'}`});
  }catch(e){ return res.json({autoConnected:false,message:e.message}); }
});

app.post('/api/paystack-webhook', (req,res)=>{
  const ev=req.body; if(ev.event==='charge.success'){ const ref=ev.data.reference; const pay=db.payments.find(p=>p.reference===ref); if(pay&&!pay.verified){ pay.verified=true; const u=db.users.find(x=>x.email===pay.email); if(u) u.isPremium=true; saveDB(); } } res.sendStatus(200);
});

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log('AUTO ONLY LIVE '+PORT));
