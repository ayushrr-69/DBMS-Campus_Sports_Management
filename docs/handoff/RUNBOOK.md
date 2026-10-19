# Runbook

## Current phase

Database implementation and role-based application testing are complete; use this runbook for the live demo.

## Database order

1. Install and verify MySQL 8.0 Community Edition and MySQL Workbench.
2. Create the project database and project user.
3. Run `sql/schema.sql`.
4. Run `sql/seed.sql`.
5. Run `sql/views.sql`.
6. Run `sql/triggers.sql`.
7. Run `sql/procedures.sql`.
8. Run `sql/queries.sql` and record passing/failing demonstrations.
9. Install Node dependencies, configure `.env`, and start the Express app.

## Application setup

From PowerShell in the project folder:

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run seed:users
npm test
npm start
```

The runtime account is `campus_app`, not `campus_dev` or root. Keep all password values inside `.env`.

Demo usernames are `admin.demo`, `coordinator.demo`, `player.demo`, and `viewer.demo`; their passwords are the private values entered as `DEMO_*_PASSWORD`.

## Live role demo

1. Visit `/` without logging in and show the `/events` hub (with individual competition views `/events/:id`), the `/design` RDBMS tab, schedule, teams, points, and medals.
2. On `/design`, explain the ER diagram, relation cards, primary/foreign keys, cardinalities, and the three exclusive-target patterns.
3. Log in as `viewer.demo`; show public access and the coordinator page returning 403.
4. Log in as `player.demo`; show the participant view-only dashboard, existing registrations, and own matches. Explain that coordinators and administrators currently perform registrations and all edits.
5. Log in as `coordinator.demo` (or use the **Match control** link as `admin.demo`); create/reschedule a match using named dropdowns, call fixture generation, open **Manage**, enter both scores, and choose `Completed` only after the result is final. The higher score is the winner; a draw has no single winner. Show that a completed match cannot be edited.
6. Log in as `admin.demo`; create/edit/delete a master-data row, manage an app user, and open **Match control** to use **Assign awards** after the event's final match is completed. The current schema treats an event as finished through its completed final matches and awards; it does not store a separate event-ended flag.
7. Use browser developer tools only to confirm forms carry CSRF tokens; never expose `.env`.
