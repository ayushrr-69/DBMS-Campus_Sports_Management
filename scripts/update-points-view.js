const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DEV_DB_USER || 'campus_dev',
    password: process.env.DEV_DB_PASSWORD || process.env.APP_DB_PASSWORD
  });

  const sql = `
CREATE OR REPLACE VIEW v_points_table AS
WITH stage_teams AS (
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, m.home_team_id AS team_id
    FROM stage s
    JOIN \`match\` m ON m.stage_id = s.stage_id
    WHERE s.stage_type = 'group'
    UNION
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, m.away_team_id AS team_id
    FROM stage s
    JOIN \`match\` m ON m.stage_id = s.stage_id
    WHERE s.stage_type = 'group'
    UNION
    SELECT DISTINCT s.event_id, s.stage_id, s.name AS group_name, r.team_id
    FROM stage s
    JOIN registration r ON r.event_id = s.event_id
    WHERE s.stage_type = 'group'
      AND r.team_id IS NOT NULL
      AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM \`match\` m WHERE m.stage_id = s.stage_id)
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
    FROM \`match\` AS m
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
    FROM \`match\` AS m
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
JOIN \`event\` AS e ON e.event_id = aggregated.event_id
JOIN sport AS sp ON sp.sport_id = e.sport_id;
  `;

  await conn.query(sql);
  console.log('v_points_table updated successfully in MySQL!');

  const [rows] = await conn.query('SELECT * FROM v_points_table WHERE sport_name = ?', ['Hockey']);
  console.log('Hockey points rows:', rows);

  const [distinctEvents] = await conn.query('SELECT DISTINCT event_id, event_name, sport_name, group_name FROM v_points_table');
  console.log('Distinct groups in v_points_table:', distinctEvents);

  await conn.end();
}

main().catch(console.error);
