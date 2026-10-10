const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();
app.use(cors());
app.use(express.json());

// Firebase
try{
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
  console.log("Firebase connected ✅ Project:", serviceAccount.project_id);
}catch(e){ console.log("Firebase error", e.message); }

const BANK = "Moniepoint";
const ACCOUNT = "9020274023";
const NAME = "ASSESS INTERNET";

app.get('/', (req,res)=> res.send(`ASSESS AUTO-ACTIVATE LIVE - ${BANK} ${ACCOUNT} - ${NAME}`));

// Endpoint YOUR APP EXPECTS
app.post('/api/pay', async (req,res)=>{
  const { email, amount, name, phone, plan, type } = req.body;
  const realAmountNaira = Math.round((amount||0)/100); // 1000 => 1000
  const reference = "ASS-"+Date.now();
  
  try{
    if(admin.apps.length){
      const db = admin.firestore();
      await db.collection('payments').doc(reference).set({
        email: email.toLowerCase(), name, phone, plan, type,
        amount: realAmountNaira, bank: BANK, accountNumber: ACCOUNT,
        status: 'approved', autoActivated: true, createdAt: new Date()
      });
      await db.collection('users').doc(email.toLowerCase()).set({
        isPremium: true, name, phone, plan, type, premiumUntil: new Date(Date.now()+30*24*60*60*1000)
      }, {merge:true});
    }
    res.json({
      success: true,
      autoActivated: true,
      bank: BANK,
      accountNumber: ACCOUNT,
      accountName: NAME,
      amount: realAmountNaira,
      reference
    });
  }catch(err){
    console.log(err);
    res.json({success:true, autoActivated:true, bank:BANK, accountNumber:ACCOUNT, amount:realAmountNaira, reference});
  }
});

app.get('/api/users', async (req,res)=>{
  if(!admin.apps.length) return res.send("Firebase not connected");
  const snap = await admin.firestore().collection('users').get();
  const users = snap.docs.map(d=>d.data());
  res.json(users);
});

app.listen(10000, ()=> console.log(`LIVE AUTO ${BANK} ${ACCOUNT}`));
