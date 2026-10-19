-- Campus Sports Tournament Management System
-- Phase 6: read-only views over stored facts and derived standings.

USE campus_sports;

DROP VIEW IF EXISTS v_match_schedule;
DROP VIEW IF EXISTS v_medal_tally;
DROP VIEW IF EXISTS v_points_table;

CREATE VIEW v_points_table AS
WITH stage_teams AS (
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, m.home_team_id AS team_id
    FROM stage s
    JOIN `match` m ON m.stage_id = s.stage_id
    WHERE s.stage_type = 'group'
    UNION
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, m.away_team_id AS team_id
    FROM stage s
    JOIN `match` m ON m.stage_id = s.stage_id
    WHERE s.stage_type = 'group'
    UNION
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, r.team_id
    FROM stage s
    JOIN registration r ON r.event_id = s.event_id
    WHERE s.stage_type = 'group'
      AND r.team_id IS NOT NULL
      AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM `match` m WHERE m.stage_id = s.stage_id)
),
team_results AS (
    SELECT
        s.event_id,
        m.stage_id,
        m.home_team_id AS team_id,
        m.home_score AS goals_for,
        m.away_score AS goals_against,
        CASE
            WHEN m.home_score > m.away_score THEN 3
            WHEN m.home_score = m.away_score THEN 1
            ELSE 0
        END AS points,
        CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS losses
    FROM `match` AS m
    JOIN stage AS s ON s.stage_id = m.stage_id
    WHERE s.stage_type = 'group' AND m.status = 'completed'
    UNION ALL
    SELECT
        s.event_id,
        m.stage_id,
        m.away_team_id AS team_id,
        m.away_score AS goals_for,
        m.home_score AS goals_against,
        CASE
            WHEN m.away_score > m.home_score THEN 3
            WHEN m.away_score = m.home_score THEN 1
            ELSE 0
        END AS points,
        CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS losses
    FROM `match` AS m
    JOIN stage AS s ON s.stage_id = m.stage_id
    WHERE s.stage_type = 'group' AND m.status = 'completed'
),
aggregated AS (
    SELECT
        st.event_id,
        st.stage_id,
        st.group_name,
        st.team_id,
        COUNT(tr.team_id) AS played,
        COALESCE(SUM(tr.wins), 0) AS won,
        COALESCE(SUM(tr.draws), 0) AS drawn,
        COALESCE(SUM(tr.losses), 0) AS lost,
        COALESCE(SUM(tr.goals_for), 0) AS goals_for,
        COALESCE(SUM(tr.goals_against), 0) AS goals_against,
        COALESCE(SUM(
            CAST(tr.goals_for AS SIGNED) - CAST(tr.goals_against AS SIGNED)
        ), 0) AS goal_difference,
        COALESCE(SUM(tr.points), 0) AS points
    FROM stage_teams st
    LEFT JOIN team_results tr
      ON tr.stage_id = st.stage_id AND tr.team_id = st.team_id
    GROUP BY st.event_id, st.stage_id, st.group_name, st.team_id
)
SELECT
    aggregated.event_id,
    aggregated.stage_id,
    aggregated.group_name,
    e.name AS event_name,
    sp.name AS sport_name,
    aggregated.team_id,
    team.name AS team_name,
    aggregated.played,
    aggregated.won,
    aggregated.drawn,
    aggregated.lost,
    aggregated.goals_for,
    aggregated.goals_against,
    aggregated.goal_difference,
    aggregated.points,
    DENSE_RANK() OVER (
        PARTITION BY aggregated.event_id, aggregated.stage_id
        ORDER BY points DESC, goal_difference DESC, goals_for DESC, team_id
    ) AS points_position
FROM aggregated
JOIN team ON team.team_id = aggregated.team_id
JOIN `event` AS e ON e.event_id = aggregated.event_id
JOIN sport AS sp ON sp.sport_id = e.sport_id;

CREATE VIEW v_medal_tally AS
WITH award_departments AS (
    SELECT
        d.department_id,
        d.name AS department_name,
        a.award_type
    FROM award AS a
    JOIN team AS t ON t.team_id = a.team_id
    JOIN department AS d ON d.department_id = t.department_id
    UNION ALL
    SELECT
        d.department_id,
        d.name AS department_name,
        a.award_type
    FROM award AS a
    JOIN student AS s ON s.student_id = a.student_id
    JOIN department AS d ON d.department_id = s.department_id
)
SELECT
    department_id,
    department_name,
    SUM(award_type = 'gold') AS gold,
    SUM(award_type = 'silver') AS silver,
    SUM(award_type = 'bronze') AS bronze,
    COUNT(*) AS total_awards
FROM award_departments
GROUP BY department_id, department_name;

CREATE VIEW v_match_schedule AS
SELECT
    m.match_id,
    e.event_id,
    e.name AS event_name,
    s.name AS stage_name,
    m.starts_at,
    m.duration_minutes,
    m.status,
    home.name AS home_team,
    away.name AS away_team,
    v.name AS venue_name,
    o.full_name AS official_name,
    o.role AS official_role
FROM `match` AS m
JOIN stage AS s ON s.stage_id = m.stage_id
JOIN `event` AS e ON e.event_id = s.event_id
JOIN team AS home ON home.team_id = m.home_team_id
JOIN team AS away ON away.team_id = m.away_team_id
JOIN venue AS v ON v.venue_id = m.venue_id
LEFT JOIN official AS o ON o.match_id = m.match_id
WHERE m.status IN ('scheduled', 'live');

