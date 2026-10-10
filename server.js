const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();
app.use(cors());
app.use(express.json());

console.log("--- ENV CHECK ---");
console.log("Keys found:", Object.keys(process.env).filter(k=>k.includes('FIREBASE')));
let serviceAccount;
try {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if(!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is undefined - not set on Render");
  
  // Fix newlines
  raw = raw.trim();
  serviceAccount = JSON.parse(raw);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase connected ✅ Project:", serviceAccount.project_id);
} catch(e) {
  console.log("Firebase error", e.message);
  console.log("FIX: Re-paste JSON as single line without line breaks");
}

app.get('/', (req,res)=> res.send('ASSESS AUTO-ACTIVATE LIVE - Moniepoint 9020274023 - ASSESS INTERNET'));

app.post('/api/payments/submit', async (req,res)=>{
  const { reference, email, name, amount, planId } = req.body;
  try {
    if(admin.apps.length>0){
      const db = admin.firestore();
      await db.collection('payments').doc(reference).set({
        email, name, amount, planId, status:'approved', createdAt: new Date()
      });
      await db.collection('users').doc(email).set({
        isPremium:true, planId, premiumUntil: new Date(Date.now()+30*24*60*60*1000)
      }, {merge:true});
    }
    res.json({success:true, message:'Payment auto-approved Moniepoint 9020274023'});
  } catch(err){
    console.log(err);
    res.json({success:true}); // emergency approve even if firebase fails
  }
});

app.listen(10000, ()=> console.log('LIVE AUTO Moniepoint 9020274023'));
