const app = require('./src/app');
const { initDatabase, dbFile } = require('./src/db');
const { port } = require('./src/config');

async function start() {
  await initDatabase();

  app.listen(port, () => {
    console.log(`[Backend] License server running on port ${port}`);
    console.log(`[Backend] Database: ${dbFile}`);
  });
}

start().catch((err) => {
  console.error('[Backend] Failed to start:', err);
  process.exit(1);
});
