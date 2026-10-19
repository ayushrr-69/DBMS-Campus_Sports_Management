const mysql = require('mysql2/promise');
require('dotenv').config();

async function install() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DEV_DB_USER || 'campus_dev',
    password: process.env.DEV_DB_PASSWORD || process.env.APP_DB_PASSWORD
  });
  const triggers = [
    'DROP TRIGGER IF EXISTS trg_check_team_member_department_insert',
    'DROP TRIGGER IF EXISTS trg_check_team_member_department_update',
    'DROP TRIGGER IF EXISTS trg_check_team_captain_department_insert',
    'DROP TRIGGER IF EXISTS trg_check_team_captain_department_update',
    `CREATE TRIGGER trg_check_team_member_department_insert
     BEFORE INSERT ON team_member
     FOR EACH ROW
     BEGIN
         DECLARE v_student_dept INT UNSIGNED;
         DECLARE v_team_dept INT UNSIGNED;
         SELECT department_id INTO v_student_dept FROM student WHERE student_id = NEW.student_id;
         SELECT department_id INTO v_team_dept FROM team WHERE team_id = NEW.team_id;
         IF v_student_dept IS NOT NULL AND v_team_dept IS NOT NULL AND v_student_dept <> v_team_dept THEN
             SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A student may only join a team representing their own department';
         END IF;
     END`,
    `CREATE TRIGGER trg_check_team_member_department_update
     BEFORE UPDATE ON team_member
     FOR EACH ROW
     BEGIN
         DECLARE v_student_dept INT UNSIGNED;
         DECLARE v_team_dept INT UNSIGNED;
         IF NOT (NEW.team_id <=> OLD.team_id) OR NOT (NEW.student_id <=> OLD.student_id) THEN
             SELECT department_id INTO v_student_dept FROM student WHERE student_id = NEW.student_id;
             SELECT department_id INTO v_team_dept FROM team WHERE team_id = NEW.team_id;
             IF v_student_dept IS NOT NULL AND v_team_dept IS NOT NULL AND v_student_dept <> v_team_dept THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A student may only join a team representing their own department';
             END IF;
         END IF;
     END`,
    `CREATE TRIGGER trg_check_team_captain_department_insert
     BEFORE INSERT ON team
     FOR EACH ROW
     BEGIN
         DECLARE v_captain_dept INT UNSIGNED;
         IF NEW.captain_id IS NOT NULL THEN
             SELECT department_id INTO v_captain_dept FROM student WHERE student_id = NEW.captain_id;
             IF v_captain_dept IS NOT NULL AND v_captain_dept <> NEW.department_id THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Team captain must belong to the same department as the team';
             END IF;
         END IF;
     END`,
    `CREATE TRIGGER trg_check_team_captain_department_update
     BEFORE UPDATE ON team
     FOR EACH ROW
     BEGIN
         DECLARE v_captain_dept INT UNSIGNED;
         IF NEW.captain_id IS NOT NULL AND (NOT (NEW.captain_id <=> OLD.captain_id) OR NEW.department_id <> OLD.department_id) THEN
             SELECT department_id INTO v_captain_dept FROM student WHERE student_id = NEW.captain_id;
             IF v_captain_dept IS NOT NULL AND v_captain_dept <> NEW.department_id THEN
                 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Team captain must belong to the same department as the team';
             END IF;
         END IF;
     END`
  ];

  for (const sql of triggers) {
    await conn.query(sql);
    console.log('Installed trigger successfully:', sql.slice(0, 50));
  }
  await conn.end();
  console.log('All department integrity triggers installed successfully!');
}

install().catch((err) => {
  console.error('Trigger installation error:', err);
  process.exit(1);
});
