# Next-agent handoff

## Read first

1. [AGENTS.md](../../AGENTS.md)
2. [STATUS.md](./STATUS.md)
3. [TODO.md](./TODO.md)
4. [RUNBOOK.md](./RUNBOOK.md)
5. [DECISIONS.md](./DECISIONS.md)
6. [SCHEMA_NOTES.md](./SCHEMA_NOTES.md)

## Current verified state

- Project phase: Phase 8, test and polish, complete.
- Platform: Windows, MySQL Community Server 8.0.46, Node.js v24.14.0.
- Database: `campus_sports`.
- SQL validation user: `campus_dev`.
- Application runtime user: `campus_app`.
- The private `.env` exists locally, is ignored, and must never be printed, inspected into chat, committed, or copied into documentation.
- Database objects verified: 18 base tables, 3 views, 4 routines, and 6 triggers.
- Seeded data verified: 6 departments, 8 teams, 40 students, 39 matches, 2 tournaments, 4 events, and 3 sports.
- Points view currently includes football and basketball event/sport labels. Football has Group A and Group B standings.
- RDBMS Design tab (`/design`) displays clean title/subtitle without hero banners, an interactive vector Entity & Relationship diagram (showing only entities and relationship lines/cardinality, no attributes inside the boxes), the full 18-table relational data dictionary, interactive category filters, and the programmability layer (3 views, 6 triggers, 4 routines).
- Event setup & Match control: Team and student checkbox names use `team_ids` and `student_ids` (with defensive fallback). Minimum registered thresholds are enforced (>= 2 for team events, >= 1 for individual events). Group fixture generation reuses empty stages if created earlier, and ISO datetime strings are normalized (`T` -> ` `). `sp_generate_group_fixtures` verifies that at least 2 approved teams are registered before generating fixtures.
- Assign awards: Card 04 dynamically rebuilds deciding stages per selected event, provides real-time standings/match result hints, auto-selects final or group stages, defaults award date to today, shows live podiums, and supports award resetting. Handled via `/coordinator/awards` and `/coordinator/awards/reset` for coordinators and admins.

## Verified commands

Run from the project root:

```powershell
npm run check
npm test
npm audit --omit=dev
```

The current integration suite has seven passing tests. If a database rebuild occurs, reinstall SQL files in this order:

```text
schema.sql
seed.sql
views.sql
triggers.sql
procedures.sql
transactions.sql
queries.sql
```

Before reinstalling triggers or routines after a clean rebuild, follow the completed Manual Step 7 in [MANUAL_STEPS.md](./MANUAL_STEPS.md). It requires the user to enable `log_bin_trust_function_creators` with an administrator account; never request or record that password.

## Application workflow

- Public pages: `/`, `/events`, `/events/:id`, `/schedule`, `/teams`, `/points`, `/medals`, `/design`.
- Dedicated event pages (`/events/:id`): Deep-linked views for every ongoing event, isolating its stages, group standings, match fixtures, and contenders.
- Public Events hub (`/events`): Overview of all competitions across sports with sport filter pills and stat counters.
- Viewers and participants are read-only.
- Coordinators and administrators can edit operational data.
- Team sports use teams, groups, home/away matches, scores, standings, knockout stages, and awards.
- Individual sports use student registrations, heats, individual results, rankings, and medals. They must not be added to team Match control.
- The Points page groups standings by event and then by group, and links directly to each event's hub.
- Completed matches are locked by `trg_lock_final_match`; score-only updates must not trigger the venue-clash check.

## Known non-blocking follow-up

- The final live presentation remains a group task. Use [RUNBOOK.md](./RUNBOOK.md).
- Professor confirmation about retaining transaction and relational-algebra demonstrations is still pending; do not remove them without asking.
- The repository is not currently a Git repository, so do not claim a commit or branch exists.

## Security reminders

- Never print `.env`, password values, session secrets, or bcrypt hashes.
- Do not use root for project SQL validation or application runtime.
- Do not drop schemas other than `campus_sports`.
- Ask before exceeding 20 tables, dropping a requirement, or changing a fixed technology choice.
