-- Campus Sports Tournament Management System
-- Phase 6: ACID transaction demonstrations.

USE campus_sports;

-- Atomicity and durability: save a new match and its first goal together.
START TRANSACTION;

INSERT INTO `match`
    (stage_id, venue_id, home_team_id, away_team_id, starts_at,
     duration_minutes, status)
VALUES
    (1, 4, 1, 2, '2026-11-14 09:00:00', 90, 'live');

SET @transaction_match_id = LAST_INSERT_ID();

INSERT INTO match_event
    (match_id, student_id, team_id, event_type, minute, details)
VALUES
    (@transaction_match_id, 1, 1, 'goal', 15, 'Transaction demo goal');

COMMIT;

SELECT match_id, home_score, away_score
FROM `match`
WHERE match_id = @transaction_match_id;

-- Isolation and rollback: a registration status change is discarded as one unit.
START TRANSACTION;

UPDATE registration
SET status = 'withdrawn'
WHERE registration_id = 9;

ROLLBACK;

SELECT status AS status_after_rollback
FROM registration
WHERE registration_id = 9;

-- ACID mapping:
-- Atomicity: match plus its match_event commit together.
-- Consistency: CHECKs, foreign keys, and triggers validate both inserts.
-- Isolation: each START TRANSACTION keeps intermediate work private.
-- Durability: the committed match remains queryable after COMMIT.
