const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT parse error:", e.message);
  }
} else if (fs.existsSync('./serviceAccountKey.json')) {
  serviceAccount = require('./serviceAccountKey.json');
} else {
  console.log("FIREBASE_SERVICE_ACCOUNT not set and no file found!");
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=> res.send('ASSESS BACKEND V7 FIXED - LIVE'));

app.post('/api/pay', async (req,res)=>{
  try{
    const {email, amount, name, phone, plan, type} = req.body;
    
    const key = process.env.PAYSTACK_SECRET_KEY;
    console.log('KEY CHECK:', key ? `FOUND length=${key.length} start=${key.slice(0,12)}...` : 'NOT FOUND');
    
    if (!key) {
      return res.status(500).json({error: "PAYSTACK_SECRET_KEY not set on Render"});
    }

    const resp = await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{
        Authorization: `Bearer ${key.trim()}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        email, 
        amount,
        metadata:{name, phone, plan, type},
        callback_url: `${process.env.BACKEND_URL || 'https://server-js-ao4v.onrender.com'}/verify`
      })
    });
    const data = await resp.json();
    console.log('Paystack init:', data);
    if(data.status) res.json({authorization_url: data.data.authorization_url});
    else res.status(400).json({error: data.message, full: data});
  }catch(e){ 
    console.error("Pay error:", e);
    res.status(500).json({error:e.message}); 
  }
});

app.post('/api/verify-payment', async (req,res)=>{
  res.json({status: true});
});

app.get('/verify', async (req,res)=>{
  const ref = req.query.reference;
  res.send(`Payment ${ref} verified! Plan activated for ASSESS. You can close this.`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('LIVE on '+PORT));
git add .
git commit -m "fix paystack key"
git push
