# ER-to-Relational Mapping

## Mapping rules used

1. Each strong entity becomes one relation with a singular snake-case name and a surrogate `<table>_id` primary key.
2. A one-to-many relationship places the one-side key as a foreign key on the many side.
3. A many-to-many relationship becomes an associative relation whose primary key is normally the pair of participating keys.
4. A relationship with its own attributes stores those attributes on the relationship relation.
5. An optional relationship uses a nullable foreign key. A relationship that can target two entity types uses two nullable ordinary foreign keys plus an exactly-one `CHECK`.
6. Repeating groups and existence-dependent entities become separate relations.

## Entity mapping

| ER entity | Relation | Mapping and chosen key |
|---|---|---|
| Department | `department` | Strong entity; `department_id` PK. |
| Student | `student` | Strong entity; `student_id` PK and unique `roll_number`; `department_id` is an FK. |
| Sport | `sport` | Strong entity; `sport_id` PK and unique name. |
| Tournament | `tournament` | Strong entity; `tournament_id` PK. |
| Event | `event` | Strong entity; `event_id` PK; FKs to `tournament` and `sport`. |
| Eligibility rule | `eligibility_rule` | Dependent entity; `eligibility_rule_id` PK; FK to `event`. |
| Team | `team` | Strong entity; `team_id` PK; FKs to department and optional captain. |
| Registration | `registration` | Relationship/entity for event entry; `registration_id` PK; FK to event and exactly one entrant FK. |
| Team member | `team_member` | M:N associative relation; composite PK `(team_id, student_id)`; jersey number is a relationship attribute. |
| Stage | `stage` | Dependent entity; `stage_id` PK; FK to event; unique stage order within event. |
| Venue | `venue` | Strong entity; `venue_id` PK and unique name. |
| Match | `match` | Scheduled relationship entity; `match_id` PK; FKs to stage, venue, and two role-specific teams. |
| Match event | `match_event` | Existence-dependent event relation; `match_event_id` PK; FK to match and optional performer references. |
| Official | `official` | Official assignment relation; `official_id` PK; exactly one target FK to match or individual result. |
| Individual result | `individual_result` | Heat-result relation; `individual_result_id` PK; FKs to registration, stage, and venue; `result_rank` stores placement. |
| Award | `award` | Award relation; `award_id` PK; `award_rank` stores placement; FK to event and exactly one recipient FK. |
| App user | `app_user` | Account entity; `app_user_id` PK, unique username, optional unique student FK. |

## Relationship mapping

| ER relationship | Relational mapping |
|---|---|
| Department contains Student | `student.department_id` references `department.department_id`. |
| Department represents Team | `team.department_id` references `department.department_id`. |
| Student captains Team | `team.captain_id` optionally references `student.student_id`. |
| Tournament contains Event | `event.tournament_id` references `tournament.tournament_id`. |
| Sport classifies Event | `event.sport_id` references `sport.sport_id`. |
| Event has EligibilityRule | `eligibility_rule.event_id` references `event.event_id`. |
| Event accepts Registration | `registration.event_id` references `event.event_id`. |
| Student or Team enters Event | `registration.student_id` and `registration.team_id` are nullable FKs; exactly one must be non-null. |
| Team has Student members | M:N relationship becomes `team_member(team_id, student_id, jersey_number)`. |
| Event contains Stage | `stage.event_id` references `event.event_id`. |
| Stage schedules Match | `match.stage_id` references `stage.stage_id`. |
| Venue hosts Match | `match.venue_id` references `venue.venue_id`; time overlap is a later trigger rule. |
| Match has home and away Team | `match.home_team_id` and `match.away_team_id` both reference `team.team_id`; a check requires distinct teams. |
| Match records MatchEvent | `match_event.match_id` references `match.match_id`. |
| Official serves Match or athletics result | `official.match_id` and `official.individual_result_id` are nullable FKs; exactly one is non-null. |
| Registration produces IndividualResult | `individual_result.registration_id` references `registration.registration_id`. |
| Stage/Venue host IndividualResult | `individual_result.stage_id` and `individual_result.venue_id` reference their parent relations. |
| Event presents Award | `award.event_id` references `event.event_id`. |
| Student or Team receives Award | `award.student_id` and `award.team_id` are nullable FKs; exactly one is non-null. |
| Student owns AppUser | `app_user.student_id` is an optional unique FK. |

## Mapping consequences

No polymorphic foreign key is used. Every reference remains a normal foreign key to a named relation, and the exclusive-target checks enforce the business choice. Derived standings remain a view rather than a relation. Match scores are the one documented deliberate redundancy, synchronized from match events by a later trigger.
