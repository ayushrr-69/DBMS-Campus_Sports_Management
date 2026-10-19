# Schema Notes

This is the phase-1 blueprint. Exact columns, keys, dependencies, and constraint syntax will be finalized in the ER and normalization documents.

| Table | Purpose | Main relationships | Planned enforcing logic |
|---|---|---|---|
| `department` | Department or hostel represented in the tournament | parent of `student` and `team` | uniqueness and type checks |
| `student` | Person who can play | belongs to `department`; may captain, register, join, or receive an award | unique roll number and eligibility checks |
| `sport` | Team or individual sport | parent of `event` | team/individual flag |
| `tournament` | One competition edition | parent of `event` | date and name checks |
| `event` | Sport category within a tournament | belongs to `tournament` and `sport`; parent of rules, stages, registrations, awards | format and gender checks |
| `eligibility_rule` | Entry limits for an event | belongs to `event` | registration trigger |
| `team` | Department-entered team | belongs to `department`; has a captain; parent of membership and match participation | captain and event consistency checks |
| `registration` | Student or team event entry | belongs to `event`; nullable `student_id` or `team_id` | exactly-one entrant `CHECK` and `trg_check_eligibility` |
| `team_member` | Team/student membership | resolves `team` and `student` | unique membership and jersey number |
| `stage` | Ordered group, knockout, or heat stage | belongs to `event`; parent of match/results | stage-type and order checks |
| `venue` | Physical competition location | parent of scheduled matches/results | venue identity |
| `sport_venue` | Suitable venue for a sport | resolves the many-to-many relationship between `sport` and `venue` | composite primary key and cascading foreign keys |
| `match` | Scheduled team contest | belongs to `stage`, `venue`, and two teams; may have an official | `trg_venue_clash` and `trg_lock_final_match` |
| `match_event` | Event during a match | belongs to `match`; may identify student/team | `trg_update_score` for goals |
| `official` | Referee, umpire, or official | nullable match or athletics-heat target | exactly-one assignment `CHECK` |
| `individual_result` | Athletics heat entry and result | connects registration, stage, and venue | `result_rank`/result checks |
| `award` | Medal or other award | belongs to event; awarded to student or team | exclusive recipient and `award_rank` checks |
| `app_user` | Login account and role | optionally linked to `student` | controlled role and unique login |

Match score columns are intentionally redundant with scoring `match_event` rows and are synchronized by `trg_update_score`. Views are defined in `sql/views.sql`; procedures and `fn_team_points` are in `sql/procedures.sql`. Phase-6 objects have been validated as `campus_dev`.
