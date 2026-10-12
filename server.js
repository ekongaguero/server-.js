const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 10000;

// SINGLE ACCOUNT - DO NOT CHANGE
const SINGLE_ACCOUNT = {
  name: "Bassey",
  accountNumber: "9020274023",
  bank: "Moniepoint Microfinance Bank"
};

app.use(cors());
app.use(express.json());

let payments = []; // in-memory. Use DB later if you want

app.get('/', (req, res) => {
  res.json({
    status: "ASSESS backend online",
    account: SINGLE_ACCOUNT,
    totalPayments: payments.length
  });
});

app.get('/api/payments', (req, res) => {
  res.json(payments);
});

app.post('/api/payments', (req, res) => {
  const { customerName, plan, amount, reference } = req.body;

  const newPayment = {
    id: Date.now().toString(),
    customerName: customerName || "Customer",
    plan: plan || "WK",
    amount: amount || 0,
    reference: reference || "N/A",
    bankPaidTo: SINGLE_ACCOUNT,
    status: "pending",
    date: new Date().toISOString()
  };

  payments.push(newPayment);
  console.log("New payment:", newPayment);
  res.status(201).json(newPayment);
});

// Owner confirm endpoint
app.put('/api/payments/:id/confirm', (req, res) => {
  const pay = payments.find(p => p.id === req.params.id);
  if(!pay) return res.status(404).json({error: "Not found"});
  pay.status = "confirmed";
  res.json(pay);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Single account: ${SINGLE_ACCOUNT.bank} ${SINGLE_ACCOUNT.accountNumber} ${SINGLE_ACCOUNT.name}`);
});
