-- Campus Sports Tournament Management System
-- Phase 6: named query set for demonstrations.

USE campus_sports;

-- Q01: list tournament events
SELECT e.event_id, e.name AS event_name, s.name AS sport_name, e.format
FROM `event` AS e
JOIN sport AS s ON s.sport_id = e.sport_id
ORDER BY e.event_id;

-- Q02: upcoming schedule
SELECT *
FROM v_match_schedule
ORDER BY starts_at, match_id;

-- Q03: all students with their department
SELECT s.roll_number, s.full_name, d.name AS department_name
FROM student AS s
JOIN department AS d ON d.department_id = s.department_id
ORDER BY d.name, s.full_name;

-- Q04: teams and squad sizes
SELECT t.team_id, t.name, COUNT(tm.student_id) AS squad_size
FROM team AS t
LEFT JOIN team_member AS tm ON tm.team_id = t.team_id
GROUP BY t.team_id, t.name
ORDER BY squad_size DESC, t.name;

-- Q05: departments with at least five students
SELECT d.name, COUNT(s.student_id) AS student_count
FROM department AS d
JOIN student AS s ON s.department_id = d.department_id
GROUP BY d.department_id, d.name
HAVING COUNT(s.student_id) >= 5
ORDER BY student_count DESC;

-- Q06: teams that have registered for football
SELECT t.name
FROM team AS t
WHERE EXISTS (
    SELECT 1
    FROM registration AS r
    JOIN `event` AS e ON e.event_id = r.event_id
    WHERE r.team_id = t.team_id AND e.name = 'Men Football'
);

-- Q07: students not registered for an athletics event
SELECT s.student_id, s.full_name
FROM student AS s
WHERE NOT EXISTS (
    SELECT 1
    FROM registration AS r
    JOIN sport AS sp ON sp.sport_id = (
        SELECT e.sport_id FROM `event` AS e WHERE e.event_id = r.event_id
    )
    WHERE r.student_id = s.student_id AND sp.is_team_sport = FALSE
)
ORDER BY s.student_id;

-- Q08: union of football captains and athletics entrants
SELECT s.student_id, s.full_name, 'captain' AS participation_type
FROM student AS s
JOIN team AS t ON t.captain_id = s.student_id
UNION
SELECT s.student_id, s.full_name, 'athletics entrant'
FROM student AS s
JOIN registration AS r ON r.student_id = s.student_id
JOIN `event` AS e ON e.event_id = r.event_id
JOIN sport AS sp ON sp.sport_id = e.sport_id
WHERE sp.is_team_sport = FALSE;

-- Q09: points table with window position
SELECT *
FROM v_points_table
ORDER BY event_id, stage_id, points_position, team_name;

-- Q10: teams above three points in the football groups
SELECT team_name, points, goal_difference
FROM v_points_table
WHERE points > 3
ORDER BY points DESC, goal_difference DESC;

-- Q11: medal tally
SELECT *
FROM v_medal_tally
ORDER BY gold DESC, silver DESC, bronze DESC, department_name;

-- Q12: athletics results ordered by result
SELECT e.name AS event_name, s.full_name, ir.result_value, ir.result_unit, ir.result_rank
FROM individual_result AS ir
JOIN registration AS r ON r.registration_id = ir.registration_id
JOIN student AS s ON s.student_id = r.student_id
JOIN `event` AS e ON e.event_id = r.event_id
ORDER BY e.name, ir.result_rank;

-- Q14: completed matches and score margin
SELECT m.match_id, home.name AS home_team, away.name AS away_team,
       m.home_score, m.away_score,
       ABS(
           CAST(m.home_score AS SIGNED) - CAST(m.away_score AS SIGNED)
       ) AS score_margin
FROM `match` AS m
JOIN team AS home ON home.team_id = m.home_team_id
JOIN team AS away ON away.team_id = m.away_team_id
WHERE m.status = 'completed'
ORDER BY score_margin DESC, m.match_id;

-- Q15: students who scored a goal
SELECT DISTINCT s.full_name, d.name AS department_name
FROM match_event AS me
JOIN student AS s ON s.student_id = me.student_id
JOIN department AS d ON d.department_id = s.department_id
WHERE me.event_type = 'goal'
ORDER BY s.full_name;

-- Q16: routine result for one team
SELECT fn_team_points(1, 1) AS cse_strikers_points;

-- Q17: officials assigned to matches
SELECT o.full_name, o.role, COUNT(o.match_id) AS matches_officiated
FROM official AS o
WHERE o.match_id IS NOT NULL
GROUP BY o.official_id, o.full_name, o.role
ORDER BY matches_officiated DESC, o.full_name;

-- Q18: registrations by event and status
SELECT e.name AS event_name, r.status, COUNT(*) AS registration_count
FROM registration AS r
JOIN `event` AS e ON e.event_id = r.event_id
GROUP BY e.event_id, e.name, r.status
ORDER BY e.name, r.status;

-- Trigger passing demos:
-- 1. Insert a goal on a live/scheduled match with a valid participating team;
--    then query the match score to see it increment.
-- 2. Insert a match at a free venue/time; the insert should succeed.
-- 3. Insert an eligible student registration; the insert should succeed.

-- Trigger failing demos (run individually and expect an error):
-- INSERT INTO registration (event_id, student_id, team_id)
-- VALUES (2, 6, 1); -- exactly-one entrant CHECK fails.
-- INSERT INTO `match`
--   (stage_id, venue_id, home_team_id, away_team_id, starts_at, duration_minutes)
-- VALUES (1, 1, 1, 2, '2026-11-01 09:30:00', 90); -- venue clash.
-- UPDATE `match` SET home_score = home_score + 1 WHERE match_id = 1; -- completed lock.
-- INSERT INTO match_event (match_id, student_id, team_id, event_type, minute)
-- VALUES (1, 1, 5, 'goal', 10); -- team is not in the match.
