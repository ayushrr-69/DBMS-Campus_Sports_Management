-- Campus Sports Tournament Management System
-- Phase 6: integrity and derived-value triggers.

USE campus_sports;

DROP TRIGGER IF EXISTS trg_check_eligibility_insert;
DROP TRIGGER IF EXISTS trg_check_eligibility_update;
DROP TRIGGER IF EXISTS trg_venue_clash_insert;
DROP TRIGGER IF EXISTS trg_venue_clash_update;
DROP TRIGGER IF EXISTS trg_update_score;
DROP TRIGGER IF EXISTS trg_lock_final_match;

DELIMITER $$

CREATE TRIGGER trg_check_eligibility_insert
BEFORE INSERT ON registration
FOR EACH ROW
BEGIN
    DECLARE v_event_gender VARCHAR(10);
    DECLARE v_rule_gender VARCHAR(10);
    DECLARE v_min_year TINYINT UNSIGNED;
    DECLARE v_max_year TINYINT UNSIGNED;
    DECLARE v_min_age TINYINT UNSIGNED;
    DECLARE v_max_age TINYINT UNSIGNED;
    DECLARE v_student_gender VARCHAR(10);
    DECLARE v_academic_year TINYINT UNSIGNED;
    DECLARE v_age TINYINT UNSIGNED;

    IF NEW.student_id IS NOT NULL THEN
        SELECT e.gender_category, er.gender, er.min_year, er.max_year,
               er.min_age, er.max_age,
               s.gender, s.academic_year,
               TIMESTAMPDIFF(YEAR, s.date_of_birth, CURRENT_DATE)
        INTO v_event_gender, v_rule_gender, v_min_year, v_max_year,
             v_min_age, v_max_age,
             v_student_gender, v_academic_year, v_age
        FROM `event` AS e
        LEFT JOIN eligibility_rule AS er ON er.event_id = e.event_id
        JOIN student AS s ON s.student_id = NEW.student_id
        WHERE e.event_id = NEW.event_id;

        IF v_rule_gender IS NOT NULL
           AND v_rule_gender <> 'any'
           AND v_rule_gender <> v_student_gender THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Student gender does not satisfy event eligibility';
        END IF;
        IF v_min_year IS NOT NULL AND v_academic_year < v_min_year
           OR v_max_year IS NOT NULL AND v_academic_year > v_max_year THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Student academic year does not satisfy event eligibility';
        END IF;
        IF v_min_age IS NOT NULL AND v_age < v_min_age
           OR v_max_age IS NOT NULL AND v_age > v_max_age THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Student age does not satisfy event eligibility';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_check_eligibility_update
BEFORE UPDATE ON registration
FOR EACH ROW
BEGIN
    IF NEW.event_id <> OLD.event_id OR NOT (NEW.student_id <=> OLD.student_id) THEN
        IF NEW.student_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM `event` AS e
                JOIN student AS s ON s.student_id = NEW.student_id
                LEFT JOIN eligibility_rule AS er ON er.event_id = e.event_id
                WHERE e.event_id = NEW.event_id
                  AND er.gender IS NOT NULL
                  AND er.gender <> 'any'
                  AND er.gender <> s.gender
            ) THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Updated student fails event gender eligibility';
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_venue_clash_insert
BEFORE INSERT ON `match`
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1
        FROM `match` AS existing_match
        WHERE existing_match.venue_id = NEW.venue_id
          AND existing_match.starts_at < DATE_ADD(
              NEW.starts_at, INTERVAL NEW.duration_minutes MINUTE)
          AND DATE_ADD(
              existing_match.starts_at,
              INTERVAL existing_match.duration_minutes MINUTE) > NEW.starts_at
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Venue is already occupied during this match time';
    END IF;
END$$

CREATE TRIGGER trg_venue_clash_update
BEFORE UPDATE ON `match`
FOR EACH ROW
BEGIN
    IF NOT (NEW.venue_id <=> OLD.venue_id)
       OR NOT (NEW.starts_at <=> OLD.starts_at)
       OR NOT (NEW.duration_minutes <=> OLD.duration_minutes) THEN
      IF EXISTS (
        SELECT 1
        FROM `match` AS existing_match
        WHERE existing_match.match_id <> OLD.match_id
          AND existing_match.venue_id = NEW.venue_id
          AND existing_match.starts_at < DATE_ADD(
              NEW.starts_at, INTERVAL NEW.duration_minutes MINUTE)
          AND DATE_ADD(
              existing_match.starts_at,
              INTERVAL existing_match.duration_minutes MINUTE) > NEW.starts_at
      ) THEN
          SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'Venue is already occupied during this match time';
      END IF;
    END IF;
END$$

CREATE TRIGGER trg_update_score
AFTER INSERT ON match_event
FOR EACH ROW
BEGIN
    IF NEW.event_type = 'goal' THEN
        IF NEW.team_id IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A goal event must identify its scoring team';
        ELSEIF NEW.team_id = (SELECT home_team_id FROM `match` WHERE match_id = NEW.match_id) THEN
            UPDATE `match`
            SET home_score = home_score + 1
            WHERE match_id = NEW.match_id;
        ELSEIF NEW.team_id = (SELECT away_team_id FROM `match` WHERE match_id = NEW.match_id) THEN
            UPDATE `match`
            SET away_score = away_score + 1
            WHERE match_id = NEW.match_id;
        ELSE
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Goal team must be one of the match teams';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_lock_final_match
BEFORE UPDATE ON `match`
FOR EACH ROW
BEGIN
    IF OLD.status = 'completed'
       AND (
           NOT (NEW.stage_id <=> OLD.stage_id)
           OR NOT (NEW.venue_id <=> OLD.venue_id)
           OR NOT (NEW.home_team_id <=> OLD.home_team_id)
           OR NOT (NEW.away_team_id <=> OLD.away_team_id)
           OR NOT (NEW.starts_at <=> OLD.starts_at)
           OR NOT (NEW.duration_minutes <=> OLD.duration_minutes)
           OR NOT (NEW.home_score <=> OLD.home_score)
           OR NOT (NEW.away_score <=> OLD.away_score)
           OR NOT (NEW.status <=> OLD.status)
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Completed matches cannot be edited';
    END IF;
END$$

DELIMITER ;
