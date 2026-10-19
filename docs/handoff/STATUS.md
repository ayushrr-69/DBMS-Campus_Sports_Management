# Project Status

## Current phase

**Phase 8 — Test and polish, complete**

## Completed

- Read the complete supplied Coding Agent Plan.
- Confirmed fixed choices: MySQL 8.0 Community Edition, Node.js/Express, crow's-foot notation, and group project.
- Confirmed Windows 11 for manual instructions.
- Confirmed that a viva/oral defense is required.
- Created `AGENTS.md` and `docs/requirements.md`.
- Created the phase handoff files.

## Verified environment and completed work

- Node.js v24.14.0, npm 11.9.0, and Git 2.50.1.windows.1 are confirmed.
- MySQL 8.0.46 Community Server is installed as `MySQL80` on port 3306 and Workbench root access is confirmed.
- Requirements assumptions were approved with the exclusive-FK and score-denormalization notes.
- `docs/er_diagram.md` is complete.
- `docs/relational_mapping.md` is complete.
- `docs/keys_and_integrity.md` is complete.
- `docs/normalization.md` is complete.
- The user explicitly approved normalization on 2026-10-18.
- ACID transaction demos and relational algebra remain included by default; professor confirmation is pending.
- `sql/00_setup.sql`, `.env.example`, and the approved 17-table `sql/schema.sql` are created.
- Manual Step 3 is complete: database, least-privilege app user, and CHECK enforcement are verified.
- Static review confirms 17 `CREATE TABLE` statements and the planned key/check/index declarations.
- First schema execution stopped at `registration` because MySQL rejected a cascading action on a CHECK-constrained nullable FK; all exclusive-target FKs were changed to RESTRICT/RESTRICT.
- Second schema execution reached `match` and exposed the same rule on its distinct-team CHECK; all CHECK-linked FKs, including both match team roles, have now been reviewed and corrected.
- Third schema execution reached `individual_result` and exposed reserved column name `rank`; placement columns are now `result_rank` and `award_rank`, and the workspace has been audited for the requested reserved-word list.
- Credential-safe execution passed schema, seed, views, and triggers as `campus_dev`; routine replacement was adjusted to MySQL-supported `CREATE ... IF NOT EXISTS` because drops require `SYSTEM_USER` and function replacement syntax is unsupported.
- Manual Step 4 is complete: `schema.sql` ran with no errors; the database contains 17 InnoDB tables using `utf8mb4_0900_ai_ci`.
- `sql/seed.sql` is created with 6 departments, 8 teams, 40 students, 39 matches, 2 tournaments, 4 events, and 3 sports.
- Manual Step 5 is complete: seed data loaded with no errors and all required minimum counts passed.
- Phase-6 files are drafted: `views.sql`, `triggers.sql`, `procedures.sql`, `queries.sql`, `transactions.sql`, and `docs/relational_algebra.md`.
- Credential-safe local configuration is ready: `.gitignore` ignores `.env` and `node_modules/`; `.env.example` uses `campus_app`.
- The application configuration now requires the `campus_app` password, session secret, and private demo-account passwords.
- All phase-6 SQL files passed as `campus_dev`; verification found 17 tables, 4 views, 3 procedures, 1 function, 6 triggers, non-empty target views, a successful transaction demo, and four rejected trigger demos.
- The Express app now has bcrypt authentication, server-side sessions, CSRF protection, role middleware, player/coordinator/admin forms, and human-readable database rejection messages.
- Demo users were seeded successfully through `campus_app`; the private `.env` was not read into chat or committed.
- App dependencies installed with zero vulnerabilities; `node --check` passed.
- Six integration tests pass: login/invalid login, role restriction, eligible and ineligible registration, venue clash, points update, and completed-match locking.
- Seed data now includes a second basketball tournament, mixed completed/upcoming/live fixtures, named venues, team registrations, and basketball officials; visible dates are formatted without timestamps.
- Added the public `/design` tab: a visual SVG ER diagram plus all 17 relation definitions, attributes, keys, foreign keys, cardinalities, integrity rules, and dependency explanations.
- README, runbook, viva questions, and presentation outline now document application setup and the live role demo.
- The private `.env` remains local and ignored; its contents were never printed or committed.
- Participant/player accounts and viewer accounts are now view-only; coordinator and admin roles retain all write workflows.
- The landing page now states the view-only policy, and the shared navigation has grouped public links with a consistent role/account area for every role.
- Event creation now redirects administrators to a guided setup page where they select participating teams, create a group stage, generate round-robin matches, and review the competition map.
- Match control now records only scores, status/final result, and rescheduling; the match-event recording form and route were removed from the application UI.
- Completed matches now render as locked result cards, so coordinators are not shown score fields that the database will reject.
- Match control dashboard was redesigned into operation cards for fixture creation, group fixtures, knockout advancement, awards, and a separate matches panel.
- Added the `sport_venue` associative relation and seeded sport-specific venue suitability.
- Event setup now distinguishes team sports from individual sports: team events use groups and home/away matches; athletics/singles events show registered athletes, heats, individual results, and rankings instead.
- Group fixture generation and manual match creation reject individual events at the application/database boundary.
- Individual event setup now has a student registration selector. Existing students can be selected for any other event, while saving one event only updates that event's student registrations.
- Match control selectors now exclude individual-event stages and events, so sprint heats cannot appear as team matches.
- Final smoke checks pass for admin login, team-event setup, individual-event setup, and Match control filtering. Triggers and routines are installed; all six integration tests pass.
- Points table now renders each group in a separate, color-accented standings card with its own team count and table.
- Points table now identifies the sport and event above each set of group standings, making football and basketball competitions visibly distinct.
- Demo accounts were restored through `app/seed-users.js`; admin, coordinator, player, and viewer login now work again without storing passwords in source.
- Revamped the public `/design` tab: interactive vector Entity & Relationship diagram displaying all 18 database entities with directed relationship lines and cardinality labels (no attributes inside the diagram boxes), paired with a complete 18-relation data dictionary with exact SQL data types, keys, foreign-key actions, CHECK invariants, 6 triggers, 4 views, 4 stored routines, and interactive category filtering.
- Fixed team and student selection parsing and group fixture generation: resolved bracketed input naming (`team_ids[]` -> `team_ids`) for Express body parser, added defensive registration parsing and threshold validation (>= 2 teams), enhanced stored procedure `sp_generate_group_fixtures` with strict validation against empty/unpopulated stages, and allowed safe reuse of existing empty stages. All 6 tests pass.
- Refined RDBMS design page per user feedback: removed blue hero banner box so only clean page title and subtitle show, removed viva oral defense section from the web UI (keeping 4 concise tabs: Diagram, Relational Dictionary, Cardinality Matrix, and Programmability Layer), and expanded vertical breathing space between eyebrows, headings, and descriptions across the app.
- Implemented seamless individual event viewing and dedicated event hubs: added `/events` directory with sport filter pills, created comprehensive `/events/:id` views detailing event stats, isolated stages and group standings (or individual heat results), match schedules, and registered teams/athletes. Linked seamlessly from the top navigation bar, landing page active competitions showcase, schedule filter pills, points table headers, and admin event lists.
- Created complete ground-zero DBMS design and triggers handout (both Markdown and publication-ready PDF at `docs/DBMS_DESIGN_HANDOUT.pdf` generated via `npm run export:pdf`) covering all 18 tables, the 5 logical clusters, referential actions, architectural patterns (Exclusive ARC, dual progression, deliberate denormalization), deep trigger mechanics, and a viva oral defense cheat sheet.
- Removed Top Scorers module entirely: dropped `v_top_scorers` view from MySQL database and `sql/views.sql`, removed `/scorers` route and navigation bar link from web app, and updated all design/viva documentation.
- Completely overhauled Card 04 "Assign awards" in Match control: fixed Express route collision where `/admin/:resource` shadowed `/admin/awards` with a 404, routed to `/coordinator/awards` and `/coordinator/awards/reset` with coordinator and admin authorization, implemented real-time DOM option rebuilding to prevent cross-event dropdown pollution, added dynamic status hints showing final match winners or round-robin points table podiums, defaulted date to today, added live podium display with reset support, and added comprehensive integration tests. All 7 tests pass.
- Added explicit Sport and Event visibility across Match control: added `Sport` and `Event` columns to the Live operations matches table, added a live client-side sport filter dropdown with match counts, formatted stage dropdowns in fixture and advancement cards as `Sport — Event · Stage`, and displayed sport and event context on single match control pages (`/coordinator/matches/:id`).
- Overhauled `v_points_table` view and `/points` route to sync with all active team events and group stages: re-architected the view using a `stage_teams` CTE and `LEFT JOIN` on completed matches to show full group rosters with initial 0-point standings before matches are completed, and updated `/points` to display all registered group stages (including newly created ones like `Hockey champ`). All 7 integration tests pass.
- Created dedicated DBMS Joins and Aggregates architectural and oral defense guide (`docs/DBMS_QUERIES_AND_AGGREGATES.md`) and compiled it into a separate, publication-quality PDF (`docs/DBMS_QUERIES_AND_AGGREGATES.pdf`) via Edge headless export: covers relational join mechanics (equi-joins, nested-loop/hash joins, left outer join row preservation, dual-team self joins, exclusive-arc unions), SQL aggregate functions (`COUNT(*)`, `COUNT(col)`, `SUM`, `AVG`, `MIN`, `MAX`, boolean condition sums, unsigned integer casting, null coalescing), advanced engine features (CTEs, Window Functions `DENSE_RANK`, `RANK`, `ROW_NUMBER`), complete catalog of all 25+ SQL statements across the project, step-by-step query walkthroughs, and a 10-question viva oral defense guide.




## Last decision

The initial scope remains within the approved 13–20 table target; the blueprint now has 18 tables after adding `sport_venue`. Standings will be computed by a view rather than stored in a separate table. The current user-facing role policy is read-only for viewers and participants; coordinators and admins are the editing roles. Dedicated event views (`/events/:id`) isolate groups and matches per competition. The RDBMS design tab features a clean Entity & Relationship diagram (showing only entities and relationship edges, leaving attributes to the relational dictionary below) and interactive highlight tracing.

## Known blockers

- SQL implementation is authorized and complete.
- Manual Step 7 is complete. The trigger and routine definitions were reinstalled successfully.
- No active implementation blockers remain. The final live presentation remains a group task.

## Exact next action

After reading this file, read `docs/handoff/NEXT_AGENT.md`, then use `docs/handoff/RUNBOOK.md` for the live demonstration, including the new `/events` hub, dedicated `/events/:id` competition pages, guided event setup, separated individual heats, score-only Match control, and the newly revamped RDBMS design showcase. Restart the local web server (`npm start`) to pick up the new routes.
