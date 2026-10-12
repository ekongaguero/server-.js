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
function getBank() {
  const bank = BANKS[currentIndex];
  currentIndex = (currentIndex + 1) % BANKS.length;
  return bank;
}

app.use(cors({ origin: '*' }));
app.use(express.json());

let users = [];
let payments = [];

app.get('/', (req, res) => {
  res.json({ status: "ASSESS backend online", banks: BANKS, users: users.length, payments: payments.length });
});
app.get('/api/users', (req, res) => { res.json(users); });
app.get('/api/payments', (req, res) => { res.json(payments); });

app.post('/api/pay', (req, res) => {
  try {
    const { email, name, phone, plan, type, price } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });
    const reference = `ASSESS-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const lowerEmail = email.trim().toLowerCase();
    const bankInfo = getBank();
    const payment = {
      email: lowerEmail, name: name || "Customer", phone: phone || "", plan: plan || "", type: type || "BASIC", price: price || 0,
      reference, bank: bankInfo.bank, accountNumber: bankInfo.accountNumber, assignedBank: bankInfo.accountNumber, assignedBankName: bankInfo.bank, bankFull: bankInfo.full, holderName: bankInfo.name,
      status: "pending", verified: false, date: new Date().toISOString()
    };
    payments.push(payment);
    let user = users.find(u => u.email === lowerEmail);
    if (!user) {
      user = { email: lowerEmail, name: name || "", phone: phone || "", type: type || "BASIC", plan: plan || "", price: price || 0, isPremium: false, devices: [], lastRef: reference, assignedBank: bankInfo.accountNumber, assignedBankName: bankInfo.bank, status: "pending" };
      users.push(user);
    } else {
      user.lastRef = reference; user.type = type || user.type; user.plan = plan || user.plan; user.price = price || user.price; user.assignedBank = bankInfo.accountNumber; user.assignedBankName = bankInfo.bank;
    }
    return res.json({ success: true, bank: bankInfo.bank, accountNumber: bankInfo.accountNumber, name: bankInfo.name, full: bankInfo.full, reference, message: `Send ₦${price} to ${bankInfo.accountNumber} (${bankInfo.bank}) - ${bankInfo.name}` });
  } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/confirm', (req, res) => {
  const { reference, email, type, plan } = req.body;
  const lowerEmail = (email || "").trim().toLowerCase();
  const payment = payments.find(p => p.reference === reference || p.email === lowerEmail);
  if (!payment) { return res.json({ verified: false, autoConnected: false, message: "No payment found." }); }
  payment.verified = true; payment.status = "confirmed";
  let user = users.find(u => u.email === lowerEmail);
  if (user) { user.isPremium = true; user.status = "active"; user.type = type || user.type; user.plan = plan || user.plan; }
  return res.json({ verified: true, autoConnected: true, message: `✅ Confirmed! ₦${payment.price} received at ${payment.bank} ${payment.accountNumber}. Access activated.` });
});

app.post('/api/activate', (req, res) => {
  const { email } = req.body;
  const lowerEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email === lowerEmail);
  if (user) { user.isPremium = true; user.status = "active"; }
  const pay = payments.find(p => p.email === lowerEmail &&!p.verified);
  if (pay) { pay.verified = true; pay.status = "confirmed"; }
  return res.json({ success: true, email: lowerEmail, activated: true });
});

app.listen(PORT, () => { console.log(`ASSESS running`); });
