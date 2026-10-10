const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

try {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
} catch(e){ console.log("Firebase error", e.message); }

const app = express();
app.use(cors());
app.use(express.json());

const BANK = "Moniepoint";
const ACCT = "9020274023";
const ACCT_NAME = "ASSESS INTERNET";

app.get('/', (req,res)=> res.send('ASSESS AUTO-ACTIVATE LIVE'));

app.post('/api/pay', async (req,res)=>{
  try{
    const { email, name, phone, plan, amount } = req.body;
    const reference = 'ASSESS-' + Date.now();
    const db = admin.firestore();

    // 1. Save payment
    await db.collection('payments').doc(reference).set({
      email, name, phone, plan: plan || 'premium',
      amount: amount || 24000000,
      bank: BANK, accountNumber: ACCT,
      reference,
      status: 'approved', // AUTO APPROVED
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. AUTO ACTIVATE USER - This is the key
    // We find user by email and activate
    const userQuery = await db.collection('users').where('email','==', email).get();

    if(!userQuery.empty){
      const userDoc = userQuery.docs[0];
      await userDoc.ref.update({
        plan: plan || 'premium',
        isPremium: true,
        premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentReference: reference,
        accountActivated: true
      });
      console.log('Auto activated existing user:', email);
    } else {
      // If user doc doesn't exist yet, create it
      await db.collection('users').doc(email).set({
        email, name, phone,
        plan: plan || 'premium',
        isPremium: true,
        accountActivated: true,
        premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentReference: reference
      }, {merge: true});
      console.log('Auto activated new user doc:', email);
    }

    res.json({
      success: true,
      autoActivated: true,
      bank: BANK,
      accountNumber: ACCT,
      accountName: ACCT_NAME,
      reference,
      amount: (amount || 24000000)/100,
      message: 'Payment received, plan activated automatically!'
    });

  }catch(e){
    console.error("Pay error:", e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/check-access/:email', async (req,res)=>{
  try{
    const db = admin.firestore();
    const email = req.params.email;
    // Check both by doc ID and by email field
    let doc = await db.collection('users').doc(email).get();
    if(!doc.exists){
      const q = await db.collection('users').where('email','==', email).get();
      if(!q.empty) doc = q.docs[0];
    }
    if(!doc.exists) return res.json({hasAccess: false});
    const data = doc.data();
    res.json({hasAccess:!!data.isPremium ||!!data.accountActivated, plan: data.plan});
  }catch(e){ res.status(500).json({error: e.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`LIVE with AUTO ACTIVATE ${BANK} ${ACCT}`));
