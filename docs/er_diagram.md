# ER Design

## Notation and design decisions

The diagram uses Mermaid ER notation with crow's-foot cardinalities. A circle means optional participation, a bar means exactly one, and a crow's foot means many. Associative entities resolve many-to-many relationships.

`registration` has nullable `student_id` and `team_id`, with exactly one required by a future `CHECK`. A single foreign key cannot legally point to both `student` and `team`, so two ordinary foreign keys are safer than a polymorphic ID. `official` uses the same pattern for assignment to either a match or an athletics result/heat.

## Mermaid ER diagram

```mermaid
erDiagram
    DEPARTMENT ||--o{ STUDENT : contains
    DEPARTMENT ||--o{ TEAM : represents
    STUDENT ||--o{ TEAM : captains
    TOURNAMENT ||--o{ EVENT : contains
    SPORT ||--o{ EVENT : classifies
    EVENT ||--o{ ELIGIBILITY_RULE : has
    EVENT ||--o{ REGISTRATION : accepts
    STUDENT o|--o{ REGISTRATION : enters
    TEAM o|--o{ REGISTRATION : enters
    TEAM ||--o{ TEAM_MEMBER : has
    STUDENT ||--o{ TEAM_MEMBER : joins
    EVENT ||--o{ STAGE : contains
    STAGE ||--o{ MATCH : schedules
    VENUE ||--o{ MATCH : hosts
    TEAM ||--o{ MATCH : home_team
    TEAM ||--o{ MATCH : away_team
    MATCH ||--o{ MATCH_EVENT : records
    STUDENT o|--o{ MATCH_EVENT : performs
    TEAM o|--o{ MATCH_EVENT : scores_for
    OFFICIAL o|--o| MATCH : officiates
    STAGE ||--o{ INDIVIDUAL_RESULT : contains
    VENUE ||--o{ INDIVIDUAL_RESULT : hosts
    REGISTRATION ||--o{ INDIVIDUAL_RESULT : produces
    OFFICIAL o|--o| INDIVIDUAL_RESULT : officiates
    EVENT ||--o{ AWARD : presents
    STUDENT o|--o{ AWARD : receives
    TEAM o|--o{ AWARD : receives
    STUDENT o|--o| APP_USER : owns

    DEPARTMENT {
        int department_id PK
        string name
        string department_type
    }
    STUDENT {
        int student_id PK
        int department_id FK
        string roll_number UK
        string full_name
        string gender
        int academic_year
        date date_of_birth
    }
    SPORT {
        int sport_id PK
        string name UK
        boolean is_team_sport
    }
    TOURNAMENT {
        int tournament_id PK
        string name
        date start_date
        date end_date
    }
    EVENT {
        int event_id PK
        int tournament_id FK
        int sport_id FK
        string name
        string gender_category
        string format
    }
    ELIGIBILITY_RULE {
        int eligibility_rule_id PK
        int event_id FK
        int min_year
        int max_year
        string gender
        int min_age
        int max_age
    }
    TEAM {
        int team_id PK
        int department_id FK
        int captain_id FK
        string name
    }
    REGISTRATION {
        int registration_id PK
        int event_id FK
        int student_id FK
        int team_id FK
        string status
    }
    TEAM_MEMBER {
        int team_id PK, FK
        int student_id PK, FK
        int jersey_number
    }
    STAGE {
        int stage_id PK
        int event_id FK
        string stage_type
        int stage_order
    }
    VENUE {
        int venue_id PK
        string name UK
        string venue_type
    }
    MATCH {
        int match_id PK
        int stage_id FK
        int venue_id FK
        int home_team_id FK
        int away_team_id FK
        datetime starts_at
        int duration_minutes
        int home_score
        int away_score
        string status
    }
    MATCH_EVENT {
        int match_event_id PK
        int match_id FK
        int student_id FK
        int team_id FK
        string event_type
        int minute
    }
    OFFICIAL {
        int official_id PK
        int match_id FK
        int individual_result_id FK
        string full_name
        string role
    }
    INDIVIDUAL_RESULT {
        int individual_result_id PK
        int registration_id FK
        int stage_id FK
        int venue_id FK
        decimal result_value
        string result_unit
        int result_rank
    }
    AWARD {
        int award_id PK
        int event_id FK
        int student_id FK
        int team_id FK
        string award_type
        int award_rank
    }
    APP_USER {
        int app_user_id PK
        int student_id FK
        string username UK
        string password_hash
        string role
    }
```

## Relationship and participation table

| Relationship | Cardinality | Participation | Resolution or rule |
|---|---|---|---|
| Department–Student | 1:N | Student total; department optional | `student.department_id` |
| Department–Team | 1:N | Team total; department optional | `team.department_id` |
| Student–Team as captain | 1:N | Team total; student optional | `team.captain_id` |
| Tournament–Event | 1:N | Event total | `event.tournament_id` |
| Sport–Event | 1:N | Event total | `event.sport_id` |
| Event–EligibilityRule | 1:N | Rule belongs to event | `eligibility_rule.event_id` |
| Event–Registration | 1:N | Registration total | `registration.event_id` |
| Student/Team–Registration | 1:N per target | Registration total to exactly one target | two nullable FKs plus `CHECK` |
| Team–Student as members | M:N | Membership is optional on both sides | resolved by `team_member` |
| Event–Stage | 1:N | Stage total | `stage.event_id` |
| Stage–Match | 1:N | Match total | `match.stage_id` |
| Venue–Match | 1:N | Match total | `match.venue_id`; overlap trigger |
| Team–Match as home/away | each role 1:N | Match requires two distinct teams | two role-specific FKs and check |
| Match–MatchEvent | 1:N | Event total | `match_event.match_id` |
| MatchEvent–Student/Team | optional references | Event may identify performer and team | consistency checks |
| Official–Match/Result | 1:0..1 per assignment | Assignment targets exactly one type | two nullable FKs plus `CHECK` |
| Registration–IndividualResult | 1:N | Result belongs to registration | `individual_result.registration_id` |
| Stage/Venue–IndividualResult | 1:N each | Result requires both | two FKs |
| Event–Award | 1:N | Award belongs to event | `award.event_id` |
| Student/Team–Award | optional references | Award targets exactly one recipient | two nullable FKs plus `CHECK` |
| Student–AppUser | 0..1:0..1 | User may be linked to one student | nullable unique FK |

## Weak and associative entities

- `team_member` is an associative entity with a composite identity (`team_id`, `student_id`) and cannot exist without both owners.
- `match_event` is existence-dependent on `match`; its details have no meaning outside that match.
- `individual_result` is existence-dependent on a registration and a stage.
- `registration` and `award` use ordinary foreign keys with an exclusive-target check rather than an unsafe polymorphic foreign key.
