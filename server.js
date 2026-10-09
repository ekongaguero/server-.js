// ASSESS V4 SECURED - FINAL
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
} catch(e){ console.log('Firebase not set yet, using memory mode'); }

// --- Config ---
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const ALLOWED_AMOUNTS = [100000, 180000, 250000, 350000, 600000, 1200000, 1800000, 3500000, 200000, 360000, 500000, 700000, 1200000, 2400000, 3600000, 7000000]; // kobo
const MONIEPOINT = '9020274023';
const OWNER_EMAIL = 'owner@assess.com';

function verifyPaystackSignature(req){
  if(!PAYSTACK_SECRET) return true; // allow if not set yet
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex');
  return hash === req.headers['x-paystack-signature'];
}

// --- Routes ---
app.get('/', (req,res)=> res.send('ASSESS V4 SECURED - 50GB/day, Owner 100GB Unlimited, Moniepoint:'+MONIEPOINT));

app.post('/api/login', async (req,res)=>{
  const {email, deviceId} = req.body;
  if(!db) return res.json({allowed:true, dev_mode:true});
  const doc = await db.collection('users').doc(email).get();
  if(!doc.exists) return res.json({allowed:false, reason:'No active plan'});
  const data = doc.data();
  if(data.verified_by_paystack !== true) return res.json({allowed:false, reason:'Not verified'});
  if(data.expiry && data.expiry._seconds*1000 < Date.now()) return res.json({allowed:false, reason:'Expired'});
  if(data.deviceId && data.deviceId !== deviceId){
    return res.json({needTransfer:true, plan:data.plan_type, expiry:data.expiry, limit:data.limit});
  }
  res.json({allowed:true, plan:data.plan_type, expiry:data.expiry});
});

app.post('/api/transfer-device', async (req,res)=>{
  const {email, newDeviceId} = req.body;
  if(!db) return res.json({success:true, limit:'50GB', plan_kept:'BASIC'});
  const docRef = db.collection('users').doc(email);
  const doc = await docRef.get();
  if(!doc.exists) return res.status(404).json({error:'No user'});
  const data = doc.data();
  // KEEP PLAN - THIS IS THE LOCKED FEATURE
  const plan_kept = data.plan_type;
  const expiry_kept = data.expiry;
  const daily_kept = data.daily_used;
  await docRef.update({deviceId:newDeviceId, plan_kept, expiry_kept, daily_kept, transferred_at: admin.firestore.FieldValue.serverTimestamp()});
  res.json({success:true, limit: data.limit || '50GB', plan_kept, expiry_kept, daily_kept, message:'Plan Stays - Old device disconnected'});
});

app.post('/api/owner-activate', async (req,res)=>{
  const {email} = req.body;
  if(email !== OWNER_EMAIL) return res.status(403).json({error:'Only owner'});
  if(!db) return res.json({success:true, owner:'100GB Unlimited ♾️ activated 1 year'});
  const expiry = new Date(); expiry.setFullYear(expiry.getFullYear()+1);
  await db.collection('users').doc(email).set({
    email, deviceId:'OWNER_DEVICE', plan_type:'OWNER', limit:'100GB Unlimited ♾️', share:'UNLIMITED', expiry, verified_by_paystack:true, owner:true, moniepoint:MONIEPOINT, activated_at: admin.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  res.json({success:true, owner:'100GB Unlimited ♾️ activated till '+expiry.toDateString()});
});

app.post('/api/pay', async (req,res)=>{
  const {email, amount, plan_type, duration} = req.body;
  if(!ALLOWED_AMOUNTS.includes(amount)) return res.status(400).json({error:'Amount not allowed', moniepoint:MONIEPOINT});
  // Create Paystack transaction here - for now return demo link
  res.json({success:true, authorization_url:`https://paystack.com/pay/demo-${email}-${amount}`, moniepoint:MONIEPOINT, note:'Add PAYSTACK_SECRET_KEY to enable real link'});
});

app.post('/api/paystack-webhook', (req,res)=>{
  if(!verifyPaystackSignature(req)) return res.status(401).send('BLOCKED - fake webhook');
  const event = req.body;
  if(event.event === 'charge.success'){
    console.log('PAYMENT OK', event.data.amount, 'Moniepoint:', MONIEPOINT, 'Email:', event.data.customer.email);
    // Here you verify and write to Firebase
    if(db){
      const email = event.data.customer.email;
      const expiry = new Date(); expiry.setDate(expiry.getDate()+30);
      db.collection('users').doc(email).set({
        verified_by_paystack:true, plan_type:'BASIC', limit:'50GB', expiry, amount:event.data.amount, moniepoint:MONIEPOINT
      }, {merge:true});
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('ASSESS V4 SECURED running on '+PORT));
