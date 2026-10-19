# Campus Sports Tournament DBMS: Coding Agent Plan

Oct 18, 2026 · @Ayush Rajput

A step-by-step brief for a coding agent to design and build a MySQL-based campus sports tournament system, relation-heavy, with design documents approved before any code.

## Goal and constraints

The agent builds a campus sports tournament database where the schema is the main product and the web app is a thin layer over it.

| Choice | Decision |
| --- | --- |
| Database | MySQL 8.0 Community Edition, installed locally (InnoDB, utf8mb4) |
| Formats | Group stage + knockout for team sports; individual events (athletics) with heats and ranks |
| Extra entities | Venues and scheduling, registrations and eligibility, departments/hostels |
| Automatic features | Points table and standings, medals and awards, users and roles, live scores and match events |
| Size | 17 tables, within the 13 to 20 target |
| Frontend | Simple Node.js web app |
| Working mode | Design documents first, you approve, then code |

## Phases

The agent stops after phase 3 and waits for your approval before writing any SQL or app code.

1. **Requirements** (document only): list entities, attributes and business rules from this plan, with assumptions marked.
2. **ER design** (document only): entities, relationships, cardinalities, participation, weak entities, and the many-to-many resolutions, written as a Mermaid ER diagram plus a relationship table and the ER-to-relational mapping document.
3. **Normalization** (document only): functional dependencies per table, shown stepwise from unnormalized form to 3NF/BCNF, with any deliberate denormalization justified. **Approval gate.**
4. **Schema DDL**: `schema.sql` with all 17 tables, primary and foreign keys, `ON DELETE` rules, `CHECK`, `UNIQUE`, `NOT NULL` and indexes.
5. **Sample data**: `seed.sql` with realistic campus data, at least 6 departments, 8 teams, 40 players, 30 matches and 2 athletics events.
6. **Database logic**: views, triggers, stored procedures and a query set (next section).
7. **Web app**: a small web app that calls only the views and procedures.
8. **Test and polish**: run every file on a clean MySQL instance, fix errors, then write the README, a viva question sheet and the presentation outline.

## Table blueprint

The agent starts from these 17 tables and may adjust them in the ER and normalization phases, explaining every change.

| # | Table | Purpose | Key relationships |
| --- | --- | --- | --- |
| 1 | `department` | Department or hostel a team represents | Parent of `student`, `team` |
| 2 | `student` | Anyone who can play | FK `department`; unique roll number |
| 3 | `sport` | Cricket, football, 100m and so on | Parent of `event`; flag for team or individual |
| 4 | `tournament` | One edition, such as Sports Fest 2026 | Parent of `event` |
| 5 | `event` | A sport inside a tournament (men's football) | FK `tournament`, `sport`; gender and format fields |
| 6 | `eligibility_rule` | Year, gender, age limits per event | FK `event` |
| 7 | `team` | Team entered by a department | FK `department`, `captain` (student) |
| 8 | `registration` | A student or team entering an event | Resolves student/team to event; status field |
| 9 | `team_member` | Players in a team's squad | Resolves `team` and `student`; jersey number |
| 10 | `stage` | Group, quarter-final, semi-final, final, heat | FK `event`; stage order and type |
| 11 | `venue` | Ground, court, track | Parent of `match` and `heat` schedule |
| 12 | `match` | One scheduled team match | FK `stage`, `venue`, two teams, official; no venue time clash |
| 13 | `match_event` | Goal, wicket, foul, card with minute | FK `match`, `student`, `team` |
| 14 | `official` | Referees and umpires | Assigned to `match` and `heat` |
| 15 | `individual_result` | Heat entries with time, distance and rank | FK `registration`, `stage`, `venue` |
| 16 | `award` | Medals, player of the tournament, department trophy | FK `event`, `student` or `team`; rank |
| 17 | `app_user` | Login accounts with role | FK optional `student`; roles admin, coordinator, player, viewer |

Standings are not stored as a table. A view computes the points table from `match` results so it can never drift out of sync, and a trigger blocks edits that would break it.

## Database logic

Each item below goes in its own file under `sql/`, with a comment on what it demonstrates.

| Type | Item | What it does |
| --- | --- | --- |
| View | `v_points_table` | Per group: played, won, drawn, lost, goals for/against, points, ranked |
| View | `v_medal_tally` | Gold, silver and bronze count per department |
| View | `v_match_schedule` | Upcoming matches with teams, venue and official |
| View | `v_top_scorers` | Players ranked by `match_event` goals |
| Trigger | `trg_check_eligibility` | Rejects a registration that breaks the event's eligibility rule |
| Trigger | `trg_venue_clash` | Rejects a match that overlaps another at the same venue and time |
| Trigger | `trg_update_score` | Updates the match score when a goal event is inserted |
| Trigger | `trg_lock_final_match` | Blocks edits to a match once it is marked completed |
| Procedure | `sp_generate_group_fixtures` | Creates round-robin matches for a group |
| Procedure | `sp_advance_knockout` | Moves group winners into the first knockout stage |
| Procedure | `sp_assign_awards` | Writes medals and awards from final results |
| Function | `fn_team_points` | Points for a team in an event, reused by views |
| Queries | 15 to 20 named queries | Joins, `GROUP BY`/`HAVING`, subqueries, set operations, window functions such as `RANK()` |

## RDBMS requirements

Your professor asked for an RDBMS project, so the relational model must be visible and explained, not only working. These items are required on top of everything else in this plan.

| Item | File | Phase | Contents |
| --- | --- | --- | --- |
| ER-to-relational mapping | `docs/relational_mapping.md` | 2 | How each entity, relationship and many-to-many link became a table, with the mapping rule used and the keys chosen |
| Keys and integrity | `docs/keys_and_integrity.md` | 3 | Per table: candidate, primary, foreign and composite keys, plus every `ON DELETE` and `ON UPDATE` action with the reason for it |
| Transactions (ACID) | `sql/transactions.sql` | 6 | Demos with `START TRANSACTION`, `COMMIT` and `ROLLBACK`, for example saving a match result and its events together, and rolling back a failed registration; one line per ACID property saying which demo shows it |
| Relational algebra | `docs/relational_algebra.md` | 6 | 5 to 6 queries from `queries.sql` written in relational algebra (select, project, join, union, difference) beside the SQL |
| Viva questions | `docs/viva_questions.md` | 8 | Add questions on DBMS versus RDBMS, keys, referential integrity, ACID and relational algebra |

By default all of these are included. Confirm with your professor whether relational algebra and transactions are expected; if not, they can be shortened but not removed without asking.

## Handoff and continuity

Any other agent must be able to take over at any moment by reading three files: `AGENTS.md`, then `docs/handoff/STATUS.md`, then `docs/handoff/TODO.md`. The agent creates these in phase 1 and keeps them current from then on.

| File | Contents | Updated when |
| --- | --- | --- |
| `AGENTS.md` (repo root) | Project summary, reading order for a new agent, naming rules, hard rules from this plan | Rules change |
| `docs/handoff/STATUS.md` | Current phase, what is done, what is in progress, last decision, known bugs, exact next step | End of every work session |
| `docs/handoff/TODO.md` | Checklist per phase with status, blockers and the person or agent who owns each item | Every item started or finished |
| `docs/handoff/DECISIONS.md` | Dated log of each decision and its reason (for example MySQL 8.0 CE, crow's foot, Express) | Every decision |
| `docs/handoff/SCHEMA_NOTES.md` | Per table: purpose, keys, business rules, and which trigger or procedure enforces each rule | Schema changes |
| `docs/handoff/RUNBOOK.md` | Install steps, SQL run order, how to reset the database, start the app and run the tests | Setup changes |

Rules for keeping it current:

- Update `STATUS.md` and `TODO.md` after every phase and before stopping for any reason, so no work exists only in an agent's memory.
- Never leave a file half-written; mark unfinished parts with `TODO(agent):` and list them in `TODO.md`.
- Record the exact next command or file to open at the end of `STATUS.md`.

**Presentation.** The agent also writes `docs/presentation/outline.md`: one entry per slide with speaker notes and a demo script. Suggested flow: problem and scope, requirements, ER diagram, normalization example, schema highlights, trigger and procedure demo, live web app demo, challenges, future work, team roles. Because this is a group project, the outline should split speaking parts across members.

## Web app and deliverables

The app stays small so the database remains the focus: every page reads from a view or calls a procedure, with no business logic in app code.

**Pages**

- Public: tournament list, fixtures, live scores, points table, medal tally
- Player: register for an event, view own matches
- Coordinator: create matches, enter scores and match events
- Admin: manage users, departments, venues, awards

**Repository layout**

```
docs/      requirements.md, er_diagram.md, normalization.md, viva_questions.md
sql/       schema.sql, seed.sql, views.sql, triggers.sql, procedures.sql, queries.sql
app/       web app code
README.md  setup steps, run order, ER diagram image
```

**Done means**

1. All SQL files run in order on a fresh MySQL instance with zero errors.
2. Every trigger has a passing and a failing demo in `queries.sql`.
3. Every table is in 3NF or BCNF, or the exception is documented.
4. The README lets a lab examiner run the project in under five minutes.

## Manual steps

Whenever a step needs you to act outside the repository (installing software, creating accounts, running commands on your computer, clicking in a tool), the agent must pause and give you written instructions before going on. It must not assume the step is done until you confirm.

Each set of instructions contains:

1. What the step is and why it is needed.
2. Exact numbered steps with the commands to type, for your operating system (the agent asks which one you use before the first step).
3. What you should see when it worked.
4. What to copy back to the agent if it fails, such as the error message.

The agent also logs every manual step in `docs/handoff/MANUAL_STEPS.md` as waiting or done, so another agent knows what is still pending.

Steps the agent should expect to hand you:

| Phase | Manual step |
| --- | --- |
| 1 | Tell the agent your operating system; install Node.js (LTS) and Git |
| 4 | Install MySQL 8.0 Community Server and MySQL Workbench, set the root password, create the project database and a project user |
| 4 to 6 | Run `schema.sql`, `seed.sql`, `views.sql`, `triggers.sql` and `procedures.sql` in order and report any errors |
| 7 | Run `npm install`, create the `.env` file with your database login, and start the app |
| 8 | Export the ER diagram image from Workbench and run the full test on a clean database |
| Presentation | Build the deck from the outline and rehearse the demo |

## Agent rules and open questions

**Rules**

- Never write SQL or app code before the phase 3 approval.
- Explain every design decision in plain language, since you must defend it in a viva.
- Use consistent naming: singular snake\_case tables, `<table>_id` primary keys.
- Keep business rules in the database (constraints, triggers, procedures), not in app code.
- Test each file on a clean MySQL instance before moving on, and report errors instead of hiding them.
- Ask before adding a table beyond 20 or dropping a requirement.

**Open questions**

- Target is MySQL 8.0 Community Edition, which supports window functions.
- Web stack is decided: Node.js with Express.
- ER notation defaults to crow's foot, which MySQL Workbench draws; switch to Chen only if your lab requires it.
- This is a group submission; confirm whether there is a viva.
