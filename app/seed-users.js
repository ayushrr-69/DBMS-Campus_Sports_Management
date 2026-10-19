const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnvironment = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'APP_DB_USER',
  'APP_DB_PASSWORD'
];
for (const key of requiredEnvironment) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const demoAccounts = [
  { username: 'admin.demo', passwordKey: 'DEMO_ADMIN_PASSWORD', role: 'admin', studentId: null },
  { username: 'coordinator.demo', passwordKey: 'DEMO_COORDINATOR_PASSWORD', role: 'coordinator', studentId: null },
  { username: 'player.demo', passwordKey: 'DEMO_PLAYER_PASSWORD', role: 'player', studentId: 1 },
  { username: 'viewer.demo', passwordKey: 'DEMO_VIEWER_PASSWORD', role: 'viewer', studentId: null }
];

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.APP_DB_USER,
    password: process.env.APP_DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    for (const account of demoAccounts) {
      const password = process.env[account.passwordKey];
      if (!password) {
        throw new Error(`Missing ${account.passwordKey} in .env`);
      }
      const passwordHash = await bcrypt.hash(password, 12);
      if (account.studentId !== null) {
        const [studentRows] = await pool.execute(
          'UPDATE app_user SET username = ?, password_hash = ?, role = ? WHERE student_id = ?',
          [account.username, passwordHash, account.role, account.studentId]
        );
        if (studentRows.affectedRows > 0) continue;
      }
      await pool.execute(
        `INSERT INTO app_user
          (student_id, username, password_hash, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           student_id = VALUES(student_id),
           password_hash = VALUES(password_hash),
           role = VALUES(role)`,
        [account.studentId, account.username, passwordHash, account.role]
      );
    }
    console.log('Demo accounts seeded.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Demo-account seeding failed: ${error.message}`);
  process.exitCode = 1;
});
