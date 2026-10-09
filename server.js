// ASSESS V4 FINAL SECURED - 5G→3G + Plan Stays + Auto-fill + Referral + Anti-hack + Owner 100GB Unlimited ♾️
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// --- Firebase ---
let db = null;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log('Firebase OK');
} catch(e){ console.log('Firebase not set yet - dev mode'); }

// --- Config ---
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const ALLOWED_AMOUNTS = [100000, 180000, 250000, 350000, 600000, 1200000, 1800000, 3500000, 200000, 360000, 500000, 700000, 1200000, 2400000, 3600000, 7000000, 12000000, 24000000, 7000000];
const MONIEPOINT = '9020274023';
const OWNER_EMAIL = 'owner@assess.com';

function verifyPaystackSignature(req){
  if(!PAYSTACK_SECRET) return true;
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex');
  return hash === req.headers['x-paystack-signature'];
}

async function checkUsage(email, limitStr){
  const today = new Date().toISOString().split('T')[0];
  const doc = await db.collection('usage').doc(`${email}_${today}`).get();
  const used = doc.exists? (doc.data().used_gb || 0) : 0;
  const isOwner = limitStr && limitStr.includes('100GB');
  const limit = isOwner? 100 : 50;
  const remaining = Math.max(0, limit - used);
  const isFinished = used >= limit;
  return { used, remaining, isFinished, network: isFinished? '3G' : '5G', speed: isFinished? 'SLOW' : 'ULTRA' };
}

// --- Routes ---
app.get('/', (req,res)=> res.send(`ASSESS V4 FINAL SECURED - 5G Ultra -> 3G after 50GB, Plan Stays, Referral +5GB, Moniepoint:${MONIEPOINT}`));

app.post('/api/login', async (req,res)=>{
  const {email, deviceId} = req.body;
  if(!db) return res.json({allowed:true, dev_mode:true, network:'5G', speed:'ULTRA', limit:'50GB'});
  const doc = await db.collection('users').doc(email).get();
  if(!doc.exists) return res.json({allowed:false, reason:'No active plan'});
  const data = doc.data();
  if(data.verified_by_paystack!== true &&!data.owner) return res.json({allowed:false, reason:'Not verified'});
  if(data.expiry && data.expiry._seconds && data.expiry._seconds*1000 < Date.now()) return res.json({allowed:false, reason:'Expired - Renew'});

  if(data.deviceId && data.deviceId!== deviceId){
    return res.json({needTransfer:true, plan:data.plan_type, expiry:data.expiry, limit:data.limit || '50GB'});
  }

  if(data.owner || email === OWNER_EMAIL){
    return res.json({allowed:true, plan:'OWNER', limit:'100GB Unlimited ♾️', share:'UNLIMITED', network:'5G', speed:'ULTRA', owner:true, expiry:data.expiry});
  }

  const usage = await checkUsage(email, data.limit || '50GB');
  res.json({
    allowed:true,
    plan:data.plan_type,
    expiry:data.expiry,
    limit: data.limit || '50GB',
    network: usage.network,
    speed: usage.speed,
    used: usage.used,
    remaining: usage.remaining,
    isFinished: usage.isFinished,
    referralBonus: data.referralBonusGB || 0
  });
});

app.post('/api/transfer-device', async (req,res)=>{
  const {email, newDeviceId} = req.body;
  if(!db) return res.json({success:true, limit:'50GB', plan_kept:'BASIC'});
  const docRef = db.collection('users').doc(email);
  const doc = await docRef.get();
  if(!doc.exists) return res.status(404).json({error:'No user'});
  const u = doc.data();

  // PLAN STAYS - ONLY CHANGE DEVICE
  await docRef.update({
    deviceId: newDeviceId,
    currentDeviceId: newDeviceId,
    lastTransfer: new Date(),
    transferCount: admin.firestore.FieldValue.increment(1)
    // NEVER touch expiry, plan_type, limit, status
  });

  await db.collection('transfers').add({
    email, newDeviceId, oldDeviceId: u.deviceId || u.currentDeviceId,
    plan_kept: u.plan_type, expiry_kept: u.expiry, daily_kept: u.limit, time:new Date()
  });

  res.json({
    success:true,
    allowed:true,
    limit: u.limit || '50GB',
    plan_kept: u.plan_type,
    expiry_kept: u.expiry,
    message:`Plan Stays: ${u.plan_type} ${u.limit} till expiry - Old device disconnected`
  });
});

app.post('/api/owner-activate', async (req,res)=>{
  const {email} = req.body;
  if(email!== OWNER_EMAIL) return res.status(403).json({error:'Only owner'});
  if(!db) return res.json({success:true, owner:'100GB Unlimited ♾️ 5G activated 1 year'});
  const expiry = new Date(); expiry.setFullYear(expiry.getFullYear()+1);
  await db.collection('users').doc(email).set({
    email, deviceId:'OWNER_DEVICE', currentDeviceId:'OWNER_DEVICE',
    plan_type:'OWNER', limit:'100GB Unlimited ♾️', share:'UNLIMITED', expiry,
    verified_by_paystack:true, owner:true, moniepoint:MONIEPOINT,
    network:'5G', speed:'ULTRA', activated_at: admin.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  res.json({success:true, owner:`100GB Unlimited ♾️ 5G activated till ${expiry.toDateString()}`, network:'5G'});
});

app.post('/api/pay', async (req,res)=>{
  const {email, amount, plan_type, duration} = req.body;
  if(!ALLOWED_AMOUNTS.includes(amount)) return res.status(400).json({error:'Amount not allowed', moniepoint:MONIEPOINT});
  if(!PAYSTACK_SECRET) return res.json({success:true, authorization_url:`https://paystack.com/pay/demo-${email}-${amount}`, auto_filled:{email, amount:amount/100, plan_type, duration, moniepoint:MONIEPOINT}, note:'Add PAYSTACK_SECRET_KEY in Render to enable real Paystack'});
  try{
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type':'application/json'},
      body: JSON.stringify({
        email,
        amount,
        metadata:{
          plan_type, duration, moniepoint:MONIEPOINT,
          custom_fields:[
            {display_name:"Plan", variable_name:"plan", value:`${plan_type} - ${duration}`},
            {display_name:"Moniepoint", variable_name:"moniepoint", value:MONIEPOINT}
          ]
        },
        callback_url: 'https://server-js-euw6.onrender.com/verified'
      })
    });
    const data = await paystackRes.json();
    if(!data.status) return res.status(400).json({error:data.message});
    res.json({success:true, authorization_url:data.data.authorization_url, access_code:data.data.access_code, auto_filled:{email, amount:amount/100, plan_type, duration, moniepoint:MONIEPOINT}});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/paystack-webhook', async (req,res)=>{
  if(!verifyPaystackSignature(req)) return res.status(401).send('BLOCKED - fake webhook');
  const event = req.body;
  if(event.event === 'charge.success' && db){
    const email = event.data.customer.email;
    const amount = event.data.amount;
    const meta = event.data.metadata || {};
    const expiry = new Date(); expiry.setDate(expiry.getDate()+30);
    if(meta.duration && meta.duration.includes('90')) expiry.setDate(expiry.getDate()+60);
    await db.collection('users').doc(email).set({
      email, verified_by_paystack:true, plan_type: meta.plan_type || 'BASIC',
      duration: meta.duration || '30 Days', limit:'50GB', share:'1', expiry, amount,
      moniepoint:MONIEPOINT, network:'5G', verified_at: admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    console.log(`PAYMENT OK ${email} ${amount} ${meta.plan_type} Moniepoint:${MONIEPOINT}`);
  }
  res.sendStatus(200);
});

// REFERRAL PROGRAM
app.post('/api/get-referral', async (req,res)=>{
  const {email} = req.body;
  if(!db) return res.json({code:`ASSESS-${email.split('@')[0].toUpperCase()}123`, count:0, earnings:0});
  const doc = await db.collection('users').doc(email).get();
  if(doc.exists && doc.data().referralCode) return res.json({code:doc.data().referralCode, count:doc.data().referralCount||0, earnings:doc.data().referralBonusGB||0});
  const code = `ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*9999)}`;
  await db.collection('users').doc(email).set({referralCode:code, referralCount:0, referralBonusGB:0}, {merge:true});
  res.json({code, count:0, earnings:0});
});

app.post('/api/apply-referral', async (req,res)=>{
  const {newEmail, referralCode} = req.body;
  if(!db) return res.json({success:true, message:'Referral +5GB (dev)'});
  const q = await db.collection('users').where('referralCode','==',referralCode).get();
  if(q.empty) return res.json({success:false, error:'Invalid referral code'});
  const referrerEmail = q.docs[0].id;
  await db.collection('users').doc(referrerEmail).update({
    referralCount: admin.firestore.FieldValue.increment(1),
    referralBonusGB: admin.firestore.FieldValue.increment(5)
  });
  await db.collection('users').doc(newEmail).set({
    referredBy:referralCode, referrer:referrerEmail, referralBonusGB:5, joinedWithReferral:true
  }, {merge:true});
  res.json({success:true, message:'Referral applied! +5GB bonus for both', referrer:referrerEmail});
});

app.post('/api/report-usage', async (req,res)=>{
  const {email, gb_used} = req.body;
  if(!db) return res.json({ok:true});
  const today = new Date().toISOString().split('T')[0];
  const ref = db.collection('usage').doc(`${email}_${today}`);
  await ref.set({email, date:today, used_gb: admin.firestore.FieldValue.increment(gb_used || 1)}, {merge:true});
  const usage = await checkUsage(email, '50GB');
  res.json({ok:true, network:usage.network, isFinished:usage.isFinished, remaining:usage.remaining});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`ASSESS V4 FINAL SECURED running on ${PORT} - 5G->3G | Plan Stays | Referral | Moniepoint:${MONIEPOINT}`));
