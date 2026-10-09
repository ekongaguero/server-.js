const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// === FIREBASE ===
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("FIREBASE_SERVICE_ACCOUNT not set in Render");
}
if (serviceAccount &&!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// === CONFIG ===
const OWNER_EMAIL = 'owner@assess.com';
const OWNER_PHONE = '+2349020274023';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const PLANS = {
  BASIC: { limit: 50, share: 1, rollover: true },
  PREMIUM: { limit: 50, share: 1, rollover: false }
};

// === HEALTH ===
app.get('/', (req,res)=> res.send('ASSESS BACKEND V5 PHONE LIVE ✅ Moniepoint 9020274023'));

// === LOGIN - PHONE BASED ===
app.post('/api/login', async (req,res)=>{
  const { email, phone, deviceId } = req.body;
  const lookupEmail = email || (phone? phone.replace('+','')+'@assess.ng' : '');
  const lookupPhone = phone || '';

  // Owner bypass
  if (lookupEmail === OWNER_EMAIL || lookupPhone === OWNER_PHONE) {
    return res.json({ allowed: true, limit: 100, isOwner: true, network:'5G', remaining: 100, used: 0, isFinished: false, speed:'UNLIMITED' });
  }

  try{
    // Search by phone first, then email for old users
    let userDoc = null;
    let qPhone = await db.collection('users').where('phone','==',lookupPhone).limit(1).get();
    if(!qPhone.empty) userDoc = qPhone.docs[0];
    else {
      let qEmail = await db.collection('users').where('email','==',lookupEmail).limit(1).get();
      if(!qEmail.empty) userDoc = qEmail.docs[0];
    }

    if(!userDoc) return res.json({ allowed: false, reason: 'No active plan. Pay first.' });

    const user = userDoc.data();
    const now = Date.now();
    const expiry = user.expiry && user.expiry._seconds? user.expiry._seconds*1000 : user.expiry;
    if(now > expiry) return res.json({ allowed: false, reason: 'Plan expired. Renew.' });

    // Transfer check - device mismatch
    if(user.deviceId && user.deviceId!== deviceId){
      return res.json({ needTransfer: true, plan: user.limit+'GB', expiry: user.expiry });
    }

    // Update deviceId if not set
    if(!user.deviceId) await userDoc.ref.update({ deviceId });

    // Calculate usage today
    const today = new Date().toISOString().slice(0,10);
    const usageRef = await db.collection('usage').doc(`${userDoc.id}_${today}`).get();
    const used = usageRef.exists? usageRef.data().used : 0;
    const remaining = Math.max(0, (user.limit||50) - used);
    const isFinished = remaining <= 0;

    return res.json({
      allowed: true,
      limit: user.limit,
      expiry: user.expiry,
      network: isFinished? '3G' : '5G',
      speed: isFinished? 'SLOW' : 'ULTRA',
      remaining,
      used,
      isFinished,
      referralCode: user.referralCode
    });

  }catch(e){
    console.error(e);
    return res.json({ allowed: true, limit:50, network:'5G', remaining:50 }); // fail open for demo
  }
});

// === TRANSFER DEVICE - PLAN STAYS ===
app.post('/api/transfer-device', async (req,res)=>{
  const { email, phone, newDeviceId } = req.body;
  const lookupPhone = phone;
  const lookupEmail = email;
  try{
    let q = await db.collection('users').where('phone','==',lookupPhone).limit(1).get();
    if(q.empty) q = await db.collection('users').where('email','==',lookupEmail).limit(1).get();
    if(q.empty) return res.json({ error:'User not found' });
    const doc = q.docs[0];
    await doc.ref.update({ deviceId: newDeviceId });
    const user = doc.data();
    return res.json({ success:true, limit: user.limit, expiry: user.expiry, message:'Plan moved, old phone disconnected' });
  }catch(e){ res.status(500).json({error:e.message}); }
});

// === PAYSTACK INITIALIZE ===
app.post('/api/pay', async (req,res)=>{
  const { email, phone, amount, plan_type, duration, price_label } = req.body;
  if(!PAYSTACK_SECRET) return res.json({ success:false, reason:'PAYSTACK_SECRET not set' });
  try{
    const https = require('https');
    const params = JSON.stringify({
      email: email,
      amount: amount,
      metadata: { phone, plan_type, duration, price_label },
      callback_url: 'https://assess.ng/verify'
    });
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    };
    const payReq = https.request(options, payRes=>{
      let data='';
      payRes.on('data', chunk=> data+=chunk);
      payRes.on('end', ()=> {
        const j = JSON.parse(data);
        if(j.status) res.json({ success:true, authorization_url: j.data.authorization_url, reference: j.data.reference });
        else res.json({ success:false, data:j });
      });
    });
    payReq.on('error', e=> res.json({ success:false, error:e.message }));
    payReq.write(params);
    payReq.end();
  }catch(e){ res.json({success:false, error:e.message}); }
});

// === PAYSTACK WEBHOOK - AUTO GIVE PLAN ===
app.post('/api/paystack-webhook', async (req,res)=>{
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex');
  if(hash!== req.headers['x-paystack-signature']) return res.status(400).send('Invalid sig');
  const event = req.body;
  if(event.event === 'charge.success'){
    const { email, metadata } = event.data;
    const phone = metadata.phone;
    const plan_type = metadata.plan_type || 'BASIC';
    const duration = metadata.duration || '30 Days';
    const daysMap = {'1 Day':1,'2-3 Days':3,'Weekly':7,'14 Days':14,'30 Days':30,'90 Days':90,'180 Days':180,'365 Days':365};
    const days = daysMap[duration] || 30;
    const expiry = new Date(Date.now() + days*24*60*60*1000);
    const limit = plan_type==='BASIC'? 50 : 50;
    const refCode = 'ASSESS-'+ Math.random().toString(36).slice(2,6).toUpperCase();

    // Upsert user
    let q = await db.collection('users').where('phone','==',phone).limit(1).get();
    if(!q.empty){
      await q.docs[0].ref.update({ email, phone, plan_type, duration, limit, expiry, referralCode: refCode, updated: new Date() });
    } else {
      await db.collection('users').add({ email, phone, plan_type, duration, limit, expiry, referralCode: refCode, created: new Date(), deviceId: null });
    }
  }
  res.sendStatus(200);
});

// === REFERRAL ===
app.post('/api/get-referral', async (req,res)=>{
  const { phone, email } = req.body;
  try{
    let q = await db.collection('users').where('phone','==',phone).limit(1).get();
    if(q.empty) q = await db.collection('users').where('email','==',email).limit(1).get();
    if(q.empty) return res.json({ code:'ASSESS-NEW' });
    const user = q.docs[0].data();
    res.json({ code: user.referralCode || 'ASSESS-XXXX' });
  }catch(e){ res.json({ code:'ASSESS-XXXX' }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('ASSESS V5 PHONE LIVE on '+PORT));
