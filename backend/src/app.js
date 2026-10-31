const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// A packaged desktop client calls this from its own origin, so CORS stays open.
app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', documentRoutes);

module.exports = app;
