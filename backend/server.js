require('dotenv').config();

const { initDatabase, dbUrl } = require('./src/db');
const app = require('./src/app');


async function start() {
  await initDatabase();

  app.listen(port, () => {
    console.log(`[Backend] License server running on port ${port}`);
    console.log(`[Backend] Database: ${dbUrl}`);
  });
}

start().catch((err) => {
  console.error('[Backend] Failed to start:', err);
  process.exit(1);
});
