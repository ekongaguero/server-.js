const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');
const app = express();
app.use(cors()); app.use(express.json());
let db=null;
try{ const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); admin.initializeApp({credential:admin.credential.cert(sa)}); db=admin.firestore(); }catch(e){ console.log('dev mode'); }
const PAYSTACK_SECRET=process.env.PAYSTACK_SECRET_KEY;
const ALLOWED=[100000,180000,250000,600000,200000,360000,500000,1200000,2400000,100];
const MONIEPOINT='9020274023'; const OWNER='owner@assess.com';
function verify(req){ if(!PAYSTACK_SECRET) return true; const h=crypto.createHmac('sha512',PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex'); return h===req.headers['x-paystack-signature']; }
async function checkUsage(email, limit){ const today=new Date().toISOString().split('T')[0]; const doc=await db.collection('usage').doc(`${email}_${today}`).get(); const used=doc.exists?doc.data().used_gb||0:0; const lim=limit&&limit.includes('100')?100:50; return {used, remaining:Math.max(0,lim-used), isFinished:used>=lim, network:used>=lim?'3G':'5G', speed:used>=lim?'SLOW':'ULTRA'}; }
app.get('/',(req,res)=>res.send(`ASSESS V5 SIGNUP SIGNIN BIGFONT Moniepoint:${MONIEPOINT}`));
app.post('/api/signup', async(req,res)=>{
  const {name,email,deviceId}=req.body; if(!db) return res.json({success:true});
  const exists=await db.collection('users').doc(email).get(); if(exists.exists) return res.json({success:false, message:'Exists'});
  const code=`ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*9000)+1000}`;
  await db.collection('users').doc(email).set({name,email,deviceId, referralCode:code, created_at:admin.firestore.FieldValue.serverTimestamp(), limit:'Trial', plan_type:'TRIAL'},{merge:true});
  res.json({success:true, code});
});
app.post('/api/login', async(req,res)=>{
  const {email,deviceId}=req.body; if(!db) return res.json({allowed:true, dev_mode:true, network:'5G', speed:'ULTRA', limit:'50GB'});
  const doc=await db.collection('users').doc(email).get(); if(!doc.exists) return res.json({allowed:false, reason:'No account, sign up'});
  const data=doc.data(); if(data.deviceId && data.deviceId!==deviceId) return res.json({needTransfer:true, plan:data.plan_type, limit:data.limit||'50GB', expiry:data.expiry});
  if(data.owner||email===OWNER) return res.json({allowed:true, owner:true, limit:'100GB Unlimited', network:'5G', speed:'ULTRA'});
  const u=await checkUsage(email,data.limit); res.json({allowed:true, plan:data.plan_type, limit:data.limit, network:u.network, speed:u.speed, remaining:u.remaining, isFinished:u.isFinished, used:u.used});
});
app.post('/api/transfer-device', async(req,res)=>{ const {email,newDeviceId}=req.body; if(!db) return res.json({success:true}); const ref=db.collection('users').doc(email); await ref.update({deviceId:newDeviceId, currentDeviceId:newDeviceId, lastTransfer:new Date()}); res.json({success:true, message:'Plan moved'}); });
app.post('/api/pay', async(req,res)=>{
  const {email,amount,plan_type,duration}=req.body; if(!ALLOWED.includes(amount)) return res.status(400).json({error:'Invalid amount'});
  if(!PAYSTACK_SECRET) return res.json({success:true, authorization_url:`https://paystack.com/pay/demo-${email}`});
  try{ const pr=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST', headers:{Authorization:`Bearer ${PAYSTACK_SECRET}`,'Content-Type':'application/json'}, body:JSON.stringify({email,amount,metadata:{plan_type,duration,moniepoint:MONIEPOINT}, callback_url:'https://server-js-euw6.onrender.com/verified'})}); const d=await pr.json(); if(!d.status) return res.status(400).json({error:d.message}); res.json({success:true, authorization_url:d.data.authorization_url}); }catch(e){ res.status(500).json({error:e.message}); }
});
app.post('/api/paystack-webhook', async(req,res)=>{ if(!verify(req)) return res.status(401).send('BLOCK'); const ev=req.body; if(ev.event==='charge.success'&&db){ const email=ev.data.customer.email; const meta=ev.data.metadata||{}; const exp=new Date(); exp.setDate(exp.getDate()+30); if(meta.duration&&meta.duration.includes('90')) exp.setDate(exp.getDate()+60); await db.collection('users').doc(email).set({verified_by_paystack:true, plan_type:meta.plan_type||'BASIC', limit:'50GB', share:'1', expiry:exp, moniepoint:MONIEPOINT, network:'5G', verified_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true}); } res.sendStatus(200); });
app.post('/api/get-referral', async(req,res)=>{ const {email}=req.body; if(!db) return res.json({code:`ASSESS-${email.split('@')[0].toUpperCase()}123`}); const doc=await db.collection('users').doc(email).get(); if(doc.exists&&doc.data().referralCode) return res.json({code:doc.data().referralCode}); const code=`ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*9999)}`; await db.collection('users').doc(email).set({referralCode:code},{merge:true}); res.json({code}); });
const PORT=process.env.PORT||10000; app.listen(PORT,()=>console.log(`V5 ${PORT}`));
