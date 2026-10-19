# Campus Sports Tournament Management System

## What this project demonstrates

This college DBMS lab project manages campus tournaments with MySQL 8.0 and an Express web app. The database owns the integrity rules, derived views, triggers, stored routines, transaction demonstrations, and query examples; the app authenticates users and provides role-specific forms.

## Requirements

- MySQL 8.0 Community Edition
- Node.js LTS
- A private local `.env` copied from `.env.example`

## Database run order

Run these files as the project development user on the `campus_sports` schema:

1. `sql/schema.sql`
2. `sql/seed.sql`
3. `sql/views.sql`
4. `sql/triggers.sql`
5. `sql/procedures.sql`
6. `sql/transactions.sql`
7. `sql/queries.sql`

`schema.sql` recreates only the 17 project tables. The files were validated on MySQL 8.0.46 as `campus_dev`.

## App setup and demo accounts

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run seed:users
npm start
```

Set `APP_DB_USER=campus_app`, `APP_DB_PASSWORD`, `SESSION_SECRET`, and the four `DEMO_*_PASSWORD` values in the private `.env`. Never commit or print `.env`. The app uses only `campus_app`; `campus_dev` is reserved for SQL-file validation.

The seed script creates these demo usernames and hashes their private passwords with bcrypt:

- `admin.demo`
- `coordinator.demo`
- `player.demo`
- `viewer.demo`

Open `http://localhost:3000` for the overview. Public routes are `/schedule`, `/teams`, `/points`, `/medals`, `/scorers`, and `/design`. The landing page is viewable without login. Viewers and participant accounts are currently read-only; coordinators manage scores, rescheduling, fixtures, and knockout advancement; admins create events through the guided setup page, select teams for team events or students for individual events, and use **Match control** for scores and final results. A student may be registered in multiple different events; saving one event does not remove registrations from another event. Every write form has CSRF protection and database errors are shown as readable messages.

Run automated application tests with:

```powershell
npm test
npm run check
npm audit --omit=dev
```

## Design documents

- Requirements and business rules: `docs/requirements.md`
- Crow's-foot ER design: `docs/er_diagram.md`
- ER-to-relational mapping: `docs/relational_mapping.md`
- Normalization and deliberate score denormalization: `docs/normalization.md`
- Keys and referential actions: `docs/keys_and_integrity.md`
- Relational algebra companion: `docs/relational_algebra.md`
- Viva questions: `docs/viva_questions.md`
- Presentation outline: `docs/presentation/outline.md`
- Application runbook: `docs/handoff/RUNBOOK.md`

## Validation record

- 18 InnoDB tables with `utf8mb4_0900_ai_ci` (including the `sport_venue` suitability relation)
- 6 departments, 8 teams, 40 students, 39 seeded matches, 2 tournaments, 4 events, and 3 sports
- 4 views, 4 routines (3 procedures and 1 function), and 6 triggers
- Target views return non-empty results
- ACID commit and rollback demonstrations pass
- Failing demonstrations for the CHECK, venue clash, completed-match lock, and invalid goal-team rules are rejected
- Express public routes and authenticated role workflows are covered by six passing integration tests
- `npm audit --omit=dev` reports zero vulnerabilities
