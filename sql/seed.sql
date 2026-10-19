-- Campus Sports Tournament Management System
-- Phase 5: deterministic demonstration data.
-- Run after schema.sql on an empty campus_sports database.

USE campus_sports;

INSERT INTO department (department_id, name, department_type) VALUES
    (1, 'Computer Science', 'department'),
    (2, 'Mechanical Engineering', 'department'),
    (3, 'Electrical Engineering', 'department'),
    (4, 'Civil Engineering', 'department'),
    (5, 'Business Administration', 'department'),
    (6, 'North Hostel', 'hostel');

INSERT INTO student
    (student_id, department_id, roll_number, full_name, gender, academic_year, date_of_birth)
VALUES
    (1, 1, 'CS2023-001', 'Aarav Sharma', 'male', 3, '2004-05-11'),
    (2, 1, 'CS2023-002', 'Ishaan Verma', 'male', 3, '2004-07-19'),
    (3, 1, 'CS2023-003', 'Kabir Mehta', 'male', 3, '2004-02-14'),
    (4, 1, 'CS2023-004', 'Rohan Gupta', 'male', 3, '2004-09-01'),
    (5, 1, 'CS2023-005', 'Vivaan Rao', 'male', 3, '2004-11-23'),
    (6, 1, 'CS2024-006', 'Anaya Shah', 'female', 2, '2005-03-08'),
    (7, 1, 'CS2024-007', 'Diya Nair', 'female', 2, '2005-06-17'),
    (8, 2, 'ME2023-001', 'Aditya Singh', 'male', 3, '2004-01-28'),
    (9, 2, 'ME2023-002', 'Arjun Malhotra', 'male', 3, '2004-04-06'),
    (10, 2, 'ME2023-003', 'Dev Patel', 'male', 3, '2004-08-21'),
    (11, 2, 'ME2023-004', 'Karan Joshi', 'male', 3, '2004-12-03'),
    (12, 2, 'ME2023-005', 'Manav Bansal', 'male', 3, '2004-10-16'),
    (13, 2, 'ME2024-006', 'Meera Iyer', 'female', 2, '2005-02-27'),
    (14, 2, 'ME2024-007', 'Sara Khan', 'female', 2, '2005-05-30'),
    (15, 3, 'EE2023-001', 'Vihaan Kapoor', 'male', 3, '2004-03-12'),
    (16, 3, 'EE2023-002', 'Nikhil Sethi', 'male', 3, '2004-06-25'),
    (17, 3, 'EE2023-003', 'Yash Thakur', 'male', 3, '2004-09-18'),
    (18, 3, 'EE2023-004', 'Siddharth Jain', 'male', 3, '2004-11-09'),
    (19, 3, 'EE2023-005', 'Atharv Bose', 'male', 3, '2004-01-05'),
    (20, 3, 'EE2024-006', 'Tara Das', 'female', 2, '2005-04-22'),
    (21, 3, 'EE2024-007', 'Ira Sen', 'female', 2, '2005-07-13'),
    (22, 4, 'CE2023-001', 'Ayaan Kulkarni', 'male', 3, '2004-02-08'),
    (23, 4, 'CE2023-002', 'Harsh Vardhan', 'male', 3, '2004-05-26'),
    (24, 4, 'CE2023-003', 'Mohit Agarwal', 'male', 3, '2004-08-02'),
    (25, 4, 'CE2023-004', 'Pranav Mishra', 'male', 3, '2004-10-28'),
    (26, 4, 'CE2023-005', 'Sahil Yadav', 'male', 3, '2004-12-20'),
    (27, 4, 'CE2024-006', 'Riya Jain', 'female', 2, '2005-03-15'),
    (28, 4, 'CE2024-007', 'Nandini Roy', 'female', 2, '2005-06-04'),
    (29, 5, 'BA2023-001', 'Reyansh Das', 'male', 3, '2004-01-17'),
    (30, 5, 'BA2023-002', 'Shaurya Bose', 'male', 3, '2004-04-29'),
    (31, 5, 'BA2023-003', 'Akhil Menon', 'male', 3, '2004-07-07'),
    (32, 5, 'BA2023-004', 'Ritvik Paul', 'male', 3, '2004-09-24'),
    (33, 5, 'BA2023-005', 'Om Prakash', 'male', 3, '2004-11-14'),
    (34, 5, 'BA2024-006', 'Kiara Fernandes', 'female', 2, '2005-02-11'),
    (35, 5, 'BA2024-007', 'Myra Thomas', 'female', 2, '2005-08-05'),
    (36, 6, 'NH2023-001', 'Adit Chawla', 'male', 3, '2004-03-31'),
    (37, 6, 'NH2023-002', 'Neil Dutta', 'male', 3, '2004-06-09'),
    (38, 6, 'NH2023-003', 'Rudra Ghosh', 'male', 3, '2004-08-30'),
    (39, 6, 'NH2023-004', 'Samar Roy', 'male', 3, '2004-10-07'),
    (40, 6, 'NH2023-005', 'Veer Arora', 'male', 3, '2004-12-26');

INSERT INTO sport (sport_id, name, is_team_sport) VALUES
    (1, 'Football', TRUE),
    (2, '100 Metres', FALSE),
    (3, 'Basketball', TRUE);

INSERT INTO tournament (tournament_id, name, start_date, end_date)
VALUES
    (1, 'Campus Sports Fest 2026', '2026-11-01', '2026-11-15'),
    (2, 'Inter-Department Basketball Cup 2027', '2027-01-10', '2027-01-17');

INSERT INTO `event`
    (event_id, tournament_id, sport_id, name, gender_category, format)
VALUES
    (1, 1, 1, 'Men Football', 'men', 'group_knockout'),
    (2, 1, 2, 'Women 100 Metres', 'women', 'heats'),
    (3, 1, 2, 'Men 100 Metres', 'men', 'heats'),
    (4, 2, 3, 'Inter-Department Basketball', 'mixed', 'group_knockout');

INSERT INTO eligibility_rule
    (eligibility_rule_id, event_id, min_year, max_year, gender, min_age, max_age)
VALUES
    (1, 1, 1, 6, 'male', 17, 28),
    (2, 2, 1, 6, 'female', 17, 28),
    (3, 3, 1, 6, 'male', 17, 28),
    (4, 4, 1, 6, 'any', 17, 28);

INSERT INTO team (team_id, department_id, captain_id, name) VALUES
    (1, 1, 1, 'CSE Strikers'),
    (2, 2, 8, 'Mechanical United'),
    (3, 3, 15, 'Electrical Eagles'),
    (4, 4, 22, 'Civil Warriors'),
    (5, 5, 29, 'BBA Blazers'),
    (6, 6, 36, 'North Hostel FC'),
    (7, 1, 2, 'CSE Challengers'),
    (8, 2, 9, 'Mechanical Titans');

INSERT INTO team_member (team_id, student_id, jersey_number) VALUES
    (1, 1, 1), (1, 2, 2), (1, 3, 3), (1, 4, 4), (1, 5, 5),
    (2, 8, 1), (2, 9, 2), (2, 10, 3), (2, 11, 4), (2, 12, 5),
    (3, 15, 1), (3, 16, 2), (3, 17, 3), (3, 18, 4), (3, 19, 5),
    (4, 22, 1), (4, 23, 2), (4, 24, 3), (4, 25, 4), (4, 26, 5),
    (5, 29, 1), (5, 30, 2), (5, 31, 3), (5, 32, 4), (5, 33, 5),
    (6, 36, 1), (6, 37, 2), (6, 38, 3), (6, 39, 4), (6, 40, 5),
    (7, 1, 11), (7, 2, 12), (7, 3, 13), (7, 4, 14), (7, 5, 15),
    (8, 8, 11), (8, 9, 12), (8, 10, 13), (8, 11, 14), (8, 12, 15);

INSERT INTO venue (venue_id, name, venue_type) VALUES
    (1, 'Main Football Ground', 'ground'),
    (2, 'East Football Ground', 'ground'),
    (3, 'Central Track', 'track'),
    (4, 'Indoor Court', 'court'),
    (5, 'West Basketball Court', 'court'),
    (6, 'Student Activity Hall', 'hall');

INSERT INTO sport_venue (sport_id, venue_id) VALUES
    (1, 1), (1, 2),
    (2, 3), (2, 6),
    (3, 4), (3, 5);

INSERT INTO stage (stage_id, event_id, stage_type, stage_order, name) VALUES
    (1, 1, 'group', 1, 'Group A'),
    (2, 1, 'group', 2, 'Group B'),
    (3, 1, 'quarter_final', 3, 'Quarter Finals'),
    (4, 1, 'semi_final', 4, 'Semi Finals'),
    (5, 1, 'final', 5, 'Final'),
    (6, 2, 'heat', 1, 'Women Heats'),
    (7, 3, 'heat', 1, 'Men Heats'),
    (8, 4, 'group', 1, 'Basketball Group Stage');

INSERT INTO registration (registration_id, event_id, team_id, status) VALUES
    (1, 1, 1, 'approved'), (2, 1, 2, 'approved'),
    (3, 1, 3, 'approved'), (4, 1, 4, 'approved'),
    (5, 1, 5, 'approved'), (6, 1, 6, 'approved'),
    (7, 1, 7, 'approved'), (8, 1, 8, 'approved');

INSERT INTO registration (registration_id, event_id, student_id, status) VALUES
    (9, 2, 6, 'approved'), (10, 2, 7, 'approved'),
    (11, 2, 13, 'approved'), (12, 2, 14, 'approved'),
    (13, 2, 20, 'approved'), (14, 2, 21, 'approved'),
    (15, 2, 27, 'approved'), (16, 2, 28, 'approved'),
    (17, 2, 34, 'approved'), (18, 2, 35, 'approved'),
    (19, 3, 1, 'approved'), (20, 3, 8, 'approved'),
    (21, 3, 15, 'approved'), (22, 3, 22, 'approved'),
    (23, 3, 29, 'approved'), (24, 3, 36, 'approved'),
    (25, 3, 2, 'approved'), (26, 3, 9, 'approved'),
    (27, 3, 16, 'approved'), (28, 3, 23, 'approved'),
    (29, 3, 30, 'approved'), (30, 3, 37, 'approved');

INSERT INTO registration (registration_id, event_id, team_id, status) VALUES
    (31, 4, 1, 'approved'), (32, 4, 2, 'approved'),
    (33, 4, 3, 'approved'), (34, 4, 4, 'approved'),
    (35, 4, 5, 'approved'), (36, 4, 6, 'approved'),
    (37, 4, 7, 'approved'), (38, 4, 8, 'approved');

INSERT INTO `match`
    (match_id, stage_id, venue_id, home_team_id, away_team_id, starts_at,
     duration_minutes, home_score, away_score, status)
VALUES
    (1, 1, 1, 1, 2, '2026-11-01 09:00:00', 90, 2, 1, 'completed'),
    (2, 1, 2, 3, 4, '2026-11-01 09:00:00', 90, 0, 0, 'completed'),
    (3, 1, 1, 1, 3, '2026-11-02 09:00:00', 90, 1, 1, 'completed'),
    (4, 1, 2, 2, 4, '2026-11-02 09:00:00', 90, 3, 0, 'completed'),
    (5, 1, 1, 1, 4, '2026-11-03 09:00:00', 90, 2, 0, 'completed'),
    (6, 1, 2, 2, 3, '2026-11-03 09:00:00', 90, 1, 1, 'completed'),
    (7, 1, 1, 2, 1, '2026-11-04 09:00:00', 90, 0, 1, 'completed'),
    (8, 1, 2, 4, 3, '2026-11-04 09:00:00', 90, 2, 2, 'completed'),
    (9, 1, 1, 3, 1, '2026-11-05 09:00:00', 90, 0, 2, 'completed'),
    (10, 1, 2, 4, 2, '2026-11-05 09:00:00', 90, 1, 3, 'completed'),
    (11, 1, 1, 4, 1, '2026-11-06 09:00:00', 90, 0, 1, 'completed'),
    (12, 1, 2, 3, 2, '2026-11-06 09:00:00', 90, 2, 1, 'completed'),
    (13, 2, 1, 5, 6, '2026-11-01 14:00:00', 90, 1, 1, 'completed'),
    (14, 2, 2, 7, 8, '2026-11-01 14:00:00', 90, 2, 0, 'completed'),
    (15, 2, 1, 5, 7, '2026-11-02 14:00:00', 90, 0, 1, 'completed'),
    (16, 2, 2, 6, 8, '2026-11-02 14:00:00', 90, 2, 2, 'completed'),
    (17, 2, 1, 5, 8, '2026-11-03 14:00:00', 90, 3, 1, 'completed'),
    (18, 2, 2, 6, 7, '2026-11-03 14:00:00', 90, 0, 0, 'completed'),
    (19, 2, 1, 6, 5, '2026-11-04 14:00:00', 90, 1, 2, 'completed'),
    (20, 2, 2, 8, 7, '2026-11-04 14:00:00', 90, 1, 1, 'completed'),
    (21, 2, 1, 7, 5, '2026-11-05 14:00:00', 90, 2, 0, 'completed'),
    (22, 2, 2, 8, 6, '2026-11-05 14:00:00', 90, 0, 1, 'completed'),
    (23, 2, 1, 8, 5, '2026-11-06 14:00:00', 90, 1, 1, 'completed'),
    (24, 2, 2, 7, 6, '2026-11-06 14:00:00', 90, 1, 2, 'completed'),
    (25, 3, 1, 1, 8, '2026-11-08 09:00:00', 90, 2, 0, 'completed'),
    (26, 3, 2, 5, 3, '2026-11-08 09:00:00', 90, 1, 2, 'completed'),
    (27, 3, 1, 2, 7, '2026-11-08 14:00:00', 90, 0, 1, 'completed'),
    (28, 3, 2, 6, 4, '2026-11-08 14:00:00', 90, 2, 1, 'completed'),
    (29, 4, 1, 1, 3, '2026-11-10 09:00:00', 90, 1, 0, 'completed'),
    (30, 4, 2, 7, 6, '2026-11-10 09:00:00', 90, 2, 2, 'completed'),
    (31, 5, 1, 1, 7, '2026-11-12 14:00:00', 90, 2, 1, 'completed'),
    (32, 8, 5, 1, 2, '2027-01-10 09:00:00', 60, 68, 61, 'completed'),
    (33, 8, 6, 3, 4, '2027-01-10 09:00:00', 60, 72, 70, 'completed'),
    (34, 8, 5, 5, 6, '2027-01-11 09:00:00', 60, 64, 66, 'completed'),
    (35, 8, 6, 7, 8, '2027-01-11 09:00:00', 60, 59, 63, 'completed'),
    (36, 8, 5, 1, 3, '2027-01-12 09:00:00', 60, 0, 0, 'scheduled'),
    (37, 8, 6, 2, 4, '2027-01-12 09:00:00', 60, 0, 0, 'scheduled'),
    (38, 8, 5, 5, 7, '2027-01-13 09:00:00', 60, 0, 0, 'scheduled'),
    (39, 8, 6, 6, 8, '2027-01-13 09:00:00', 60, 0, 0, 'scheduled');

INSERT INTO match_event
    (match_event_id, match_id, student_id, team_id, event_type, minute, details)
VALUES
    (1, 1, 1, 1, 'goal', 12, 'Opening goal'),
    (2, 1, 8, 2, 'goal', 44, 'Equaliser'),
    (3, 1, 2, 1, 'goal', 78, 'Winning goal'),
    (4, 4, 9, 2, 'goal', 20, 'First goal'),
    (5, 4, 10, 2, 'goal', 61, 'Second goal'),
    (6, 4, 11, 2, 'goal', 84, 'Third goal'),
    (7, 25, 1, 1, 'goal', 33, 'Quarter-final goal'),
    (8, 25, 2, 1, 'goal', 70, 'Second quarter-final goal'),
    (9, 31, 1, 1, 'goal', 22, 'Final opening goal'),
    (10, 31, 2, 1, 'goal', 66, 'Final winning goal');

INSERT INTO individual_result
    (individual_result_id, registration_id, stage_id, venue_id, result_value, result_unit, result_rank)
VALUES
    (1, 9, 6, 3, 12.41, 'seconds', 1), (2, 10, 6, 3, 12.88, 'seconds', 2),
    (3, 11, 6, 3, 13.02, 'seconds', 3), (4, 12, 6, 3, 13.21, 'seconds', 4),
    (5, 13, 6, 3, 13.40, 'seconds', 5), (6, 14, 6, 3, 13.56, 'seconds', 6),
    (7, 15, 6, 3, 13.70, 'seconds', 7), (8, 16, 6, 3, 13.91, 'seconds', 8),
    (9, 17, 6, 3, 14.12, 'seconds', 9), (10, 18, 6, 3, 14.30, 'seconds', 10),
    (11, 19, 7, 3, 11.02, 'seconds', 1), (12, 20, 7, 3, 11.18, 'seconds', 2),
    (13, 21, 7, 3, 11.29, 'seconds', 3), (14, 22, 7, 3, 11.41, 'seconds', 4),
    (15, 23, 7, 3, 11.54, 'seconds', 5), (16, 24, 7, 3, 11.68, 'seconds', 6),
    (17, 25, 7, 3, 11.80, 'seconds', 7), (18, 26, 7, 3, 11.96, 'seconds', 8),
    (19, 27, 7, 3, 12.08, 'seconds', 9), (20, 28, 7, 3, 12.22, 'seconds', 10),
    (21, 29, 7, 3, 12.35, 'seconds', 11), (22, 30, 7, 3, 12.49, 'seconds', 12);

INSERT INTO official
    (official_id, match_id, full_name, role)
VALUES
    (1, 1, 'Naveen Kumar', 'Referee'), (2, 2, 'Pooja Menon', 'Referee'),
    (3, 3, 'Rajiv Nair', 'Referee'), (4, 4, 'Sneha Iyer', 'Referee'),
    (5, 5, 'Naveen Kumar', 'Referee'), (6, 6, 'Pooja Menon', 'Referee'),
    (7, 7, 'Rajiv Nair', 'Referee'), (8, 8, 'Sneha Iyer', 'Referee'),
    (9, 9, 'Naveen Kumar', 'Referee'), (10, 10, 'Pooja Menon', 'Referee'),
    (11, 11, 'Rajiv Nair', 'Referee'), (12, 12, 'Sneha Iyer', 'Referee'),
    (13, 13, 'Naveen Kumar', 'Referee'), (14, 14, 'Pooja Menon', 'Referee'),
    (15, 15, 'Rajiv Nair', 'Referee'), (16, 16, 'Sneha Iyer', 'Referee'),
    (17, 17, 'Naveen Kumar', 'Referee'), (18, 18, 'Pooja Menon', 'Referee'),
    (19, 19, 'Rajiv Nair', 'Referee'), (20, 20, 'Sneha Iyer', 'Referee'),
    (21, 21, 'Naveen Kumar', 'Referee'), (22, 22, 'Pooja Menon', 'Referee'),
    (23, 23, 'Rajiv Nair', 'Referee'), (24, 24, 'Sneha Iyer', 'Referee'),
    (25, 25, 'Naveen Kumar', 'Referee'), (26, 26, 'Pooja Menon', 'Referee'),
    (27, 27, 'Rajiv Nair', 'Referee'), (28, 28, 'Sneha Iyer', 'Referee'),
    (29, 29, 'Naveen Kumar', 'Referee'), (30, 30, 'Pooja Menon', 'Referee'),
    (31, 31, 'Rajiv Nair', 'Referee'),
    (42, 32, 'Arvind Rao', 'Basketball Official'),
    (43, 33, 'Maya Joseph', 'Basketball Official'),
    (44, 34, 'Arvind Rao', 'Basketball Official'),
    (45, 35, 'Maya Joseph', 'Basketball Official'),
    (46, 36, 'Arvind Rao', 'Basketball Official'),
    (47, 37, 'Maya Joseph', 'Basketball Official'),
    (48, 38, 'Arvind Rao', 'Basketball Official'),
    (49, 39, 'Maya Joseph', 'Basketball Official');

INSERT INTO official
    (official_id, individual_result_id, full_name, role)
VALUES
    (32, 1, 'Leena Das', 'Track Official'), (33, 2, 'Leena Das', 'Track Official'),
    (34, 3, 'Leena Das', 'Track Official'), (35, 4, 'Leena Das', 'Track Official'),
    (36, 5, 'Leena Das', 'Track Official'), (37, 6, 'Leena Das', 'Track Official'),
    (38, 7, 'Leena Das', 'Track Official'), (39, 8, 'Leena Das', 'Track Official'),
    (40, 9, 'Leena Das', 'Track Official'), (41, 10, 'Leena Das', 'Track Official');

INSERT INTO award
    (award_id, event_id, student_id, team_id, award_type, award_rank, awarded_at)
VALUES
    (1, 1, NULL, 1, 'gold', 1, '2026-11-12'),
    (2, 1, NULL, 7, 'silver', 2, '2026-11-12'),
    (3, 2, 6, NULL, 'gold', 1, '2026-11-05');

INSERT INTO app_user (app_user_id, student_id, username, password_hash, role) VALUES
    (1, NULL, 'admin', 'seed-placeholder-hash', 'admin'),
    (2, NULL, 'coordinator', 'seed-placeholder-hash', 'coordinator'),
    (3, 1, 'aarav.sharma', 'seed-placeholder-hash', 'player'),
    (4, NULL, 'viewer', 'seed-placeholder-hash', 'viewer');
