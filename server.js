import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Platform, TextInput } from 'react-native';

const BACKEND_URL = 'https://YOUR-RENDER-URL.onrender.com'; // CHANGE THIS after Render
const OWNER_EMAIL = 'owner@assess.com';
const CREATOR_PIN = '356641';

const plans = {
  BASIC: [
    {dur:'1 Day', price:1000, label:'₦1k'}, {dur:'2-3 Days', price:1800, label:'₦1.8k'},
    {dur:'Weekly', price:2500, label:'₦2.5k'}, {dur:'14 Days', price:3500, label:'₦3.5k'},
    {dur:'30 Days', price:6000, label:'₦6k'}, {dur:'90 Days', price:12000, label:'₦12k'},
    {dur:'180 Days', price:18000, label:'₦18k'}, {dur:'365 Days', price:35000, label:'₦35k'},
  ],
  PREMIUM: [
    {dur:'1 Day', price:2000, label:'₦2k'}, {dur:'2-3 Days', price:3600, label:'₦3.6k'},
    {dur:'Weekly', price:5000, label:'₦5k'}, {dur:'14 Days', price:7000, label:'₦7k'},
    {dur:'30 Days', price:12000, label:'₦12k'}, {dur:'90 Days', price:24000, label:'₦24k'},
    {dur:'180 Days', price:36000, label:'₦36k'}, {dur:'365 Days', price:70000, label:'₦70k'},
  ]
};

export default function App(){
  const [type,setType]=useState('BASIC');
  const [showSplash,setShowSplash]=useState(true);
  const [splashStep,setSplashStep]=useState(0);
  const [showRegister,setShowRegister]=useState(true);
  const [userEmail,setUserEmail]=useState('');
  const [deviceId,setDeviceId]=useState('');
  const [currentPlan,setCurrentPlan]=useState(null);
  const [pin,setPin]=useState('');

  useEffect(()=>{
    const id = Platform.OS + '_' + Math.random().toString(36).slice(2,9);
    setDeviceId(id);
    const t0=setTimeout(()=>setSplashStep(1),1200);
    const t1=setTimeout(()=>setSplashStep(2),2400);
    const t2=setTimeout(()=>setShowSplash(false),3600);
    return ()=>{clearTimeout(t0);clearTimeout(t1);clearTimeout(t2);};
  },[]);

  const handleLoginCheck = async () => {
    if(!userEmail.includes('@')){ Alert.alert('Enter valid email'); return; }
    if(userEmail===OWNER_EMAIL){ setShowRegister(false); return; }
    try{
      const r = await fetch(`${BACKEND_URL}/api/login`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email:userEmail, deviceId})
      });
      const d = await r.json();
      if(d.allowed){ setCurrentPlan(d); setShowRegister(false); return; }
      if(d.needTransfer){
        Alert.alert('Transfer? Plan Stays!',`You are active on another phone.\nCurrent: ${d.plan || '50GB'} till ${d.expiry? new Date(d.expiry._seconds*1000).toDateString():''}\n\nTransfer here? Plan MOVES with you. Old phone will disconnect.`,[
          {text:'Cancel', style:'cancel'},
          {text:'YES, MOVE MY PLAN', onPress: async ()=>{
            const r2 = await fetch(`${BACKEND_URL}/api/transfer-device`,{
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({email:userEmail, newDeviceId:deviceId})
            });
            const d2 = await r2.json();
            setCurrentPlan(d2); setShowRegister(false);
            Alert.alert('Plan Moved!',`${d2.limit || '50GB'} kept. Old device disconnected.`);
          }}
        ]);
      } else { Alert.alert('Blocked', d.reason || 'Pay first'); }
    }catch(e){ setShowRegister(false); }
  };

  const handlePay = async (item) => {
    try{
      const amount = item.price*100; // to kobo
      const r = await fetch(`${BACKEND_URL}/api/pay`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email:userEmail, amount, plan_type:type, duration:item.dur, price_label:item.label})
      });
      const d = await r.json();
      if(d.success){ Alert.alert('Paystack','Redirect to: '+d.authorization_url); }
    }catch(e){ Alert.alert('Error','Backend not connected yet'); }
  };

  if(showSplash){
    return (
      <View style={[s.modal,{justifyContent:'center',alignItems:'center'}]}>
        {splashStep===0 && <Image source={require('./assets/logo.png')} style={{width:120,height:120,borderRadius:20}}/>}
        {splashStep===1 && <Text style={{fontSize:28,fontWeight:'900',color:'#00C853'}}>ASSESS{'\n'}Beyond Data</Text>}
        {splashStep===2 && <View style={{alignItems:'center'}}><Image source={require('./assets/logo.png')} style={{width:80,height:80,borderRadius:16}}/><Text style={{fontSize:22,fontWeight:'900',color:'#00C853',marginTop:10}}>ASSESS Beyond Data</Text></View>}
      </View>
    );
  }

  if(showRegister){
    return (
      <View style={s.modal}>
        <Image source={require('./assets/logo.png')} style={{width:60,height:60,borderRadius:12,alignSelf:'center',marginTop:60}}/>
        <Text style={s.regTitle}>Welcome to ASSESS</Text>
        <TextInput placeholder="Enter email" value={userEmail} onChangeText={setUserEmail} style={s.input} autoCapitalize="none"/>
        <TouchableOpacity style={s.regBtn} onPress={handleLoginCheck}><Text style={s.regBtnT}>CONTINUE</Text></TouchableOpacity>
        <View style={{flexDirection:'row',marginTop:20,justifyContent:'center'}}>
          <TextInput placeholder="Creator PIN" value={pin} onChangeText={setPin} style={[s.input,{width:120,marginRight:8}]} secureTextEntry/>
          <TouchableOpacity onPress={()=>{ if(pin===CREATOR_PIN) Alert.alert('Creator Board','Owner: 100GB Unlimited ♾️\nUsers: 50GB 1-share\nMoniepoint: 9020274023'); else Alert.alert('Wrong PIN'); }} style={[s.regBtn,{paddingHorizontal:15}]}><Text style={s.regBtnT}>GO</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.topBar}><Image source={require('./assets/logo.png')} style={{width:34,height:34,borderRadius:8}}/><Text style={{fontWeight:'900',marginLeft:8}}>ASSESS</Text></View>
      <View style={s.balanceCard}>
        <Text style={s.balTitle}>ASSESS Keep-Alive</Text>
        <Text style={s.balSub}>{userEmail===OWNER_EMAIL?'👑 OWNER 100GB/day Unlimited ♾️':'50GB/day • 1 Hotspot Share (2 total) • Plan stays on transfer'}</Text>
        <View style={{flexDirection:'row',marginTop:8}}>
          <View style={{backgroundColor:userEmail===OWNER_EMAIL?'#00C853':'#333',paddingHorizontal:8,paddingVertical:3,borderRadius:6}}>
            <Text style={{color:'#fff',fontSize:7,fontWeight:'900'}}>{userEmail===OWNER_EMAIL?'UNLIMITED SHARE ♾️':'SHARE: 1 DEVICE • PLAN STAYS'}</Text>
          </View>
        </View>
      </View>
      <View style={{flexDirection:'row',margin:8}}>
        <TouchableOpacity onPress={()=>setType('BASIC')} style={[s.typeBtn,type==='BASIC'&&s.typeActive]}><Text style={s.typeT}>BASIC - Rollover</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setType('PREMIUM')} style={[s.typeBtn,type==='PREMIUM'&&s.typeActive]}><Text style={s.typeT}>PREMIUM - Time Throttle</Text></TouchableOpacity>
      </View>
      {type==='BASIC' && <View style={{backgroundColor:'#fff3cd',marginHorizontal:8,padding:8,borderRadius:8,borderWidth:1,borderColor:'#ffe69c'}}><Text style={{fontSize:7.5,fontWeight:'700',color:'#856404',textAlign:'center'}}>BASIC: 50GB/day • 1 share max • Rollover if not finished • Plan moves with device</Text></View>}
      {type==='PREMIUM' && <View style={{backgroundColor:'#cce5ff',marginHorizontal:8,padding:8,borderRadius:8,borderWidth:1,borderColor:'#b8daff'}}><Text style={{fontSize:7.5,fontWeight:'700',color:'#004085',textAlign:'center'}}>PREMIUM: 50GB/day • 1 share max • 256kbps after 50GB • Plan stays on transfer</Text></View>}
      <ScrollView><View style={s.grid}>{plans[type].map((p,i)=><TouchableOpacity key={i} style={s.card} onPress={()=>handlePay(p)}><Text style={s.cardDur}>{p.dur}</Text><Text style={s.cardPrice}>{p.label}</Text><Text style={s.cardNote}>{type==='BASIC'?'Rollover':'Time-throttle'}</Text></TouchableOpacity>)}</View></ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f5f5f5'}, topBar:{height:56,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',paddingHorizontal:12,elevation:2},
  balanceCard:{backgroundColor:'#111',margin:8,padding:12,borderRadius:12}, balTitle:{color:'#00C853',fontWeight:'900',fontSize:14}, balSub:{color:'#fff',fontSize:9,marginTop:4}, balSub2:{color:'#aaa',fontSize:8,marginTop:2},
  typeBtn:{flex:1,backgroundColor:'#fff',padding:10,borderRadius:8,marginHorizontal:4,alignItems:'center',borderWidth:1,borderColor:'#ddd'}, typeActive:{backgroundColor:'#00C853',borderColor:'#00C853'}, typeT:{fontSize:8,fontWeight:'900'},
  grid:{flexDirection:'row',flexWrap:'wrap',padding:8}, card:{width:'47%',backgroundColor:'#fff',margin:'1.5%',padding:12,borderRadius:10,elevation:2}, cardDur:{fontSize:10,fontWeight:'700'}, cardPrice:{fontSize:14,fontWeight:'900',color:'#00C853',marginTop:4}, cardNote:{fontSize:7,color:'#888',marginTop:4},
  modal:{flex:1,backgroundColor:'#fff',padding:20}, regTitle:{fontSize:20,fontWeight:'900',textAlign:'center',marginTop:20}, input:{borderWidth:1,borderColor:'#ddd',padding:12,borderRadius:10,marginTop:20}, regBtn:{backgroundColor:'#00C853',padding:14,borderRadius:10,marginTop:14,alignItems:'center'}, regBtnT:{color:'#fff',fontWeight:'900'}
});
