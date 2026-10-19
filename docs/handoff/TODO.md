# Handoff TODO

Status values: `done`, `in progress`, `pending`, `blocked`.

## Phase 1 — Requirements

- [x] Read the supplied project plan — owner: agent
- [x] Confirm operating system (Windows 11) — owner: user
- [x] Confirm viva requirement — owner: user
- [x] Create `AGENTS.md` — owner: agent
- [x] Create `docs/requirements.md` — owner: agent
- [x] Create all handoff files — owner: agent
- [x] Install Node.js LTS and Git — owner: user — Windows 11 versions confirmed
- [x] Review requirements assumptions — owner: user and agent
- [x] Update this file and `STATUS.md` when phase 1 is complete

## Phase 2 — ER design

- [x] Write `docs/er_diagram.md` with Mermaid crow's-foot notation
- [x] Write `docs/relational_mapping.md` with entity and relationship mapping rules
- [x] Write the relationship, cardinality, participation, and weak-entity table
- [x] Explain many-to-many resolutions
- [x] Update `SCHEMA_NOTES.md`, `STATUS.md`, and this file

## Phase 3 — Normalization approval gate

- [x] Write `docs/normalization.md`
- [x] Show functional dependencies and stepwise UNF to 1NF to 2NF to 3NF/BCNF
- [x] Document any deliberate denormalization
- [x] Write `docs/keys_and_integrity.md` with keys and referential actions
- [x] Ask the user for explicit approval — approved 2026-10-18
- [x] Do not write SQL or app code before approval — approval received before SQL

## Later implementation

- [x] Install MySQL 8.0 Community Server and Workbench — owner: user — MySQL 8.0.46 confirmed
- [x] Run `sql/00_setup.sql`, verify least-privilege user, and run CHECK probe — owner: user — MySQL 8.0.46 confirmed
- [x] Write `sql/schema.sql` with all 17 tables, keys, checks, indexes, and referential actions
- [x] Run and validate `sql/schema.sql` — owner: user/agent — 17 InnoDB tables, no errors
- [x] Write `sql/seed.sql` with required realistic minimum data
- [x] Run and validate `sql/seed.sql` — owner: user/agent — 6 departments, 8 teams, 40 students, 31 matches, 2 athletics events
- [x] Write phase-6 database logic files: views, triggers, procedures, queries, transactions, relational algebra
- [x] Update private `.env` for `campus_app`, session secret, and demo passwords — owner: user — confirmed without exposing values
- [x] Run and validate phase-6 SQL files as `campus_dev` — owner: agent — all required checks passed
- [x] Implement authenticated Express application and role-specific forms
- [x] Install app dependencies and audit them
- [x] Seed bcrypt demo users
- [x] Add integration tests for authentication and database-enforced workflows
- [x] Write README, runbook, viva questions, and presentation outline
- [x] Update handoff status, decisions, TODO, and manual steps
- [x] Enrich seeded tournament data and standardize date-only display
- [x] Make participant and viewer accounts view-only; update landing copy and role navigation
- [x] Add guided event setup for team selection, group creation, fixture generation, and match review
- [x] Simplify Match control to scores, final status/result, and rescheduling
- [x] Show completed matches as locked results and redesign the Match control dashboard
- [x] Relate sports to suitable venues and seed the sport-venue mappings
- [x] Keep team-match workflows separate from individual heat/result workflows
- [x] Add student registration to individual-event setup and allow cross-event participation
- [x] Remove individual-event stages from team Match control selectors
- [x] Reinstall the updated MySQL triggers and rerun the completed-match locking integration test
- [x] Separate points-table groups visually into individual standings cards
- [x] Identify each points-table competition by sport and event
- [x] Revamp RDBMS design tab with complete 18-relation data dictionary, programmability layer, and viva defense reference
- [x] Add dedicated event hub (`/events`) and individual competition pages (`/events/:id`) with isolated groups, standings, matches, and participant rosters
- [x] Seamlessly link events across navbar, homepage, schedule filters, points tables, and admin management
- [x] Prepare the repository handoff notes and record the final verified state
- [x] Create comprehensive ground-zero DBMS design & triggers handout (Markdown and generated PDF at `docs/DBMS_DESIGN_HANDOUT.pdf`) with `npm run export:pdf`
- [x] Remove top scorer module completely from database (`v_top_scorers`) and webapp (`/scorers`)
- [x] Overhaul Assign awards section in Match control with dynamic filtering, standings preview, route precedence fix, and reset capabilities
- [x] Add Sport and Event visibility and live sport filter to Match control and match detail pages
- [x] Overhaul `v_points_table` and `/points` route to synchronize with all team events and group stages (including newly created ones like Hockey)
- [x] Create comprehensive DBMS Joins, Aggregates, CTEs, and Window Functions guide (`docs/DBMS_QUERIES_AND_AGGREGATES.md`) and export to a new, separate PDF (`docs/DBMS_QUERIES_AND_AGGREGATES.pdf`)
- [ ] Perform the final live presentation using the runbook — owner: group



