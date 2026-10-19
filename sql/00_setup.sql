-- Run this file in MySQL Workbench as root.
-- Replace CHANGE_ME_WITH_A_LOCAL_PASSWORD before running.
-- Do not commit a real password.

CREATE DATABASE IF NOT EXISTS campus_sports
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'campus_dev'@'localhost'
    IDENTIFIED BY 'CHANGE_ME_WITH_A_LOCAL_PASSWORD';

ALTER USER 'campus_dev'@'localhost'
    IDENTIFIED BY 'CHANGE_ME_WITH_A_LOCAL_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE
    ON campus_sports.* TO 'campus_dev'@'localhost';

FLUSH PRIVILEGES;

USE campus_sports;

SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'campus_sports';

SHOW GRANTS FOR 'campus_dev'@'localhost';
