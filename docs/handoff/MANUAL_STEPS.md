& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' -u root -p -e "SET GLOBAL log_bin_trust_function_creators = 1;"# Manual Steps

Manual steps are actions the user must perform outside the repository. A step remains **waiting** until the user confirms it and supplies the requested evidence.

## Manual Step 1 — Install Node.js LTS and Git

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** Node.js is required for the later Express app and Git is required for normal project handoff/version control.
- **Operating system:** Windows 11

### Exact steps

1. Download and install the current Node.js **LTS** release from `https://nodejs.org/en/download`.
2. Accept the installer defaults, including adding Node.js to `PATH`.
3. Download and install Git for Windows from `https://git-scm.com/download/win`.
4. Accept the Git installer defaults unless your lab requires a different editor.
5. Open a new PowerShell window and run:

   ```powershell
   node --version
   npm --version
   git --version
   ```

### Expected result

Each command prints a version. `node --version` should show an LTS major version, `npm --version` should print a number, and `git --version` should begin with `git version`.

### Confirmation received

```text
node --version: v24.14.0
npm --version: 11.9.0
git --version: git version 2.50.1.windows.1
```

### If it fails, send back

Copy the complete PowerShell output and state which numbered step failed. Do not continue to later manual steps until the problem is resolved.

## Manual Step 2 — Install MySQL 8.0 Community Server and Workbench

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** The approved schema must be executed and tested on a clean local MySQL 8.0 instance.
- **Operating system:** Windows 11

### Exact steps

1. Download the MySQL Installer for Windows from `https://dev.mysql.com/downloads/installer/`.
2. Choose the Community full/developer setup so MySQL Server 8.0 and MySQL Workbench are included.
3. During configuration, keep the default standalone MySQL Server and port `3306`.
4. Choose a strong root password and save it securely. Do not send the password here.
5. Finish the installation and open MySQL Workbench.
6. Create or verify a local connection using host `localhost`, port `3306`, user `root`, and the password you chose.
7. Test the connection in Workbench. Do not create the project database yet; the schema file will define it later.

### Expected result

MySQL Workbench opens and successfully connects to the local MySQL 8.0 Server on port 3306.

### Confirmation received

MySQL 8.0.46 Community Server is installed as Windows service `MySQL80` on port 3306. The user can connect to `Local instance MySQL80` in Workbench. Root credentials remain private.

### If it fails, send back

Copy the complete Workbench error text or the exact installer step that failed. Never send the root password.

## Manual Step 3 — Create the project database and least-privilege user

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** `sql/00_setup.sql` creates the `utf8mb4` project database and the separate account used by the later app.
- **Operating system:** Windows 11
- **Credential rule:** never send the root or project-user password in chat. Replace the placeholder locally only.

### Exact steps

1. Open `sql/00_setup.sql` from this repository in MySQL Workbench.
2. Replace both occurrences of `CHANGE_ME_WITH_A_LOCAL_PASSWORD` with a strong password you will keep private. Do not save or commit the edited file if it contains the real password.
3. Open a Workbench connection to `Local instance MySQL80` as `root`.
4. Open the edited script in a SQL tab and run the whole script with the lightning-bolt Execute button.
5. Confirm the result grid lists `campus_sports` with character set `utf8mb4`.
6. Confirm `SHOW GRANTS` lists privileges only on `campus_sports.*` for `campus_dev`@`localhost`, including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `EXECUTE`.
7. Open a second Workbench connection as `campus_dev` to `localhost:3306`, select the `campus_sports` schema, and confirm the connection succeeds.
8. As `root`, run this version and CHECK-enforcement probe:

   ```sql
   SELECT VERSION();
   DROP DATABASE IF EXISTS check_constraint_probe;
   CREATE DATABASE check_constraint_probe CHARACTER SET utf8mb4;
   USE check_constraint_probe;
   CREATE TABLE probe (id INT PRIMARY KEY, value INT, CHECK (value > 0));
   INSERT INTO probe VALUES (1, 1);
   INSERT INTO probe VALUES (2, 0);
   ```

### Expected result

- The database is `campus_sports` and uses `utf8mb4`.
- The project user connects successfully.
- The invalid second probe insert fails with a check-constraint error. MySQL 8.0.16 and later enforce `CHECK`; version 8.0.46 satisfies this requirement.
- If the probe succeeds unexpectedly, stop and report the complete output; do not continue schema testing.

### Confirmation received

- `campus_sports` exists with character set `utf8mb4` and collation `utf8mb4_0900_ai_ci`.
- `campus_dev` has `USAGE` on `*.*` and only `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `EXECUTE` on `campus_sports.*`.
- A `campus_dev` connection to `localhost:3306` works; an attempted database drop is correctly denied with error 1044.
- MySQL version is 8.0.46.
- The invalid CHECK-probe insert failed as expected, and the probe database was dropped.

### If it fails, send back

Send the complete Workbench error text and the numbered step that failed. Do not send any password. The local `.env` file should follow `.env.example` and remain unshared.

## Manual Step 4 — Run and validate the schema

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** Execute the approved 17-table DDL and verify that MySQL accepts every key, CHECK constraint, foreign key, and index.
- **Operating system:** Windows 11
- **Credential rule:** run as the private root connection; do not send credentials.

### Exact steps

1. Open `sql/schema.sql` in MySQL Workbench.
2. Connect to `Local instance MySQL80` as `root`.
3. Execute the entire file. It uses `USE campus_sports`; it drops and recreates only the project's 17 tables.
4. In the Schemas panel, refresh `campus_sports` and expand **Tables**.
5. Run:

   ```sql
   SELECT COUNT(*) AS table_count
   FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = 'campus_sports'
     AND TABLE_TYPE = 'BASE TABLE';

   SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
   FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = 'campus_sports'
   ORDER BY TABLE_NAME;
   ```

### Expected result

- The script completes without errors.
- `table_count` is `17`.
- Every table uses `InnoDB` and the `utf8mb4` schema collation.

### If it fails, send back

Send the complete Workbench error output and the statement or line that failed. Do not send a password.

### First-run result and correction

The first runs found MySQL CHECK/referential-action compatibility and reserved-word issues; those were corrected. The final run completed with no errors, created 17 tables, and showed InnoDB with `utf8mb4_0900_ai_ci` for every table.

## Manual Step 5 — Run and validate the seed data

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** Load realistic demonstration data and verify the minimum project counts.
- **Operating system:** Windows 11

### Exact steps

1. Open `sql/seed.sql` in MySQL Workbench.
2. Connect as root to `Local instance MySQL80`.
3. Execute the entire file after the successful `schema.sql` run.
4. Run:

   ```sql
   USE campus_sports;
   SELECT
       (SELECT COUNT(*) FROM department) AS departments,
       (SELECT COUNT(*) FROM team) AS teams,
       (SELECT COUNT(*) FROM student) AS students,
       (SELECT COUNT(*) FROM `match`) AS matches,
       (SELECT COUNT(*) FROM event WHERE sport_id = 2) AS athletics_events;
   ```

### Expected result

The result must show at least 6 departments, 8 teams, 40 students, 30 matches, and 2 athletics events. The script should complete without foreign-key or CHECK errors.

### Confirmation received

- `seed.sql` completed with no errors.
- Departments: 6; teams: 8; students: 40; matches: 31; athletics events: 2.

### If it fails, send back

Send the complete Workbench error output and statement/line. Do not send credentials.

## Manual Step 6 — Run and validate database logic

- **Status:** done — executed by agent as `campus_dev` on 2026-10-18
- **Why:** Install the views, triggers, procedures, function, query demonstrations, and ACID transaction demos, then expose any MySQL-specific errors before app work.
- **Operating system:** Windows 11

### Exact steps

1. In Workbench, keep the successful `campus_sports` schema and seed data.
2. If repeating manually, connect as `campus_dev` and run these files one at a time in this order:
   1. `sql/views.sql`
   2. `sql/triggers.sql`
   3. `sql/procedures.sql`
   4. `sql/transactions.sql`
   5. `sql/queries.sql`
3. If `transactions.sql` commits its demonstration match, that is expected.
4. Run these checks:

   ```sql
   SHOW FULL TABLES IN campus_sports WHERE TABLE_TYPE = 'VIEW';
   SHOW PROCEDURE STATUS WHERE Db = 'campus_sports';
   SHOW FUNCTION STATUS WHERE Db = 'campus_sports';
   SELECT * FROM v_points_table;
   SELECT * FROM v_medal_tally;
   SELECT * FROM v_top_scorers;
   ```

5. For trigger demonstrations, use the passing examples and the individually commented failing examples at the bottom of `sql/queries.sql`. Run each failing statement separately and confirm it raises an error.

### Expected result

- Each file completes without unexpected errors.
- Four views, three procedures, and one function are present.
- The three view queries return rows.
- The transaction file reports a committed demonstration match and zero rows for its rolled-back registration.
- The failing trigger examples are rejected.

### Confirmation received

- `schema.sql`, `seed.sql`, `views.sql`, `triggers.sql`, `procedures.sql`, `transactions.sql`, and `queries.sql` all completed as `campus_dev`.
- Verification counts: 17 tables, 4 views, 3 procedures, 1 function, 6 triggers.
- Non-empty view counts: 8 points-table rows, 1 medal-tally row, 6 top-scorer rows.
- Transaction demo committed match 32 with score `1-0`; rollback restored registration 9 to `approved`.
- Failing demos for exactly-one registration, venue clash, completed-match lock, and invalid goal team were all rejected.

### If it fails, send back

Send the complete Workbench error output, file name, statement/line, and whether earlier files completed. Do not send credentials.

## Manual Step 7 — Create the private `.env`

- **Status:** done — user confirmed private update
- **Why:** The agent will use the `campus_dev` connection without root access for local SQL validation.
- **Credential rule:** never send or commit the `.env` contents.

### Exact steps

1. In PowerShell, from the repository folder, copy the template:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` in a local editor:

   ```powershell
   notepad .env
   ```

3. Replace only `YOUR_DEV_PASSWORD` with the private password for `campus_dev`.
4. Save and close Notepad.
5. Do not paste the file contents into chat. Reply only that the private `.env` is created.

### Expected result

The file exists locally, is ignored by Git, and contains the `campus_dev` connection settings.

### If it fails, send back

Send only the command error text. Never send the file contents or password.

### Confirmation received

The user updated the private `.env` without sharing its contents. Demo users were seeded successfully through the application configuration.

## Manual Step 8 — Repair `campus_dev` authentication and validation privileges

- **Status:** done — confirmed by user on 2026-10-18
- **Why:** The private connection returned error 1045, and phase-6 SQL needs temporary schema-object privileges while it is installed and tested.
- **Credential rule:** never send passwords in chat.

### Exact steps

1. Open Workbench as root using `Local instance MySQL80`.
2. Open a SQL tab and replace `CHANGE_ME_WITH_A_LOCAL_PASSWORD` locally with the same private password used in `.env`.
3. Execute:

   ```sql
   ALTER USER 'campus_dev'@'localhost'
       IDENTIFIED BY 'CHANGE_ME_WITH_A_LOCAL_PASSWORD';

   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE,
         CREATE, ALTER, DROP, INDEX, CREATE VIEW, SHOW VIEW,
         TRIGGER, CREATE ROUTINE, ALTER ROUTINE
       ON campus_sports.* TO 'campus_dev'@'localhost';

   FLUSH PRIVILEGES;
   ```

4. Close the root SQL tab without saving the password-containing text.
5. Confirm `.env` still contains the same private password for `campus_dev`.
6. Reply only that the repair is complete; do not send credentials.

### Expected result

The agent's credential-safe test connects as `campus_dev`, and that account can install the project objects only inside `campus_sports`. No other schema is touched.

### Confirmation received

The user completed the repair. The credential-safe agent test connected as `campus_dev`, and all SQL validation ran successfully without root access.

### If it fails, send back

Send only the complete MySQL error text and step number. Never send passwords or `.env` contents.

## Manual Step 7 — Permit local routine validation with binary logging enabled

- **Status:** complete — trigger and routine installation verified after the user enabled the server setting
- **Why:** `campus_dev` can create the project tables and seed data, but MySQL rejected trigger/function installation with `ER_BINLOG_CREATE_ROUTINE_NEED_SUPER` because `log_bin_trust_function_creators` is disabled. This is a server setting, not an application-code error.
- **Operating system:** Windows 11
- **Credential rule:** do not send passwords or `.env` contents.

### Exact steps

1. Open **PowerShell as Administrator**.
2. Run:

   ```powershell
   & 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' -u root -p -e "SET GLOBAL log_bin_trust_function_creators = 1;"
   ```

3. Enter the private MySQL administrator password when prompted. Do not paste it into chat.
4. Reply that Manual Step 7 is complete. The agent will then reinstall `triggers.sql` and `procedures.sql` using `campus_dev`.

### Expected result

PowerShell returns to the prompt without a MySQL error. The setting permitted the already-reviewed local triggers and routines to be installed; it did not grant `campus_dev` access to other schemas. Verification completed with 6 triggers, 4 routines, and all 6 application tests passing.

### If it fails, send back

Send the complete error text and state that Manual Step 7 failed. Do not send the password.
