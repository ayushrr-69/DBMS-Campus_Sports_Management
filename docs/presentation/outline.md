# Presentation Outline

## Slide 1 — Problem and scope

- **Speaker:** Member 1
- **Notes:** Explain why tournament registration, fixtures, results, and awards need one consistent database.
- **Demo:** Show the project folder and README.

## Slide 2 — Requirements and users

- **Speaker:** Member 1
- **Notes:** Cover admin, coordinator, player, and viewer roles, plus team and athletics requirements.
- **Demo:** Point to `docs/requirements.md`.

## Slide 3 — ER diagram

- **Speaker:** Member 2
- **Notes:** Explain the 17 entities, cardinalities, `team_member`, and exclusive student/team references.
- **Demo:** Open `docs/er_diagram.md` and the Mermaid diagram.

## Slide 4 — Relational mapping and keys

- **Speaker:** Member 2
- **Notes:** Explain one-to-many FKs, the composite membership key, candidate keys, and MySQL referential actions.
- **Demo:** Show `docs/relational_mapping.md` and `docs/keys_and_integrity.md`.

## Slide 5 — Normalization

- **Speaker:** Member 3
- **Notes:** Walk from repeating groups to 1NF, 2NF, and 3NF/BCNF.
- **Demo:** Explain the deliberate match-score redundancy and its trigger.

## Slide 6 — Schema and seed data

- **Speaker:** Member 3
- **Notes:** Show the 17-table DDL, CHECK constraints, indexes, and realistic seed counts.
- **Demo:** Run the table and seed count queries.

## Slide 7 — Views and standings

- **Speaker:** Member 4
- **Notes:** Explain computed points, medal tally, schedule, and top scorers.
- **Demo:** Query `v_points_table` and show the window-function position.

## Slide 7A — RDBMS design walkthrough

- **Speaker:** Member 2
- **Notes:** Explain that the database contains 17 relations, not one flat tournament table. Distinguish strong entities, dependent entities, relationship entities, and the `team_member` associative relation.
- **Demo:** Open `/design`; show the SVG ER diagram, then scroll through relation cards and the dependency table. Highlight `registration`, `official`, and `award` as exactly-one target designs enforced by ordinary foreign keys plus checks.

## Slide 8 — Triggers and procedures

- **Speaker:** Member 4
- **Notes:** Demonstrate eligibility, venue clash prevention, score updates, final locking, and fixture generation.
- **Demo:** Run one passing and one failing trigger example.

## Slide 9 — Transactions and relational algebra

- **Speaker:** Member 5
- **Notes:** Explain COMMIT, ROLLBACK, ACID properties, and one algebra translation.
- **Demo:** Run `transactions.sql` and show the restored registration status.

## Slide 10 — Web app and authentication

- **Speaker:** Member 5
- **Notes:** Explain bcrypt login, server-side sessions, CSRF tokens, role middleware, and least-privilege `campus_app`.
- **Demo:** Open the public pages, then log in as `viewer.demo` and show the coordinator page is denied.

## Slide 11 — Live role workflow

- **Speaker:** Member 5
- **Notes:** Walk through the forms rather than only displaying data.
- **Demo:** As `player.demo`, show the participant view-only dashboard with registrations and own matches. As `coordinator.demo`, enter a score and show points change, then attempt a venue clash and edit a completed match. As `admin.demo`, edit master data and call award assignment.

## Slide 12 — Challenges, fixes, and team roles

- **Speaker:** Member 1 / All members
- **Notes:** Discuss MySQL CHECK/cascade compatibility, reserved identifiers, unsigned arithmetic, bcrypt/session security, and least privilege. State each member's contribution.
- **Demo:** Show the decision log, then run `npm test` and end with the README run order.
