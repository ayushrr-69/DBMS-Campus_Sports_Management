# Relational Algebra Companion

These examples use the relations created by the schema. `σ` selects rows, `π` projects columns, `⋈` joins, `∪` is union, and `−` is set difference.

## 1. Students with departments

SQL:

```sql
SELECT s.full_name, d.name
FROM student AS s
JOIN department AS d ON d.department_id = s.department_id;
```

Relational algebra:

`π full_name, department.name (student ⋈ student.department_id = department.department_id department)`

## 2. Teams with at least one registered football entry

SQL:

```sql
SELECT DISTINCT t.name
FROM team AS t
JOIN registration AS r ON r.team_id = t.team_id
JOIN event AS e ON e.event_id = r.event_id
WHERE e.name = 'Men Football';
```

Relational algebra:

`π team.name (σ event.name = 'Men Football' (team ⋈ team.team_id = registration.team_id registration ⋈ registration.event_id = event.event_id event))`

## 3. Goal scorers

SQL:

```sql
SELECT DISTINCT student_id
FROM match_event
WHERE event_type = 'goal';
```

Relational algebra:

`π student_id (σ event_type = 'goal' (match_event))`

## 4. Students not registered for athletics

SQL:

```sql
SELECT s.student_id
FROM student AS s
WHERE NOT EXISTS (
    SELECT 1
    FROM registration AS r
    JOIN event AS e ON e.event_id = r.event_id
    JOIN sport AS sp ON sp.sport_id = e.sport_id
    WHERE r.student_id = s.student_id AND sp.is_team_sport = FALSE
);
```

Relational algebra:

`π student_id(student) − π student_id(σ sport.is_team_sport = FALSE (student ⋈ registration ⋈ event ⋈ sport))`

## 5. Football match teams

SQL:

```sql
SELECT home_team_id AS team_id FROM match
UNION
SELECT away_team_id AS team_id FROM match;
```

Relational algebra:

`π home_team_id(match) ∪ ρ team_id←away_team_id(π away_team_id(match))`

## 6. Completed matches with a score

SQL:

```sql
SELECT match_id
FROM match
WHERE status = 'completed' AND (home_score > 0 OR away_score > 0);
```

Relational algebra:

`π match_id(σ status = 'completed' ∧ (home_score > 0 ∨ away_score > 0)(match))`
