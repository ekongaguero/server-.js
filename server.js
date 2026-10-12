const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

// ================= SINGLE ACCOUNT - DO NOT ADD MORE =================
const SINGLE_BANK = {
  bank: "Moniepoint",
  accountNumber: "9020274023",
  name: "Bassey",
  full: "Moniepoint Microfinance Bank"
};
// ===================================================================

app.use(cors({ origin: '*' }));
app.use(express.json());

// In-memory DB (Render free loses data on restart - use Mongo later if needed)
let users = []; // {email, name, phone, type, plan, price, isPremium, devices, lastRef, assignedBank, assignedBankName, status}
let payments = []; // {email, price, plan, type, reference, bank, accountNumber, status, verified, date}

app.get('/', (req, res) => {
  res.json({ 
    status: "ASSESS backend online", 
    singleAccount: SINGLE_BANK,
    users: users.length,
    payments: payments.length
  });
});

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.get('/api/payments', (req, res) => {
  res.json(payments);
});

// PAY - Always returns SINGLE account
app.post('/api/pay', (req, res) => {
  try {
    const { email, name, phone, plan, type, price } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });

    const reference = `ASSESS-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const lowerEmail = email.trim().toLowerCase();

    const payment = {
      email: lowerEmail,
      name: name || "Customer",
      phone: phone || "",
      plan: plan || "",
      type: type || "BASIC",
      price: price || 0,
      reference,
      bank: SINGLE_BANK.bank,
      accountNumber: SINGLE_BANK.accountNumber,
      assignedBank: SINGLE_BANK.accountNumber,
      assignedBankName: SINGLE_BANK.bank,
      status: "pending",
      verified: false,
      date: new Date().toISOString()
    };

    payments.push(payment);

    // Create/update user as pending
    let user = users.find(u => u.email === lowerEmail);
    if (!user) {
      user = {
        email: lowerEmail,
        name: name || "",
        phone: phone || "",
        type: type || "BASIC",
        plan: plan || "",
        price: price || 0,
        isPremium: false,
        devices: [],
        lastRef: reference,
        assignedBank: SINGLE_BANK.accountNumber,
        assignedBankName: SINGLE_BANK.bank,
        status: "pending"
      };
      users.push(user);
    } else {
      user.lastRef = reference;
      user.type = type || user.type;
      user.plan = plan || user.plan;
      user.price = price || user.price;
      user.assignedBank = SINGLE_BANK.accountNumber;
      user.assignedBankName = SINGLE_BANK.bank;
    }

    console.log(`PAY: ${lowerEmail} -> ${SINGLE_BANK.accountNumber} ₦${price} Ref:${reference}`);

    return res.json({
      success: true,
      bank: SINGLE_BANK.bank,
      accountNumber: SINGLE_BANK.accountNumber,
      name: SINGLE_BANK.name,
      reference,
      message: `Send ₦${price} to ${SINGLE_BANK.accountNumber} (${SINGLE_BANK.bank})`
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// CONFIRM - Auto connect logic (you can manually verify)
app.post('/api/confirm', (req, res) => {
  const { reference, email, type, plan, price } = req.body;
  const lowerEmail = (email || "").trim().toLowerCase();
  
  const payment = payments.find(p => p.reference === reference || p.email === lowerEmail);
  if (!payment) {
    return res.json({ verified: false, autoConnected: false, message: "No payment found. Make sure you sent to Bassey 9020274023 Moniepoint" });
  }

  // For now - auto approve after "I HAVE SENT" to avoid friction
  // Change to false if you want manual approval only
  const autoApprove = true;

  if (autoApprove) {
    payment.verified = true;
    payment.status = "confirmed";
    
    let user = users.find(u => u.email === lowerEmail);
    if (user) {
      user.isPremium = true;
      user.status = "active";
      user.type = type || user.type;
      user.plan = plan || user.plan;
    }

    return res.json({
      verified: true,
      autoConnected: true,
      message: `✅ Confirmed! ₦${payment.price} received at ${SINGLE_BANK.bank} ${SINGLE_BANK.accountNumber}. Access activated.`
    });
  }

  return res.json({
    verified: true,
    autoConnected: false,
    message: "⏳ Payment recorded. Owner will confirm within 5 mins. Keep app open."
  });
});

// MANUAL ACTIVATE BY OWNER
app.post('/api/activate', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  
  const lowerEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email === lowerEmail);
  if (user) {
    user.isPremium = true;
    user.status = "active";
  }
  const pay = payments.find(p => p.email === lowerEmail && !p.verified);
  if (pay) {
    pay.verified = true;
    pay.status = "confirmed";
  }

  console.log(`ACTIVATED: ${lowerEmail}`);
  return res.json({ success: true, email: lowerEmail, activated: true });
});

app.listen(PORT, () => {
  console.log(`ASSESS server running on ${PORT}`);
  console.log(`SINGLE ACCOUNT: ${SINGLE_BANK.bank} ${SINGLE_BANK.accountNumber} ${SINGLE_BANK.name}`);
});
