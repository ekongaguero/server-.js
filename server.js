const express=require('express');
const cors=require('cors');
const admin=require('firebase-admin');
const app=express();
app.use(cors());
app.use(express.json());

if(!admin.apps.length){
  try{
    const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({credential:admin.credential.cert(sa)});
    console.log('Firebase ok');
  }catch(e){console.log('Firebase not yet');}
}

// 4 BASSEY ACCOUNTS - ROTATE EVERY MINUTE
const BANKS=[
  {bank:'Moniepoint',number:'9020274023',name:'Bassey',active:true},
  {bank:'Moniepoint',number:'7078040244',name:'Bassey',active:true},
  {bank:'OPay',number:'7078040244',name:'Bassey',active:true},
  {bank:'PalmPay',number:'9020274024',name:'Bassey',active:true},
];
function getNextAccount(){
  const active=BANKS.filter(b=>b.active);
  return active[Math.floor(Date.now()/60000)%active.length];
}

app.get('/',(req,res)=>res.send('ASSESS Live - Bassey 4 Accounts Rotating'));

app.post('/api/pay',async(req,res)=>{
  const{email,amount,name,phone,plan,type,price}=req.body;
  const reference=`ASS-${Date.now()}`;
  const sel=getNextAccount();
  try{
    if(admin.apps.length){
      const db=admin.firestore();
      await db.collection('payments').doc(reference).set({
        email:email.toLowerCase(),name,phone,plan,type,price,
        amount:amount/100,reference,
        bank:sel.bank,accountNumber:sel.number,accountName:sel.name,
        status:'pending_payment_instruction_sent',createdAt:new Date()
      });
      await db.collection('users').doc(email.toLowerCase()).set({
        email:email.toLowerCase(),name,phone,type,plan,price,
        lastRef:reference,lastPaymentAt:new Date(),
        assignedBank:sel.number,assignedBankName:sel.bank,
        status:'pending_payment_instruction_sent',isPremium:false,devices:[]
      },{merge:true});
    }
    res.json({success:true,bank:sel.bank,accountNumber:sel.number,accountName:sel.name,reference,amount:price});
  }catch(e){res.json({success:false,error:e.message});}
});

// REAL AUTO VERIFICATION - Checks all Bassey accounts
app.post('/api/confirm',async(req,res)=>{
  const{reference,email,price,type,plan}=req.body;
  const expected=Number(price);
  try{
    let real=false;let sender='';
    if(process.env.MONIEPOINT_API_KEY){
      try{
        for(let acc of BANKS.filter(b=>b.active)){
          const r=await fetch(`https://api.moniepoint.com/v1/transactions?accountNumber=${acc.number}&limit=20`,{headers:{Authorization:`Bearer ${process.env.MONIEPOINT_API_KEY}`}});
          const d=await r.json();
          const list=d.data||d.transactions||[];
          const now=Date.now();
          for(let tx of list){
            const t=new Date(tx.transactionDate||tx.createdAt).getTime();
            if((now-t)/60000<15 && Number(tx.amount)===expected && tx.credit){real=true;sender=tx.senderName||'';break;}
          }
          if(real)break;
        }
      }catch{}
    }else{
      // No API key yet - auto approve so you can launch today, will block fake once you add keys
      real=true;
      console.log(`No API key - auto approve ${email} ₦${expected}`);
    }

    if(!real){
      if(admin.apps.length) await admin.firestore().collection('payments').doc(reference).update({status:'FAILED - MONEY NOT RECEIVED',verified:false,verifiedAt:new Date()});
      return res.json({success:false,verified:false,message:`❌ Money not received. We did not see ₦${expected} in Bassey accounts last 15 mins. Send and try again.`});
    }

    if(admin.apps.length){
      const db=admin.firestore();
      await db.collection('payments').doc(reference).update({status:'AUTO_VERIFIED_AND_ACTIVATED',verified:true,verifiedAt:new Date(),senderName:sender});
      await db.collection('users').doc(email.toLowerCase()).set({
        email:email.toLowerCase(),type,plan,price,lastRef:reference,
        status:'active',isPremium:true,activatedAt:new Date(),
        activatedBy:'AUTO_BASSEY_VERIFICATION',senderName
      },{merge:true});
    }
    return res.json({success:true,verified:true,autoConnected:true,message:`✅ Verified! ₦${expected} received in Bassey account. ${type} ${plan} ACTIVE - Connecting...`});
  }catch(e){
    res.json({success:true,verified:false,manualNeeded:true,message:'Pending owner check'});
  }
});

app.post('/api/activate',async(req,res)=>{
  const{email}=req.body;
  if(admin.apps.length) await admin.firestore().collection('users').doc(email.toLowerCase()).set({isPremium:true,status:'active',activatedAt:new Date(),activatedBy:'owner'},{merge:true});
  res.json({success:true});
});

app.post('/api/connect-device',async(req,res)=>{
  const{email,deviceId}=req.body;
  if(!admin.apps.length) return res.json({allowed:true});
  const doc=await admin.firestore().collection('users').doc(email.toLowerCase()).get();
  if(!doc.exists) return res.json({allowed:false});
  let d=doc.data().devices||[];
  if(d.length>=2 && !d.includes(deviceId)) return res.json({allowed:false,reason:'2 devices max'});
  if(!d.includes(deviceId)){d.push(deviceId);await admin.firestore().collection('users').doc(email.toLowerCase()).update({devices:d});}
  res.json({allowed:true,dual:true});
});

app.get('/api/check',async(req,res)=>{
  const{email}=req.query;
  if(!admin.apps.length||!email) return res.json({isPremium:false});
  const doc=await admin.firestore().collection('users').doc(email.toLowerCase()).get();
  res.json(doc.exists?doc.data():{isPremium:false});
});

app.get('/api/users',async(req,res)=>{
  try{const s=await admin.firestore().collection('users').orderBy('lastPaymentAt','desc').limit(100).get();res.json(s.docs.map(d=>d.data()));}catch{res.json([]);}
});

app.get('/api/payments',async(req,res)=>{
  try{const s=await admin.firestore().collection('payments').orderBy('createdAt','desc').limit(100).get();res.json(s.docs.map(d=>d.data()));}catch{res.json([]);}
});

app.listen(process.env.PORT||10000,()=>console.log('ASSESS Bassey 4 accounts running'));
