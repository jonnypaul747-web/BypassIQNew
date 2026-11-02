const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const documentRoutes = require('./routes/documentRoutes');
const liveRoutes = require('./routes/liveRoutes');

const app = express();

// A packaged desktop client calls this from its own origin, so CORS stays open.
app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', documentRoutes);
app.use('/api', liveRoutes);

module.exports = app;
