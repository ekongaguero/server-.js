const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Firebase Init (Optional - works even without it) ---
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase connected');
  } else {
    console.log('Firebase not configured - running in local mode');
  }
} catch (e) {
  console.log('Firebase init skipped:', e.message);
}

// --- Routes ---

app.get('/', (req, res) => {
  res.json({
    message: 'ASSESS Backend V4.1 LIVE - Full Version',
    status: 'ok',
    endpoints: ['/health', '/assess', '/results', '/submit'],
    time: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Main assessment endpoint
app.post('/assess', async (req, res) => {
  try {
    const { userId, answers, assessmentType } = req.body;
    
    // Example scoring logic
    let score = 0;
    if (answers && Array.isArray(answers)) {
      score = answers.filter(a => a.correct).length;
    }

    const result = {
      userId: userId || 'anonymous',
      assessmentType: assessmentType || 'general',
      score: score,
      total: answers ? answers.length : 0,
      percentage: answers ? Math.round((score / answers.length) * 100) : 0,
      timestamp: new Date().toISOString()
    };

    // Save to Firebase if configured
    if (admin.apps.length) {
      const db = admin.firestore();
      await db.collection('assessments').add(result);
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit endpoint
app.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    data.timestamp = new Date().toISOString();
    
    if (admin.apps.length) {
      const db = admin.firestore();
      await db.collection('submissions').add(data);
    }
    
    res.json({ success: true, message: 'Submission saved', data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get results
app.get('/results/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!admin.apps.length) {
      return res.json({ success: true, results: [], note: 'Firebase not configured' });
    }
    
    const db = admin.firestore();
    const snapshot = await db.collection('assessments').where('userId', '==', userId).get();
    const results = snapshot.docs.map(doc => doc.data());
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`ASSESS V4.1 Full Server LIVE on port ${PORT}`);
});
