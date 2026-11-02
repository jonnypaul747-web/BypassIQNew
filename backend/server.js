require('dotenv').config();

const { initDatabase, dbUrl } = require('./src/db');
const { port } = require('./src/config');
const app = require('./src/app');


async function start() {
  await initDatabase();

  const server = app.listen(port, () => {
    console.log(`[Backend] License server running on port ${port}`);
    console.log(`[Backend] Database: ${dbUrl}`);
  });

  // Initialize WebSocket server
  require('./src/services/voiceAgentService').initWebSocket(server);
}

start().catch((err) => {
  console.error('[Backend] Failed to start:', err);
  process.exit(1);
});
