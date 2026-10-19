-- Campus Sports Tournament Management System
-- Phase 6: reusable database routines.

USE campus_sports;

DELIMITER $$

CREATE FUNCTION IF NOT EXISTS fn_team_points(
    p_event_id INT UNSIGNED,
    p_team_id INT UNSIGNED
)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_points INT DEFAULT 0;

    SELECT COALESCE(SUM(
        CASE
            WHEN (m.home_team_id = p_team_id AND m.home_score > m.away_score)
              OR (m.away_team_id = p_team_id AND m.away_score > m.home_score)
                THEN 3
            WHEN m.home_score = m.away_score THEN 1
            ELSE 0
        END
    ), 0)
    INTO v_points
    FROM `match` AS m
    JOIN stage AS s ON s.stage_id = m.stage_id
    WHERE s.event_id = p_event_id
      AND m.status = 'completed'
      AND (m.home_team_id = p_team_id OR m.away_team_id = p_team_id);

    RETURN v_points;
END$$

DROP PROCEDURE IF EXISTS sp_generate_group_fixtures;

CREATE PROCEDURE sp_generate_group_fixtures(
    IN p_stage_id INT UNSIGNED,
    IN p_venue_id INT UNSIGNED,
    IN p_start_at DATETIME
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_i INT DEFAULT 1;
    DECLARE v_j INT DEFAULT 2;
    DECLARE v_match_no INT DEFAULT 0;
    DECLARE v_home_team_id INT UNSIGNED;
    DECLARE v_away_team_id INT UNSIGNED;
    DECLARE v_start_at DATETIME;
    DECLARE v_is_team_sport BOOLEAN DEFAULT FALSE;

    SELECT sp.is_team_sport INTO v_is_team_sport
    FROM stage AS st
    JOIN `event` AS e ON e.event_id = st.event_id
    JOIN sport AS sp ON sp.sport_id = e.sport_id
    WHERE st.stage_id = p_stage_id
    LIMIT 1;

    IF COALESCE(v_is_team_sport, FALSE) = FALSE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Individual events use heats and individual results, not team fixtures';
    END IF;

    IF EXISTS (SELECT 1 FROM `match` WHERE stage_id = p_stage_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Matches have already been generated for this stage';
    END IF;

    CREATE TEMPORARY TABLE fixture_teams (
        sequence_no INT PRIMARY KEY,
        team_id INT UNSIGNED NOT NULL
    ) ENGINE = MEMORY;

    INSERT INTO fixture_teams (sequence_no, team_id)
    SELECT
        ROW_NUMBER() OVER (ORDER BY r.team_id),
        r.team_id
    FROM registration AS r
    JOIN stage AS s ON s.event_id = r.event_id
    WHERE s.stage_id = p_stage_id
      AND r.team_id IS NOT NULL
      AND r.status = 'approved'
    GROUP BY r.team_id;

    SELECT COUNT(*) INTO v_count FROM fixture_teams;

    IF v_count < 2 THEN
        DROP TEMPORARY TABLE fixture_teams;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'At least 2 approved teams must be registered for this event to generate fixtures';
    END IF;

    WHILE v_i <= v_count DO
        SET v_j = v_i + 1;
        WHILE v_j <= v_count DO
            SELECT team_id INTO v_home_team_id
            FROM fixture_teams WHERE sequence_no = v_i;
            SELECT team_id INTO v_away_team_id
            FROM fixture_teams WHERE sequence_no = v_j;
            SET v_start_at = TIMESTAMPADD(HOUR, v_match_no * 2, p_start_at);

            INSERT INTO `match`
                (stage_id, venue_id, home_team_id, away_team_id, starts_at,
                 duration_minutes, status)
            VALUES
                (p_stage_id, p_venue_id, v_home_team_id, v_away_team_id,
                 v_start_at, 90, 'scheduled');

            SET v_match_no = v_match_no + 1;
            SET v_j = v_j + 1;
        END WHILE;
        SET v_i = v_i + 1;
    END WHILE;

    DROP TEMPORARY TABLE fixture_teams;
END$$

CREATE PROCEDURE IF NOT EXISTS sp_advance_knockout(
    IN p_source_stage_id INT UNSIGNED,
    IN p_target_stage_id INT UNSIGNED,
    IN p_venue_id INT UNSIGNED,
    IN p_start_at DATETIME
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_i INT DEFAULT 1;
    DECLARE v_match_no INT DEFAULT 0;
    DECLARE v_home_team_id INT UNSIGNED;
    DECLARE v_away_team_id INT UNSIGNED;

    CREATE TEMPORARY TABLE stage_winners (
        sequence_no INT PRIMARY KEY,
        team_id INT UNSIGNED NOT NULL
    ) ENGINE = MEMORY;

    INSERT INTO stage_winners (sequence_no, team_id)
    SELECT
        ROW_NUMBER() OVER (ORDER BY group_name),
        team_id
    FROM (
        SELECT
            group_name,
            team_id,
            ROW_NUMBER() OVER (
                PARTITION BY group_name
                ORDER BY points DESC, goal_difference DESC, goals_for DESC, team_id
            ) AS group_position
        FROM v_points_table
        WHERE stage_id = p_source_stage_id
    ) AS ranked_groups
    WHERE group_position = 1;

    SELECT COUNT(*) INTO v_count FROM stage_winners;

    WHILE v_i < v_count DO
        SELECT team_id INTO v_home_team_id
        FROM stage_winners WHERE sequence_no = v_i;
        SELECT team_id INTO v_away_team_id
        FROM stage_winners WHERE sequence_no = v_i + 1;

        INSERT INTO `match`
            (stage_id, venue_id, home_team_id, away_team_id, starts_at,
             duration_minutes, status)
        VALUES
            (p_target_stage_id, p_venue_id, v_home_team_id, v_away_team_id,
             TIMESTAMPADD(HOUR, v_match_no * 2, p_start_at), 90, 'scheduled');

        SET v_match_no = v_match_no + 1;
        SET v_i = v_i + 2;
    END WHILE;

    DROP TEMPORARY TABLE stage_winners;
END$$

CREATE PROCEDURE IF NOT EXISTS sp_assign_awards(
    IN p_event_id INT UNSIGNED,
    IN p_final_stage_id INT UNSIGNED,
    IN p_awarded_at DATE
)
MODIFIES SQL DATA
BEGIN
    DELETE FROM award
    WHERE event_id = p_event_id
      AND award_type IN ('gold', 'silver');

    INSERT INTO award
        (event_id, team_id, award_type, award_rank, awarded_at)
    SELECT
        p_event_id,
        CASE WHEN m.home_score > m.away_score
             THEN m.home_team_id ELSE m.away_team_id END,
        'gold',
        1,
        p_awarded_at
    FROM `match` AS m
    WHERE m.stage_id = p_final_stage_id
      AND m.status = 'completed'
      AND m.home_score <> m.away_score
    ORDER BY m.match_id
    LIMIT 1;

    INSERT INTO award
        (event_id, team_id, award_type, award_rank, awarded_at)
    SELECT
        p_event_id,
        CASE WHEN m.home_score > m.away_score
             THEN m.away_team_id ELSE m.home_team_id END,
        'silver',
        2,
        p_awarded_at
    FROM `match` AS m
    WHERE m.stage_id = p_final_stage_id
      AND m.status = 'completed'
      AND m.home_score <> m.away_score
    ORDER BY m.match_id
    LIMIT 1;
END$$

DELIMITER ;
