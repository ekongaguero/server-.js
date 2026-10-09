const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Root - Render checks this
app.get('/', (req, res) => {
  res.json({ 
    message: 'ASSESS Backend V4.1 LIVE',
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Your ASSESS endpoint
app.post('/assess', (req, res) => {
  res.json({ result: 'Assessment logic here' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server LIVE on port ${PORT}`);
});
