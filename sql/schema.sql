-- Campus Sports Tournament Management System
-- Phase 4: relational schema for MySQL 8.0+

USE campus_sports;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `app_user`;
DROP TABLE IF EXISTS `award`;
DROP TABLE IF EXISTS `official`;
DROP TABLE IF EXISTS `individual_result`;
DROP TABLE IF EXISTS `match_event`;
DROP TABLE IF EXISTS `match`;
DROP TABLE IF EXISTS `sport_venue`;
DROP TABLE IF EXISTS `venue`;
DROP TABLE IF EXISTS `stage`;
DROP TABLE IF EXISTS `team_member`;
DROP TABLE IF EXISTS `registration`;
DROP TABLE IF EXISTS `team`;
DROP TABLE IF EXISTS `eligibility_rule`;
DROP TABLE IF EXISTS `event`;
DROP TABLE IF EXISTS `tournament`;
DROP TABLE IF EXISTS `sport`;
DROP TABLE IF EXISTS `student`;
DROP TABLE IF EXISTS `department`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE department (
    department_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_type ENUM('department', 'hostel') NOT NULL,
    CONSTRAINT uq_department_name UNIQUE (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE student (
    student_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department_id INT UNSIGNED NOT NULL,
    roll_number VARCHAR(30) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    academic_year TINYINT UNSIGNED NOT NULL,
    date_of_birth DATE NOT NULL,
    CONSTRAINT uq_student_roll_number UNIQUE (roll_number),
    CONSTRAINT ck_student_academic_year CHECK (academic_year BETWEEN 1 AND 6),
    CONSTRAINT fk_student_department FOREIGN KEY (department_id)
        REFERENCES department (department_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE sport (
    sport_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    is_team_sport BOOLEAN NOT NULL,
    CONSTRAINT uq_sport_name UNIQUE (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE tournament (
    tournament_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CONSTRAINT ck_tournament_dates CHECK (end_date >= start_date),
    CONSTRAINT uq_tournament_name_start UNIQUE (name, start_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE `event` (
    event_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    sport_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    gender_category ENUM('men', 'women', 'mixed', 'open') NOT NULL,
    format ENUM('group_knockout', 'knockout', 'heats') NOT NULL,
    CONSTRAINT uq_event_name_tournament UNIQUE (tournament_id, name),
    CONSTRAINT fk_event_tournament FOREIGN KEY (tournament_id)
        REFERENCES tournament (tournament_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_event_sport FOREIGN KEY (sport_id)
        REFERENCES sport (sport_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE eligibility_rule (
    eligibility_rule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    min_year TINYINT UNSIGNED NULL,
    max_year TINYINT UNSIGNED NULL,
    gender ENUM('male', 'female', 'other', 'any') NOT NULL DEFAULT 'any',
    min_age TINYINT UNSIGNED NULL,
    max_age TINYINT UNSIGNED NULL,
    CONSTRAINT uq_eligibility_rule_event UNIQUE (event_id),
    CONSTRAINT ck_eligibility_years CHECK (
        (min_year IS NULL OR min_year BETWEEN 1 AND 6)
        AND (max_year IS NULL OR max_year BETWEEN 1 AND 6)
        AND (min_year IS NULL OR max_year IS NULL OR max_year >= min_year)
    ),
    CONSTRAINT ck_eligibility_ages CHECK (
        (min_age IS NULL OR min_age >= 0)
        AND (max_age IS NULL OR max_age >= 0)
        AND (min_age IS NULL OR max_age IS NULL OR max_age >= min_age)
    ),
    CONSTRAINT fk_eligibility_event FOREIGN KEY (event_id)
        REFERENCES `event` (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE team (
    team_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department_id INT UNSIGNED NOT NULL,
    captain_id INT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_team_department_name UNIQUE (department_id, name),
    CONSTRAINT fk_team_department FOREIGN KEY (department_id)
        REFERENCES department (department_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_team_captain FOREIGN KEY (captain_id)
        REFERENCES student (student_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE registration (
    registration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NULL,
    team_id INT UNSIGNED NULL,
    status ENUM('pending', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
    CONSTRAINT ck_registration_exactly_one_entrant CHECK (
        (student_id IS NOT NULL) <> (team_id IS NOT NULL)
    ),
    CONSTRAINT uq_registration_student_event UNIQUE (event_id, student_id),
    CONSTRAINT uq_registration_team_event UNIQUE (event_id, team_id),
    CONSTRAINT fk_registration_event FOREIGN KEY (event_id)
        REFERENCES `event` (event_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_registration_student FOREIGN KEY (student_id)
        REFERENCES student (student_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_registration_team FOREIGN KEY (team_id)
        REFERENCES team (team_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE team_member (
    team_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    jersey_number TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (team_id, student_id),
    CONSTRAINT uq_team_jersey UNIQUE (team_id, jersey_number),
    CONSTRAINT ck_team_member_jersey CHECK (jersey_number BETWEEN 0 AND 99),
    CONSTRAINT fk_team_member_team FOREIGN KEY (team_id)
        REFERENCES team (team_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_team_member_student FOREIGN KEY (student_id)
        REFERENCES student (student_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE stage (
    stage_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    stage_type ENUM('group', 'quarter_final', 'semi_final', 'final', 'heat') NOT NULL,
    stage_order SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    CONSTRAINT uq_stage_event_order UNIQUE (event_id, stage_order),
    CONSTRAINT uq_stage_event_name UNIQUE (event_id, name),
    CONSTRAINT ck_stage_order CHECK (stage_order > 0),
    CONSTRAINT fk_stage_event FOREIGN KEY (event_id)
        REFERENCES `event` (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE venue (
    venue_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    venue_type ENUM('ground', 'court', 'track', 'hall', 'other') NOT NULL,
    CONSTRAINT uq_venue_name UNIQUE (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE sport_venue (
    sport_id INT UNSIGNED NOT NULL,
    venue_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (sport_id, venue_id),
    CONSTRAINT fk_sport_venue_sport FOREIGN KEY (sport_id)
        REFERENCES sport (sport_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sport_venue_venue FOREIGN KEY (venue_id)
        REFERENCES venue (venue_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE `match` (
    match_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stage_id INT UNSIGNED NOT NULL,
    venue_id INT UNSIGNED NOT NULL,
    home_team_id INT UNSIGNED NOT NULL,
    away_team_id INT UNSIGNED NOT NULL,
    starts_at DATETIME NOT NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL,
    home_score SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    away_score SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('scheduled', 'live', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    CONSTRAINT ck_match_distinct_teams CHECK (home_team_id <> away_team_id),
    CONSTRAINT ck_match_duration CHECK (duration_minutes BETWEEN 1 AND 600),
    CONSTRAINT fk_match_stage FOREIGN KEY (stage_id)
        REFERENCES stage (stage_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_match_venue FOREIGN KEY (venue_id)
        REFERENCES venue (venue_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_match_home_team FOREIGN KEY (home_team_id)
        REFERENCES team (team_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_match_away_team FOREIGN KEY (away_team_id)
        REFERENCES team (team_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    INDEX ix_match_schedule (venue_id, starts_at),
    INDEX ix_match_stage_status (stage_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE match_event (
    match_event_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    match_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NULL,
    team_id INT UNSIGNED NULL,
    event_type ENUM('goal', 'wicket', 'foul', 'yellow_card', 'red_card', 'assist', 'other') NOT NULL,
    minute SMALLINT UNSIGNED NULL,
    details VARCHAR(255) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_match_event_minute CHECK (minute IS NULL OR minute BETWEEN 0 AND 600),
    CONSTRAINT fk_match_event_match FOREIGN KEY (match_id)
        REFERENCES `match` (match_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_match_event_student FOREIGN KEY (student_id)
        REFERENCES student (student_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_match_event_team FOREIGN KEY (team_id)
        REFERENCES team (team_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX ix_match_event_match_type (match_id, event_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE individual_result (
    individual_result_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id INT UNSIGNED NOT NULL,
    stage_id INT UNSIGNED NOT NULL,
    venue_id INT UNSIGNED NOT NULL,
    result_value DECIMAL(12, 3) NULL,
    result_unit ENUM('seconds', 'metres', 'points') NOT NULL,
    result_rank SMALLINT UNSIGNED NULL,
    CONSTRAINT uq_individual_result_registration_stage UNIQUE (registration_id, stage_id),
    CONSTRAINT ck_individual_result_value CHECK (result_value IS NULL OR result_value >= 0),
    CONSTRAINT ck_individual_result_rank CHECK (result_rank IS NULL OR result_rank > 0),
    CONSTRAINT fk_individual_result_registration FOREIGN KEY (registration_id)
        REFERENCES registration (registration_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_individual_result_stage FOREIGN KEY (stage_id)
        REFERENCES stage (stage_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_individual_result_venue FOREIGN KEY (venue_id)
        REFERENCES venue (venue_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE official (
    official_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    match_id INT UNSIGNED NULL,
    individual_result_id INT UNSIGNED NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(60) NOT NULL,
    CONSTRAINT ck_official_exactly_one_assignment CHECK (
        (match_id IS NOT NULL) <> (individual_result_id IS NOT NULL)
    ),
    CONSTRAINT fk_official_match FOREIGN KEY (match_id)
        REFERENCES `match` (match_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_official_individual_result FOREIGN KEY (individual_result_id)
        REFERENCES individual_result (individual_result_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE award (
    award_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NULL,
    team_id INT UNSIGNED NULL,
    award_type ENUM('gold', 'silver', 'bronze', 'player_of_tournament', 'department_trophy', 'other') NOT NULL,
    award_rank SMALLINT UNSIGNED NULL,
    awarded_at DATE NOT NULL,
    CONSTRAINT ck_award_exactly_one_recipient CHECK (
        (student_id IS NOT NULL) <> (team_id IS NOT NULL)
    ),
    CONSTRAINT ck_award_rank CHECK (award_rank IS NULL OR award_rank > 0),
    CONSTRAINT fk_award_event FOREIGN KEY (event_id)
        REFERENCES `event` (event_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_award_student FOREIGN KEY (student_id)
        REFERENCES student (student_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_award_team FOREIGN KEY (team_id)
        REFERENCES team (team_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE app_user (
    app_user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNSIGNED NULL,
    username VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'coordinator', 'player', 'viewer') NOT NULL,
    CONSTRAINT uq_app_user_username UNIQUE (username),
    CONSTRAINT uq_app_user_student UNIQUE (student_id),
    CONSTRAINT fk_app_user_student FOREIGN KEY (student_id)
        REFERENCES student (student_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
