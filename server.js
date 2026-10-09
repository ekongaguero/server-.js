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
