# Requirements: Campus Sports Tournament Management System

## 1. Problem statement

The college needs one reliable system to plan, run, and review a campus sports tournament. It must represent departments or hostels, students, teams, sports, events, eligibility, schedules, officials, match events, athletics results, awards, standings, and user access. The schema is the primary deliverable for the DBMS lab; the later web application is intentionally thin.

## 2. Scope

### In scope

- A tournament edition such as Sports Fest 2026
- Team sports with group-stage and knockout formats
- Individual athletics events with heats, times or distances, and ranks
- Departments or hostels represented by students and teams
- Student and team registrations with event eligibility
- Team squads and captains
- Stages, venues, scheduling, officials, and venue-clash prevention
- Match events such as goals, wickets, fouls, and cards
- Computed points tables and standings
- Medal tallies and awards
- User accounts and roles
- A later Express web app with public, player, coordinator, and admin surfaces
- Viva-ready design explanations and a presentation outline

### Out of scope unless later approved

- Payments, ticketing, spectators, external identity providers, mobile apps, and live streaming
- More than 20 tables
- A separate stored standings table; standings are intended to be computed by a view

## 3. Users and roles

- **Admin:** manages users, departments, venues, and awards.
- **Coordinator:** creates matches and enters scores and match events.
- **Player:** registers for eligible events and views personal matches.
- **Viewer:** reads public tournament information.

## 4. Candidate entities

The initial blueprint contains these 17 entities:

1. `department` — department or hostel represented by a team
2. `student` — person who may play
3. `sport` — cricket, football, 100m, and similar sports
4. `tournament` — one edition of a competition
5. `event` — a sport within a tournament, such as men's football
6. `eligibility_rule` — year, gender, and age constraints for an event
7. `team` — team entered by a department
8. `registration` — a student or team entering an event
9. `team_member` — student membership in a team squad
10. `stage` — group, quarter-final, semi-final, final, or heat
11. `venue` — ground, court, track, or other location
12. `match` — scheduled team match between two teams
13. `match_event` — an event during a match
14. `official` — referee, umpire, or other assigned official
15. `individual_result` — an athletics heat entry and result
16. `award` — medal, player award, or department trophy
17. `app_user` — login account and role

## 5. Core business rules

1. A department can have many students and teams; each student belongs to one department.
2. A sport is either team-based or individual-based.
3. A tournament contains many events; an event belongs to one tournament and one sport.
4. An event has a gender/category and competition format.
5. An event can have eligibility rules for academic year, gender, and age.
6. A team represents one department and has a student captain.
7. A student can belong to many teams over time, but a team squad must not duplicate a student.
8. A registration is for either one student or one team, not both, and belongs to one event.
9. A registration must be accepted only when it satisfies the event's eligibility rule.
10. A stage belongs to one event and has an ordered stage type.
11. A match belongs to a stage, uses one venue, has two distinct teams, and may have one official.
12. Matches at the same venue must not overlap in time.
13. A match event belongs to one match and may identify the student and team involved.
14. A completed final match cannot be edited.
15. Team standings are computed from match results rather than stored separately.
16. Goal events update the associated match score through database logic.
17. Athletics results connect an individual registration to a heat/stage and venue, with a time or distance and `result_rank`.
18. Awards belong to an event and identify an awarded student or team as appropriate.
19. An app user may optionally link to a student and has one controlled role.
20. Database constraints and logic enforce data integrity; the future app does not duplicate business rules.

## 6. Assumptions to validate

- A department and a hostel are represented by the same `department` entity, distinguished by a type/name field.
- A registration uses two nullable foreign keys (`student_id` and `team_id`) plus a `CHECK` that exactly one is filled; team events use teams and individual events use students. This avoids an invalid foreign key to two different tables.
- Match scores are stored on `match` because the points view needs a stable result, while event-level scoring remains auditable in `match_event`.
- A match's start time and duration are sufficient to detect venue overlap.
- One official assignment model will use two nullable foreign keys (one to a match and one to an athletics heat/result) plus a `CHECK` that exactly one is filled. This avoids an invalid foreign key to two different tables.
- Match scores stored on `match` alongside auditable `match_event` rows are deliberate redundancy and will be synchronized by a database trigger.
- The exact score format for sports other than football/cricket will be finalized during ER and normalization design.
- The group will provide member names and speaking assignments before the presentation outline is finalized.

## 7. Later acceptance criteria

- All 17 blueprint tables, or an approved documented adjustment, are represented in the final schema.
- All tables are in 3NF or BCNF, or a deliberate exception is documented.
- Database views, triggers, functions, and procedures enforce the listed rules.
- Every SQL file runs in order on a clean MySQL 8.0 instance with zero errors.
- Seed data contains at least 6 departments, 8 teams, 40 players, 30 matches, and 2 athletics events.
- Every trigger has passing and failing demonstrations in the query set.
- The final README enables a lab examiner to run the project quickly.
