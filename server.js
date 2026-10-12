const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

const BANKS = [
  { bank: "PalmPay", accountNumber: "9020274023", name: "ASSESS INTERNET(BASSEY)", full: "PalmPay" },
  { bank: "OPay", accountNumber: "7078040244", name: "ASSESS INTERNET(BASSEY)", full: "OPay Digital Services" },
  { bank: "Moniepoint", accountNumber: "7078040244", name: "ASSESS INTERNET(BASSEY)", full: "Moniepoint Microfinance Bank" },
  { bank: "Moniepoint", accountNumber: "9020274023", name: "ASSESS INTERNET(BASSEY)", full: "Moniepoint Microfinance Bank" }
];

let currentIndex = 0;
function getBank() { const bank = BANKS[currentIndex]; currentIndex = (currentIndex + 1) % BANKS.length; return bank; }

app.use(cors({ origin: '*' }));
app.use(express.json());

let users = [];
let payments = [];

app.get('/', (req, res) => { res.json({ status: "ASSESS 5G online - 30GB/day", banks: BANKS, users: users.length, payments: payments.length }); });
app.get('/api/users', (req, res) => { res.json(users); });
app.get('/api/payments', (req, res) => { res.json(payments); });
app.get('/api/check-phone/:phone', (req, res) => { const phone = req.params.phone.replace(/\s/g,''); const exists = users.find(u => u.phone === phone); res.json({ exists:!!exists, user: exists || null }); });

// NEW: Track data usage 30GB per day with rollover
app.post('/api/use-data', (req, res) => {
  const { phone, gbUsed } = req.body;
  const user = users.find(u => u.phone === phone);
  if(!user) return res.status(404).json({ error: "User not found" });

  const today = new Date().toDateString();
  if(user.lastUsageDate!== today){
    if(user.type === 'BASIC'){
      // BASIC: rollover unused
      const remaining = (user.dailyQuota || 30) - (user.usedToday || 0);
      user.rollover = (user.rollover || 0) + (remaining > 0? remaining : 0);
    }
    user.usedToday = 0;
    user.lastUsageDate = today;
  }

  user.usedToday = (user.usedToday || 0) + gbUsed;

  let totalAvailable = (user.dailyQuota || 30) + (user.rollover || 0);
  let status = "5G";
  if(user.usedToday >= totalAvailable){
    if(user.usedToday >= 30){ // Throttle logic
      status = "4G throttled 2Mbps";
      // Give fresh 30GB if plan active
      user.usedToday = 0;
      user.rollover = 0;
    }
  }

  res.json({ phone, usedToday: user.usedToday, quota: 30, rollover: user.rollover || 0, status, planExpiry: user.planExpiry });
});

app.post('/api/pay', (req, res) => {
  try {
    const { email, name, phone, plan, type, price, referralCode } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });
    const cleanPhone = phone.replace(/\s/g,'');
    const reference = `ASSESS-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const lowerEmail = email.trim().toLowerCase();
    const bankInfo = getBank();

    let existingUser = users.find(u => u.phone === cleanPhone);
    let finalReferral = "";
    if(!existingUser){ finalReferral = (referralCode || "").trim(); if(finalReferral === cleanPhone) finalReferral = ""; } else { finalReferral = existingUser.referralCode || ""; }

    // Calculate plan expiry - BASIC calendar expiry, PREMIUM time-based
    let planExpiry;
    let durationHours = 24;
    if(plan.includes('1 Day')) durationHours = 24;
    if(plan.includes('2-3 Days')) durationHours = 72;
    if(plan.includes('Weekly')) durationHours = 168;
    if(plan.includes('14 Days')) durationHours = 336;
    if(plan.includes('30 Days')) durationHours = 720;
    if(plan.includes('90 Days')) durationHours = 2160;
    if(plan.includes('180 Days')) durationHours = 4320;
    if(plan.includes('365 Days')) durationHours = 8760;

    if(type === 'BASIC'){
      planExpiry = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(); // Calendar expiry
    } else {
      planExpiry = { totalHours: durationHours, usedHours: 0 }; // Time-oriented
    }

    const payment = { email: lowerEmail, name: name || "Customer", phone: cleanPhone, referralCode: finalReferral, plan: plan || "", type: type || "BASIC", price: price || 0, reference, bank: bankInfo.bank, accountNumber: bankInfo.accountNumber, assignedBank: bankInfo.accountNumber, assignedBankName: bankInfo.bank, bankFull: bankInfo.full, holderName: bankInfo.name, status: "pending", verified: false, date: new Date().toISOString(), dailyQuota: 30 };
    payments.push(payment);

    if (!existingUser) {
      const newUser = {
        email: lowerEmail, name: name || "", phone: cleanPhone,
        referralCode: finalReferral, myCode: cleanPhone, referrals: 0, freeDays: 0,
        type: type || "BASIC", plan: plan || "", price: price || 0,
        isPremium: false, devices: [], lastRef: reference,
        assignedBank: bankInfo.accountNumber, assignedBankName: bankInfo.bank,
        status: "pending", firstSignup: new Date().toISOString(),
        dailyQuota: 30, usedToday: 0, rollover: 0, lastUsageDate: new Date().toDateString(),
        planExpiry: planExpiry, activeTimeUsed: 0
      };
      users.push(newUser);
    } else {
      existingUser.lastRef = reference; existingUser.type = type || existingUser.type; existingUser.plan = plan || existingUser.plan; existingUser.price = price || existingUser.price; existingUser.assignedBank = bankInfo.accountNumber; existingUser.assignedBankName = bankInfo.bank; existingUser.planExpiry = planExpiry;
    }
    return res.json({ success: true, bank: bankInfo.bank, accountNumber: bankInfo.accountNumber, name: bankInfo.name, full: bankInfo.full, reference, isNewUser:!existingUser, quota: 30, expiry: planExpiry });
  } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/confirm', (req, res) => {
  const { reference, email, type, plan } = req.body;
  const lowerEmail = (email || "").trim().toLowerCase();
  const payment = payments.find(p => p.reference === reference || p.email === lowerEmail);
  if (!payment) { return res.json({ verified: false, autoConnected: false, message: "No payment found." }); }
  if(!payment.verified){ payment.verified = true; payment.status = "confirmed"; if(payment.referralCode && payment.price >= 6000){ const referrer = users.find(u => u.phone === payment.referralCode); if(referrer && referrer.phone!== payment.phone){ referrer.referrals = (referrer.referrals || 0) + 1; referrer.freeDays = (referrer.freeDays || 0) + 1; } } }
  let user = users.find(u => u.email === lowerEmail); if (user) { user.isPremium = true; user.status = "active"; user.type = type || user.type; user.plan = plan || user.plan; }
  return res.json({ verified: true, autoConnected: true, message: `✅ Confirmed! 30GB/day 5G activated. ${payment.type} - ${payment.plan}. ${payment.type==='BASIC'?'Expires on calendar. Unused rolls over.':'Time-based: 24h usage time.'} Throttles to 4G after 30GB.` });
});

app.post('/api/activate', (req, res) => {
  const { email } = req.body; const lowerEmail = email.trim().toLowerCase(); const user = users.find(u => u.email === lowerEmail); if (user) { user.isPremium = true; user.status = "active"; } const pay = payments.find(p => p.email === lowerEmail &&!p.verified); if (pay) { pay.verified = true; pay.status = "confirmed"; if(pay.referralCode && pay.price >= 6000){ const referrer = users.find(u => u.phone === pay.referralCode); if(referrer && referrer.phone!== pay.phone){ referrer.referrals = (referrer.referrals||0)+1; referrer.freeDays = (referrer.freeDays||0)+1; } } } return res.json({ success: true, email: lowerEmail, activated: true });
});

app.listen(PORT, () => { console.log(`ASSESS 5G 30GB running`); });
