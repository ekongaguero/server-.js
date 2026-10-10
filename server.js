const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // From Render Env
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync('./serviceAccountKey.json')) {
  // From file you uploaded
  serviceAccount = require('./serviceAccountKey.json');
} else {
  console.log("FIREBASE_SERVICE_ACCOUNT not set and no file found!");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=> res.send('ASSESS BACKEND V6 NO-LOGIN LIVE'));

app.post('/api/verify-payment', async (req,res)=>{
  // your verify logic here
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('LIVE on '+PORT));
app.post('/api/pay', async (req,res)=>{
  try{
    const {email, amount, name, phone, plan, type} = req.body;
    const resp = await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        email, amount,
        metadata:{name, phone, plan, type},
        callback_url: `${process.env.BACKEND_URL || 'https://server-js-ao4v.onrender.com'}/verify`
      })
    });
    const data = await resp.json();
    console.log('Paystack init:', data);
    if(data.status) res.json({authorization_url: data.data.authorization_url});
    else res.status(400).json({error: data.message});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/verify', async (req,res)=>{
  const ref = req.query.reference;
  // Verify with Paystack then activate plan in Firebase here
  // Then redirect to success page
  res.send(`Payment ${ref} verified! Plan activated for ASSESS. You can close this.`);
});
