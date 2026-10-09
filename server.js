// REFERRAL PROGRAM
app.post('/api/get-referral', async (req,res)=>{
  const {email} = req.body;
  const doc = await db.collection('users').doc(email).get();
  if(!doc.exists) return res.json({code: `ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*999)}`});
  const data = doc.data();
  if(data.referralCode) return res.json({code:data.referralCode, count:data.referralCount||0, earnings:data.referralBonusGB||0});
  const code = `ASSESS-${email.split('@')[0].toUpperCase()}${Math.floor(Math.random()*9999)}`;
  await db.collection('users').doc(email).update({referralCode:code});
  res.json({code, count:0, earnings:0});
});

app.post('/api/apply-referral', async (req,res)=>{
  const {newEmail, referralCode} = req.body;
  // Find owner of code
  const q = await db.collection('users').where('referralCode','==',referralCode).get();
  if(q.empty) return res.json({success:false, error:'Invalid code'});
  const referrerDoc = q.docs[0];
  const referrerEmail = referrerDoc.id;
  // Give bonus to both
  await db.collection('users').doc(referrerEmail).update({
    referralCount: admin.firestore.FieldValue.increment(1),
    referralBonusGB: admin.firestore.FieldValue.increment(5),
    limit: '55GB' // temporary bonus
  });
  await db.collection('users').doc(newEmail).set({
    referredBy: referralCode,
    referrer: referrerEmail,
    referralBonusGB: 5,
    joinedWithReferral: true
  }, {merge:true});
  res.json({success:true, message:'Referral applied! +5GB bonus for both', referrer:referrerEmail});
});
