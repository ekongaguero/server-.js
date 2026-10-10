const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');

let serviceAccount = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (fs.existsSync('./serviceAccountKey.json')) {
    serviceAccount = require('./serviceAccountKey.json');
  }
} catch (e) {
  console.log("Firebase parse error:", e.message);
}

if (serviceAccount) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=> res.send('ASSESS BACKEND V7 FIXED'));

app.post('/api/pay', async (req,res)=>{
  try{
    const key = process.env.PAYSTACK_SECRET_KEY;
    console.log('KEY CHECK:', key ? 'FOUND length='+key.length : 'NOT FOUND');
    if(!key) return res.status(500).json({error:'PAYSTACK_SECRET_KEY not set'});
    
    const {email, amount, name, phone, plan, type} = req.body;
    const resp = await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{
        Authorization: `Bearer ${key.trim()}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        email, amount,
        metadata:{name, phone, plan, type},
        callback_url: 'https://server-js-ao4v.onrender.com/verify'
      })
    });
    const data = await resp.json();
    console.log('Paystack init:', data);
    if(data.status) res.json({authorization_url: data.data.authorization_url});
    else res.status(400).json({error: data.message});
  }catch(e){
    console.log('Pay error', e.message);
    res.status(500).json({error:e.message});
  }
});

app.get('/verify', (req,res)=>{
  res.send(`Payment ${req.query.reference} verified! Close this.`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('LIVE on '+PORT));
