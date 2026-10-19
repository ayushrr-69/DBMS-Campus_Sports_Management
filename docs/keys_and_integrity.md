# Keys and Integrity Design

This document defines the planned keys and referential actions before DDL. Exact SQL syntax belongs in the later schema phase.

## Key conventions

- Every table has a singular snake-case name and a surrogate `<table>_id` primary key unless an associative key is more natural.
- Candidate keys that must not repeat are marked as unique.
- Foreign keys point only to one named parent relation; no polymorphic foreign keys are used.
- `ON UPDATE CASCADE` is the default for parent-key updates because child references should follow a changed surrogate key.
- Destructive deletes are restricted for historical/core records and cascaded only for existence-dependent rows.

## Per-table keys and referential actions

| Table | Candidate/primary keys | Foreign keys | Planned `ON DELETE` / `ON UPDATE` |
|---|---|---|---|
| `department` | `department_id` PK; `name` candidate | none | n/a |
| `student` | `student_id` PK; `roll_number` candidate | `department_id` | RESTRICT / CASCADE |
| `sport` | `sport_id` PK; `name` candidate | none | n/a |
| `tournament` | `tournament_id` PK | none | n/a |
| `event` | `event_id` PK; `(tournament_id, name)` candidate | `tournament_id`, `sport_id` | RESTRICT / CASCADE for both |
| `eligibility_rule` | `eligibility_rule_id` PK; possibly `event_id` candidate if one rule per event | `event_id` | CASCADE / CASCADE |
| `team` | `team_id` PK; `(department_id, name)` candidate | `department_id`, nullable `captain_id` | RESTRICT / CASCADE; SET NULL / CASCADE for captain |
| `registration` | `registration_id` PK | `event_id`, nullable `student_id`, nullable `team_id` | RESTRICT / CASCADE for event; RESTRICT / RESTRICT for entrant parents because the columns participate in an exactly-one CHECK |
| `team_member` | composite PK `(team_id, student_id)` | `team_id`, `student_id` | CASCADE / CASCADE for both |
| `stage` | `stage_id` PK; `(event_id, stage_order)` candidate | `event_id` | CASCADE / CASCADE |
| `venue` | `venue_id` PK; `name` candidate | none | n/a |
| `match` | `match_id` PK | `stage_id`, `venue_id`, `home_team_id`, `away_team_id` | RESTRICT / CASCADE for stage and venue; RESTRICT / RESTRICT for home/away teams because those columns participate in a distinct-team CHECK |
| `match_event` | `match_event_id` PK | `match_id`, nullable `student_id`, nullable `team_id` | CASCADE / CASCADE for match; RESTRICT / CASCADE for referenced people/teams |
| `official` | `official_id` PK | nullable `match_id`, nullable `individual_result_id` | RESTRICT / RESTRICT for both assigned targets because the columns participate in an exactly-one CHECK |
| `individual_result` | `individual_result_id` PK | `registration_id`, `stage_id`, `venue_id` | CASCADE / CASCADE for registration/stage; RESTRICT / CASCADE for venue |
| `award` | `award_id` PK | `event_id`, nullable `student_id`, nullable `team_id` | RESTRICT / CASCADE for event; RESTRICT / RESTRICT for recipients because the columns participate in an exactly-one CHECK |
| `app_user` | `app_user_id` PK; `username` candidate; optional `student_id` candidate | nullable `student_id` | SET NULL / CASCADE |

## Integrity checks beyond foreign keys

- `registration`: exactly one of `student_id` and `team_id` is non-null.
- `official`: exactly one of `match_id` and `individual_result_id` is non-null.
- `award`: exactly one of `student_id` and `team_id` is non-null.
- `match`: home and away teams are distinct; duration and scores are non-negative.
- `team_member`: jersey number is valid and a student cannot occur twice in one squad.
- `stage`: stage order is positive and unique within its event.
- `individual_result`: result value and `result_rank` are valid for the event's result unit.
- `app_user`: role is one of the four approved roles.
- Triggers later enforce eligibility, venue clashes, score synchronization, and final-match locking.

## MySQL CHECK and referential-action compatibility

MySQL 8.0.46 rejects a column used by a `CHECK` constraint when that column is also in a foreign key with a cascading referential action. The CHECK-linked foreign keys in `registration`, `match`, `official`, and `award` therefore use `ON DELETE RESTRICT ON UPDATE RESTRICT`. This is also the correct business rule: a student, team, match, result, or award recipient cannot be deleted or key-updated while a record that must retain an exact relationship depends on it. Other foreign keys whose columns are not used by CHECK constraints retain their documented cascades or set-null actions.

## Action rationale

Cascade is used for true child facts that have no meaning without their parent, such as team membership, match events, stages, and eligibility rules. Restrict is used for core or historical parents to prevent deleting a department, team, venue, or participant while competition records depend on it. Set-null preserves an account or award history when an optional person association is removed. These actions will be tested explicitly after DDL exists.
