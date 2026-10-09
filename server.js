const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');
const app = express();
app.use(cors());
app.use(express.json());
let db = null;
try{ const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); admin.initializeApp({credential:admin.credential.cert(sa)}); db=admin.firestore(); }catch(e){ console.log('dev mode'); }
const PAYSTACK_SECRET=process.env.PAYSTACK_SECRET_KEY;
const ALLOWED_AMOUNTS=[100000,180000,250000,600000,200000,360000,500000,1200000,2400000];
const MONIEPOINT='9020274023'; const OWNER_EMAIL='owner@assess.com';
function verifySig(req){ if(!PAYSTACK_SECRET) return true; const h=crypto.createHmac('sha512',PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex'); return h===req.headers['x-paystack-signature']; }
async function checkUsage(email, limitStr){ const today=new Date().toISOString().split('T')[0]; const doc=await db.collection('usage').doc(`${email}_${today}`).get(); const used=doc.exists?doc.data().used_gb||0:0; const limit=limitStr&&limitStr.includes('100GB')?100:50; const rem=Math.max(0,limit-used); return {used, remaining:rem, isFinished:used>=limit, network:used>=limit?'3G':'5G', speed:used>=limit?'SLOW':'ULTRA'}; }
app.get('/',(req,res)=>res.send(`ASSESS V4 SECURED 5G->3G PlanStays Referral LogoFixed Moniepoint:${MONIEPOINT}`));
app.post('/api/login', async (req,res)=>{
  const {email,deviceId}=req.body; if(!db) return res.json({allowed:true, dev_mode:true, network:'5G', speed:'ULTRA', limit:'50GB'});
  const doc=await db.collection('users').doc(email).get(); if(!doc.exists) return res.json({allowed:false, reason:'No plan'});
  const data=doc.data(); if(data.deviceId && data.deviceId!==deviceId) return res.json({needTransfer:true, plan:data.plan_type, expiry:data.expiry, limit:data.limit||'50GB'});
  if(data.owner||email===OWNER_EMAIL) return res.json({allowed:true, plan:'OWNER', limit:'100GB Unlimited ♾️', share:'UNLIMITED', network:'5G', speed:'ULTRA', owner:true, expiry:data.expiry});
  const usage=await checkUsage(email,data.limit||'50GB');
  res.json({allowed:true, plan:data.plan_type, expiry:data.expiry, limit:data.limit||'50GB', network:usage.network, speed:usage.speed, used:usage.used, remaining:usage.remaining, isFinished:usage.isFinished});
});
app.post('/api/transfer-device', async (req,res)=>{
  const {email,newDeviceId}=req.body; if(!db) return res.json({success:true, limit:'50GB'});
  const ref=db.collection('users').doc(email); const doc=await ref.get(); const u=doc.data();
  await ref.update({deviceId:newDeviceId, currentDeviceId:newDeviceId, lastTransfer:new Date(), transferCount:admin.firestore.FieldValue.increment(1)});
  res.json({success:true, allowed:true, limit:u.limit||'50GB', message:`Plan Stays ${u.plan_type} ${u.limit} till expiry`});
});
app.post('/api/owner-activate', async (req,res)=>{
  const {email}=req.body; if(email!==OWNER_EMAIL) return res.status(403).json({error:'Only owner'}); if(!db) return res.json({success:true});
  const exp=new Date(); exp.setFullYear(exp.getFullYear()+1);
  await db.collection('users').doc(email).set({email, deviceId:'OWNER_DEVICE', currentDeviceId:'OWNER_DEVICE', plan_type:'OWNER', limit:'100GB Unlimited ♾️', share:'UNLIMITED', expiry:exp, verified_by_paystack:true, owner:true, moniepoint:MONIEPOINT, network:'5G', activated_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  res.json({success:true, owner:`100GB Unlimited ♾️ till ${exp.toDateString()}`});
});
app.post('/api/pay', async (req,res)=>{
  const {email,amount,plan_type,duration}=req.body; if(!ALLOWED_AMOUNTS.includes(amount)) return res.status(400).json({error:'Amount not allowed'});
  if(!PAYSTACK_SECRET) return res.json({success:true, authorization_url:`https://paystack.com/pay/demo-${email}`, auto_filled:{email, amount:amount/100, plan_type, duration, moniepoint:MONIEPOINT}});
  try{ const pr=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST', headers:{Authorization:`Bearer ${PAYSTACK_SECRET}`,'Content-Type':'application/json'}, body:JSON.stringify({email,amount,metadata:{plan_type,duration,moniepoint:MONIEPOINT}, callback_url:'https://server-js-euw6.onrender.com/verified'})}); const d=await pr.json(); if(!d.status) return res.status(400).json({error:d.message}); res.json({success:true, authorization_url:d.data.authorization_url}); }catch(e){ res.status(500).json({error:e.message}); }
});
app.post('/api/paystack-webhook', async (req,res)=>{
  if(!verifySig(req)) return res.status(401).send('BLOCKED'); const ev=req.body; if(ev.event==='charge.success'&&db){ const email=ev.data.customer.email; const amount=ev.data.amount; const meta=ev.data.metadata||{}; const exp=new Date(); exp.setDate(exp.getDate()+30); if(meta.duration&&meta.duration.includes('90')) exp.setDate(exp.getDate()+60); await db.collection('users').doc(email).set({email, verified_by_paystack:true, plan_type:meta.plan_type||'BASIC', duration:meta.duration||'30 Days', limit:'50GB', share:'1', expiry:exp, amount, moniepoint:MONIEPOINT, network:'5G', verified_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true}); } res.sendStatus(200);
});
app.post('/api/get-referral', async (req,res)=>{ const {email}=req.body; if(!db) return res.json({code:`ASSESS-${email.split('@')[0].toUpperCase()}123`}); const doc=await db.collection('users').doc(email).get(); if(doc.exists&&doc.data().referralCode) return res.json({code:doc.data().referralCode}); const code=`ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*9999)}`; await db.collection('users').doc(email).set({referralCode:code},{merge:true}); res.json({code}); });
app.post('/api/apply-referral', async (req,res)=>{ const {newEmail,referralCode}=req.body; if(!db) return res.json({success:true}); const q=await db.collection('users').where('referralCode','==',referralCode).get(); if(q.empty) return res.json({success:false}); const refEmail=q.docs[0].id; await db.collection('users').doc(refEmail).update({referralCount:admin.firestore.FieldValue.increment(1), referralBonusGB:admin.firestore.FieldValue.increment(5)}); await db.collection('users').doc(newEmail).set({referredBy:referralCode, referrer:refEmail, referralBonusGB:5},{merge:true}); res.json({success:true}); });
app.post('/api/report-usage', async (req,res)=>{ const {email,gb_used}=req.body; if(!db) return res.json({ok:true}); const today=new Date().toISOString().split('T')[0]; await db.collection('usage').doc(`${email}_${today}`).set({email,date:today,used_gb:admin.firestore.FieldValue.increment(gb_used||1)},{merge:true}); const u=await checkUsage(email,'50GB'); res.json({ok:true, network:u.network, isFinished:u.isFinished}); });
const PORT=process.env.PORT||10000; app.listen(PORT,()=>console.log(`V4 SECURED ${PORT}`));
