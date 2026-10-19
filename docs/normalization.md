# Normalization Analysis

## Purpose and boundary

This document evaluates the proposed 17-table design before DDL is written. The goal is 3NF or BCNF wherever practical, with every exception explicit. The examples use relation notation and functional dependencies (FDs), not executable SQL.

## 1. Unnormalized starting point

A tournament spreadsheet might put tournament, event, team, player, venue, match, score, and award data in one repeating row:

`TOURNAMENT_SHEET(tournament, event, sport, team_1, team_2, players, venue, match_time, score_events, awards)`

The `players`, `score_events`, and `awards` fields are repeating groups. A single row would also repeat tournament, event, team, and venue facts for every player or score event. This creates update, insertion, and deletion anomalies.

## 2. First normal form

To reach 1NF, every field must be atomic and every repeating group must become rows. The design separates players, team members, match events, registrations, and awards into their own relations. Each row has a key and no list-valued column.

Examples:

- `TEAM_MEMBER(team_id, student_id, jersey_number)`
- `MATCH_EVENT(match_event_id, match_id, event_type, minute, student_id, team_id)`
- `AWARD(award_id, event_id, award_type, award_rank, student_id, team_id)`

## 3. Second normal form

2NF removes partial dependencies on part of a composite key. The only intentional composite-key relation is:

`TEAM_MEMBER(team_id, student_id, jersey_number)`

The candidate key is `(team_id, student_id)`, and `jersey_number` describes that membership, not just the team or just the student. Therefore it has no partial dependency. Team facts belong in `TEAM`; student facts belong in `STUDENT`.

All other proposed tables use a single surrogate primary key, so partial dependency on a composite key does not arise. `event`, `stage`, `match`, and `individual_result` each keep facts that describe their own identified entity.

## 4. Third normal form and BCNF review

The following table lists the main determinants. In each ordinary table, the determinant is a candidate key, so the relation is intended to satisfy BCNF.

| Relation | Important functional dependencies | Normal-form reasoning |
|---|---|---|
| `DEPARTMENT` | `department_id -> name, department_type`; `name -> department_id` if name is unique | Candidate keys are declared identifiers/name; non-key attributes describe the department. |
| `STUDENT` | `student_id -> department_id, roll_number, full_name, gender, academic_year, date_of_birth`; `roll_number -> student_id` | Roll number is an alternate candidate key; no non-key determines another non-key. |
| `SPORT` | `sport_id -> name, is_team_sport`; `name -> sport_id` | Sport name is an alternate key; the team flag belongs to the sport. |
| `TOURNAMENT` | `tournament_id -> name, start_date, end_date` | Edition identifier determines its descriptive facts. |
| `EVENT` | `event_id -> tournament_id, sport_id, name, gender_category, format` | Event attributes depend on the event, not transitively on tournament or sport. |
| `ELIGIBILITY_RULE` | `eligibility_rule_id -> event_id, min_year, max_year, gender, min_age, max_age` | Rule facts depend on the rule; if one rule per event is chosen, `event_id` is also unique. |
| `TEAM` | `team_id -> department_id, captain_id, name`; `(department_id, name) -> team_id` when unique | Team facts do not repeat department facts; captain is a relationship attribute. |
| `REGISTRATION` | `registration_id -> event_id, student_id, team_id, status` | The exactly-one target check is a constraint, not a transitive dependency. |
| `TEAM_MEMBER` | `(team_id, student_id) -> jersey_number` | The membership key determines the membership-specific jersey number. |
| `STAGE` | `stage_id -> event_id, stage_type, stage_order`; `(event_id, stage_order) -> stage_id` | Stage order is unique within an event; no stage attribute depends on another non-key. |
| `VENUE` | `venue_id -> name, venue_type`; `name -> venue_id` | Venue name is an alternate key. |
| `MATCH` | `match_id -> stage_id, venue_id, home_team_id, away_team_id, starts_at, duration_minutes, home_score, away_score, status` | Scheduling and result facts depend on the match. Cross-table consistency rules are constraints/triggers. Official assignment is held on `OFFICIAL` so the same exclusive-target pattern can serve matches and athletics results. |
| `MATCH_EVENT` | `match_event_id -> match_id, student_id, team_id, event_type, minute` | Event details depend on the event row; match totals are not copied here. |
| `OFFICIAL` | `official_id -> match_id, individual_result_id, full_name, role` | The exclusive target is a relationship choice; official identity determines its assignment and details. |
| `INDIVIDUAL_RESULT` | `individual_result_id -> registration_id, stage_id, venue_id, result_value, result_unit, result_rank` | A result row describes one registration in one stage. |
| `AWARD` | `award_id -> event_id, student_id, team_id, award_type, award_rank` | Award facts depend on the award; exclusive recipient is a constraint. |
| `APP_USER` | `app_user_id -> student_id, username, password_hash, role`; `username -> app_user_id` | Username is an alternate key; account facts are not stored on student. |

## 5. Exclusive-target relationships

`REGISTRATION`, `OFFICIAL`, and `AWARD` each need to reference one of two entity types. A single relational foreign key cannot target two tables. The design therefore uses two nullable ordinary foreign keys and an exactly-one check:

`(student_id IS NOT NULL) XOR (team_id IS NOT NULL)`

This preserves real referential integrity to both target tables. The check prevents both-null and both-filled rows. The same pattern is used for official assignment to a match or individual result, and for award recipients. These are integrity constraints rather than normalization violations.

## 6. Deliberate denormalization: match scores

The detailed scoring facts live in `MATCH_EVENT`, while `MATCH.home_score` and `MATCH.away_score` store the current aggregate needed by schedule and standings views. In a fully normalized design, the aggregate could be calculated every time from event rows. We deliberately retain it because:

1. standings queries need a stable result quickly;
2. different sports can record events that are not directly equivalent to goals;
3. the event rows remain an audit trail;
4. a database trigger can update the stored score whenever a qualifying scoring event is inserted or changed.

This is a controlled performance/readability trade-off, not an accidental duplicate. The trigger is part of the consistency contract, and later tests must demonstrate both a successful score update and a rejected invalid edit.

## 7. Remaining integrity rules

Normalization alone cannot express all business rules. Later DDL and database logic must enforce:

- exactly-one entrant/recipient/assignment checks;
- two distinct teams in a match;
- event/team/student sport consistency;
- eligibility at registration time;
- venue time-overlap prevention;
- final-match locking;
- score synchronization;
- valid ranks and result units.

## Approval gate

Phases 1–3 are now documented. No SQL or app code has been written. Implementation may begin only after the user explicitly approves this normalization document.
