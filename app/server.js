const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const requiredEnvironment = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'APP_DB_USER',
  'APP_DB_PASSWORD',
  'SESSION_SECRET'
];
for (const key of requiredEnvironment) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  function rejectPlayerWrite(request, response) {
    return response.status(403).send(renderPage(request, 'View-only account', '<p>Participant accounts are currently view-only. Coordinators and administrators manage registrations and tournament data.</p>'));
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.APP_DB_USER,
  password: process.env.APP_DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  decimalNumbers: true
});

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const ROLE_LABELS = {
  admin: 'Admin',
  coordinator: 'Coordinator',
  player: 'Player',
  viewer: 'Viewer'
};

const ADMIN_RESOURCES = {
  departments: {
    table: 'department',
    primaryKey: 'department_id',
    fields: [
      ['name', 'Name', 'text'],
      ['department_type', 'Type (department or hostel)', 'text']
    ]
  },
  students: {
    table: 'student',
    primaryKey: 'student_id',
    fields: [
      ['department_id', 'Department', 'number'],
      ['roll_number', 'Roll number', 'text'],
      ['full_name', 'Full name', 'text'],
      ['gender', 'Gender', 'text'],
      ['academic_year', 'Academic year', 'number'],
      ['date_of_birth', 'Date of birth', 'date']
    ]
  },
  sports: {
    table: 'sport',
    primaryKey: 'sport_id',
    fields: [['name', 'Name', 'text'], ['is_team_sport', 'Team sport (0 or 1)', 'number']]
  },
  tournaments: {
    table: 'tournament',
    primaryKey: 'tournament_id',
    fields: [['name', 'Name', 'text'], ['start_date', 'Start date', 'date'], ['end_date', 'End date', 'date']]
  },
  events: {
    table: 'event',
    primaryKey: 'event_id',
    fields: [
      ['tournament_id', 'Tournament', 'number'],
      ['sport_id', 'Sport', 'number'],
      ['name', 'Name', 'text'],
      ['gender_category', 'Gender category', 'text'],
      ['format', 'Format', 'text']
    ]
  },
  venues: {
    table: 'venue',
    primaryKey: 'venue_id',
    fields: [['name', 'Name', 'text'], ['venue_type', 'Type', 'text']]
  },
  teams: {
    table: 'team',
    primaryKey: 'team_id',
    fields: [['department_id', 'Department', 'number'], ['captain_id', 'Captain (optional)', 'number'], ['name', 'Name', 'text']]
  },
  officials: {
    table: 'official',
    primaryKey: 'official_id',
    fields: [
      ['match_id', 'Match (optional)', 'number'],
      ['individual_result_id', 'Athletics result (optional)', 'number'],
      ['full_name', 'Full name', 'text'],
      ['role', 'Role', 'text']
    ]
  },
  users: {
    table: 'app_user',
    primaryKey: 'app_user_id',
    fields: [['student_id', 'Student (optional)', 'number'], ['username', 'Username', 'text'], ['role', 'Role', 'text'], ['password', 'Password (optional on edit)', 'password']]
  }
};

const ADMIN_REFERENCES = {
  students: {
    department_id: { query: 'SELECT department_id AS id, name AS label FROM department ORDER BY name' }
  },
  events: {
    tournament_id: { query: 'SELECT tournament_id AS id, name AS label FROM tournament ORDER BY start_date, name' },
    sport_id: { query: 'SELECT sport_id AS id, name AS label FROM sport ORDER BY name' }
  },
  teams: {
    department_id: { query: 'SELECT department_id AS id, name AS label FROM department ORDER BY name' },
    captain_id: { query: `SELECT student_id AS id, department_id, CONCAT(full_name, ' (', roll_number, ')') AS label FROM student ORDER BY full_name` }
  },
  officials: {
    match_id: { query: `SELECT m.match_id AS id, CONCAT(e.name, ' · ', home.name, ' vs ', away.name) AS label
                 FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id
                 JOIN \`event\` e ON e.event_id = st.event_id
                 JOIN team home ON home.team_id = m.home_team_id
                 JOIN team away ON away.team_id = m.away_team_id ORDER BY m.starts_at` },
    individual_result_id: { query: `SELECT ir.individual_result_id AS id, CONCAT(e.name, ' · ', s.full_name) AS label
                              FROM individual_result ir JOIN registration r ON r.registration_id = ir.registration_id
                              JOIN \`event\` e ON e.event_id = r.event_id
                              JOIN student s ON s.student_id = r.student_id ORDER BY e.name, s.full_name` }
  },
  users: {
    student_id: { query: `SELECT student_id AS id, CONCAT(full_name, ' (', roll_number, ')') AS label FROM student ORDER BY full_name` }
  }
};

const RDBMS_RELATIONS = [
  {
    name: 'department',
    category: 'foundation',
    type: 'Strong Entity',
    pk: 'department_id',
    attrs: [
      { name: 'department_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'name', type: 'VARCHAR(100) NOT NULL', key: 'UQ', note: 'Unique department or hostel name' },
      { name: 'department_type', type: "ENUM('department','hostel') NOT NULL", key: '', note: 'Administrative classification' }
    ],
    keys: ['name UNIQUE (uq_department_name)'],
    refs: [],
    checks: [],
    triggers: [],
    rules: ['Parent of students and teams', 'Deletes restricted if students or teams exist'],
    nf: 'BCNF'
  },
  {
    name: 'student',
    category: 'foundation',
    type: 'Strong Entity',
    pk: 'student_id',
    attrs: [
      { name: 'student_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'department_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References department.department_id' },
      { name: 'roll_number', type: 'VARCHAR(30) NOT NULL', key: 'UQ', note: 'Unique college roll number' },
      { name: 'full_name', type: 'VARCHAR(120) NOT NULL', key: '', note: 'Student legal full name' },
      { name: 'gender', type: "ENUM('male','female','other') NOT NULL", key: '', note: 'Used for event eligibility validation' },
      { name: 'academic_year', type: 'TINYINT UNSIGNED NOT NULL', key: 'CK', note: 'Academic progression year (1 to 6)' },
      { name: 'date_of_birth', type: 'DATE NOT NULL', key: '', note: 'Used for age limit validation' }
    ],
    keys: ['roll_number UNIQUE (uq_student_roll_number)'],
    refs: ['department_id → department.department_id [ON DELETE RESTRICT ON UPDATE CASCADE]'],
    checks: ['academic_year BETWEEN 1 AND 6 (ck_student_academic_year)'],
    triggers: ['trg_check_eligibility_insert (monitored)', 'trg_check_eligibility_update (monitored)'],
    rules: ['Department reference required', 'Referenced by registrations, awards, memberships, users, and captaincies'],
    nf: 'BCNF'
  },
  {
    name: 'sport',
    category: 'foundation',
    type: 'Strong Entity',
    pk: 'sport_id',
    attrs: [
      { name: 'sport_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'name', type: 'VARCHAR(80) NOT NULL', key: 'UQ', note: 'Unique sport code/name' },
      { name: 'is_team_sport', type: 'BOOLEAN NOT NULL', key: '', note: 'TRUE for football/basketball, FALSE for athletics' }
    ],
    keys: ['name UNIQUE (uq_sport_name)'],
    refs: [],
    checks: [],
    triggers: [],
    rules: ['Governs competition workflow: team events require squads/fixtures; individual events require heats/athletes'],
    nf: 'BCNF'
  },
  {
    name: 'tournament',
    category: 'foundation',
    type: 'Strong Entity',
    pk: 'tournament_id',
    attrs: [
      { name: 'tournament_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'name', type: 'VARCHAR(120) NOT NULL', key: 'UQ', note: 'Tournament edition name' },
      { name: 'start_date', type: 'DATE NOT NULL', key: 'UQ', note: 'Scheduled commencement' },
      { name: 'end_date', type: 'DATE NOT NULL', key: 'CK', note: 'Scheduled completion' }
    ],
    keys: ['(name, start_date) UNIQUE (uq_tournament_name_start)'],
    refs: [],
    checks: ['end_date >= start_date (ck_tournament_dates)'],
    triggers: [],
    rules: ['Top-level container for all competitive events', 'Calendar date integrity enforced by database CHECK'],
    nf: 'BCNF'
  },
  {
    name: 'venue',
    category: 'foundation',
    type: 'Strong Entity',
    pk: 'venue_id',
    attrs: [
      { name: 'venue_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'name', type: 'VARCHAR(100) NOT NULL', key: 'UQ', note: 'Campus ground, court, or track name' },
      { name: 'venue_type', type: "ENUM('ground','court','track','hall','other') NOT NULL", key: '', note: 'Physical facility category' }
    ],
    keys: ['name UNIQUE (uq_venue_name)'],
    refs: [],
    checks: [],
    triggers: ['trg_venue_clash_insert (monitored)', 'trg_venue_clash_update (monitored)'],
    rules: ['Hosts scheduled matches and athletics heats', 'Protected against double-booking by database trigger'],
    nf: 'BCNF'
  },
  {
    name: 'sport_venue',
    category: 'foundation',
    type: 'Associative Entity',
    pk: '(sport_id, venue_id)',
    attrs: [
      { name: 'sport_id', type: 'INT UNSIGNED NOT NULL', key: 'PK, FK', note: 'References sport.sport_id' },
      { name: 'venue_id', type: 'INT UNSIGNED NOT NULL', key: 'PK, FK', note: 'References venue.venue_id' }
    ],
    keys: ['(sport_id, venue_id) PRIMARY KEY'],
    refs: [
      'sport_id → sport.sport_id [ON DELETE CASCADE ON UPDATE CASCADE]',
      'venue_id → venue.venue_id [ON DELETE CASCADE ON UPDATE CASCADE]'
    ],
    checks: [],
    triggers: [],
    rules: ['Resolves M:N suitability between sports and campus facilities', 'Full cascading lifecycle on both dimensions'],
    nf: 'BCNF'
  },
  {
    name: 'event',
    category: 'competition',
    type: 'Strong Entity',
    pk: 'event_id',
    attrs: [
      { name: 'event_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'tournament_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References tournament.tournament_id' },
      { name: 'sport_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References sport.sport_id' },
      { name: 'name', type: 'VARCHAR(120) NOT NULL', key: 'UQ', note: 'Event title (e.g. Men Football)' },
      { name: 'gender_category', type: "ENUM('men','women','mixed','open') NOT NULL", key: '', note: 'Gender eligibility bracket' },
      { name: 'format', type: "ENUM('group_knockout','knockout','heats') NOT NULL", key: '', note: 'Tournament stage structure' }
    ],
    keys: ['(tournament_id, name) UNIQUE (uq_event_name_tournament)'],
    refs: [
      'tournament_id → tournament.tournament_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'sport_id → sport.sport_id [ON DELETE RESTRICT ON UPDATE CASCADE]'
    ],
    checks: [],
    triggers: [],
    rules: ['Parent of stages, registrations, eligibility rules, and awards', 'Name is unique within each tournament edition'],
    nf: 'BCNF'
  },
  {
    name: 'eligibility_rule',
    category: 'competition',
    type: 'Dependent Entity',
    pk: 'eligibility_rule_id',
    attrs: [
      { name: 'eligibility_rule_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'event_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References event.event_id (1:0..1)' },
      { name: 'min_year', type: 'TINYINT UNSIGNED NULL', key: 'CK', note: 'Minimum allowed academic year' },
      { name: 'max_year', type: 'TINYINT UNSIGNED NULL', key: 'CK', note: 'Maximum allowed academic year' },
      { name: 'gender', type: "ENUM('male','female','other','any') NOT NULL DEFAULT 'any'", key: '', note: 'Required athlete gender' },
      { name: 'min_age', type: 'TINYINT UNSIGNED NULL', key: 'CK', note: 'Calculated from date_of_birth' },
      { name: 'max_age', type: 'TINYINT UNSIGNED NULL', key: 'CK', note: 'Calculated from date_of_birth' }
    ],
    keys: ['event_id UNIQUE (uq_eligibility_rule_event)'],
    refs: ['event_id → event.event_id [ON DELETE CASCADE ON UPDATE CASCADE]'],
    checks: [
      'Academic year range: 1–6 and max_year >= min_year (ck_eligibility_years)',
      'Age range: non-negative and max_age >= min_age (ck_eligibility_ages)'
    ],
    triggers: ['Enforced at registration time via trg_check_eligibility_insert/update'],
    rules: ['Weak entity: deleted automatically if parent event is deleted', 'Exactly one rule per event'],
    nf: 'BCNF'
  },
  {
    name: 'team',
    category: 'competition',
    type: 'Strong Entity',
    pk: 'team_id',
    attrs: [
      { name: 'team_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'department_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References department.department_id' },
      { name: 'captain_id', type: 'INT UNSIGNED NULL', key: 'FK', note: 'Optional references student.student_id' },
      { name: 'name', type: 'VARCHAR(100) NOT NULL', key: 'UQ', note: 'Squad name' }
    ],
    keys: ['(department_id, name) UNIQUE (uq_team_department_name)'],
    refs: [
      'department_id → department.department_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'captain_id → student.student_id [ON DELETE SET NULL ON UPDATE CASCADE]'
    ],
    checks: [],
    triggers: [],
    rules: ['Team name unique per department', 'Setting captain automatically syncs team membership via transaction'],
    nf: 'BCNF'
  },
  {
    name: 'team_member',
    category: 'competition',
    type: 'Associative Entity',
    pk: '(team_id, student_id)',
    attrs: [
      { name: 'team_id', type: 'INT UNSIGNED NOT NULL', key: 'PK, FK', note: 'References team.team_id' },
      { name: 'student_id', type: 'INT UNSIGNED NOT NULL', key: 'PK, FK', note: 'References student.student_id' },
      { name: 'jersey_number', type: 'TINYINT UNSIGNED NOT NULL', key: 'UQ, CK', note: 'Shirt/kit number (0 to 99)' }
    ],
    keys: [
      '(team_id, student_id) PRIMARY KEY',
      '(team_id, jersey_number) UNIQUE (uq_team_jersey)'
    ],
    refs: [
      'team_id → team.team_id [ON DELETE CASCADE ON UPDATE CASCADE]',
      'student_id → student.student_id [ON DELETE CASCADE ON UPDATE CASCADE]'
    ],
    checks: ['jersey_number BETWEEN 0 AND 99 (ck_team_member_jersey)'],
    triggers: [],
    rules: ['Resolves M:N roster between teams and students', 'Jersey numbers must be unique within each team squad'],
    nf: 'BCNF'
  },
  {
    name: 'registration',
    category: 'competition',
    type: 'Relationship Entity',
    pk: 'registration_id',
    attrs: [
      { name: 'registration_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'event_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References event.event_id' },
      { name: 'student_id', type: 'INT UNSIGNED NULL', key: 'FK, UQ, CK', note: 'Individual entrant (NULL for team sports)' },
      { name: 'team_id', type: 'INT UNSIGNED NULL', key: 'FK, UQ, CK', note: 'Team entrant (NULL for individual sports)' },
      { name: 'status', type: "ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending'", key: '', note: 'Operational approval lifecycle' }
    ],
    keys: [
      '(event_id, student_id) UNIQUE (uq_registration_student_event)',
      '(event_id, team_id) UNIQUE (uq_registration_team_event)'
    ],
    refs: [
      'event_id → event.event_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'student_id → student.student_id [ON DELETE RESTRICT ON UPDATE RESTRICT]',
      'team_id → team.team_id [ON DELETE RESTRICT ON UPDATE RESTRICT]'
    ],
    checks: [
      'Exclusive entrant check: (student_id IS NOT NULL) <> (team_id IS NOT NULL) (ck_registration_exactly_one_entrant)'
    ],
    triggers: [
      'trg_check_eligibility_insert (enforces student eligibility against rules)',
      'trg_check_eligibility_update (re-validates eligibility on entrant modifications)'
    ],
    rules: ['Exclusive-FK XOR pattern: row represents an individual student entry OR a department team entry, never both', 'ON DELETE RESTRICT on entrant FKs complies with MySQL CHECK compatibility'],
    nf: 'BCNF'
  },
  {
    name: 'stage',
    category: 'competition',
    type: 'Dependent Entity',
    pk: 'stage_id',
    attrs: [
      { name: 'stage_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'event_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References event.event_id' },
      { name: 'stage_type', type: "ENUM('group','quarter_final','semi_final','final','heat') NOT NULL", key: '', note: 'Bracket/phase discriminator' },
      { name: 'stage_order', type: 'SMALLINT UNSIGNED NOT NULL', key: 'UQ, CK', note: 'Chronological progression sequence' },
      { name: 'name', type: 'VARCHAR(80) NOT NULL', key: 'UQ', note: 'Descriptive title (e.g. Group A, Final)' }
    ],
    keys: [
      '(event_id, stage_order) UNIQUE (uq_stage_event_order)',
      '(event_id, name) UNIQUE (uq_stage_event_name)'
    ],
    refs: ['event_id → event.event_id [ON DELETE CASCADE ON UPDATE CASCADE]'],
    checks: ['stage_order > 0 (ck_stage_order)'],
    triggers: [],
    rules: ['Child of event: cascading deletion', 'Organizes team matches (round-robin/knockout) or athletics heats'],
    nf: 'BCNF'
  },
  {
    name: 'match',
    category: 'operations',
    type: 'Scheduled Entity',
    pk: 'match_id',
    attrs: [
      { name: 'match_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'stage_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References stage.stage_id' },
      { name: 'venue_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References venue.venue_id' },
      { name: 'home_team_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, CK', note: 'First competing team' },
      { name: 'away_team_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, CK', note: 'Opposing competing team' },
      { name: 'starts_at', type: 'DATETIME NOT NULL', key: 'IX', note: 'Match start timestamp' },
      { name: 'duration_minutes', type: 'SMALLINT UNSIGNED NOT NULL', key: 'CK', note: 'Match duration in minutes' },
      { name: 'home_score', type: 'SMALLINT UNSIGNED NOT NULL DEFAULT 0', key: '', note: 'Home score (sync with match_event)' },
      { name: 'away_score', type: 'SMALLINT UNSIGNED NOT NULL DEFAULT 0', key: '', note: 'Away score (sync with match_event)' },
      { name: 'status', type: "ENUM('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled'", key: 'IX', note: 'Operational state' }
    ],
    keys: [],
    refs: [
      'stage_id → stage.stage_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'venue_id → venue.venue_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'home_team_id → team.team_id [ON DELETE RESTRICT ON UPDATE RESTRICT]',
      'away_team_id → team.team_id [ON DELETE RESTRICT ON UPDATE RESTRICT]'
    ],
    checks: [
      'Distinct teams check: home_team_id <> away_team_id (ck_match_distinct_teams)',
      'Duration bounds: duration_minutes BETWEEN 1 AND 600 (ck_match_duration)'
    ],
    triggers: [
      'trg_venue_clash_insert (prevents venue double-booking)',
      'trg_venue_clash_update (allows score updates while checking venue reschedule clashes)',
      'trg_lock_final_match (locks all match attributes once status is completed)'
    ],
    rules: ['Controlled denormalization: stores aggregate scores for rapid standings view calculation', 'Distinct team CHECK enforces ON DELETE RESTRICT on team foreign keys'],
    nf: '3NF (deliberate denormalization of aggregate scores)'
  },
  {
    name: 'match_event',
    category: 'operations',
    type: 'Dependent Event',
    pk: 'match_event_id',
    attrs: [
      { name: 'match_event_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'match_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References match.match_id' },
      { name: 'student_id', type: 'INT UNSIGNED NULL', key: 'FK', note: 'Scorer/offender student' },
      { name: 'team_id', type: 'INT UNSIGNED NULL', key: 'FK', note: 'Benefiting team' },
      { name: 'event_type', type: "ENUM('goal','wicket','foul','yellow_card','red_card','assist','other') NOT NULL", key: '', note: 'In-game occurrence' },
      { name: 'minute', type: 'SMALLINT UNSIGNED NULL', key: 'CK', note: 'Game minute of occurrence' },
      { name: 'details', type: 'VARCHAR(255) NULL', key: '', note: 'Contextual notes or play description' },
      { name: 'recorded_at', type: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', key: '', note: 'Audit timestamp' }
    ],
    keys: [],
    refs: [
      'match_id → match.match_id [ON DELETE CASCADE ON UPDATE CASCADE]',
      'student_id → student.student_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'team_id → team.team_id [ON DELETE RESTRICT ON UPDATE CASCADE]'
    ],
    checks: ['minute IS NULL OR minute BETWEEN 0 AND 600 (ck_match_event_minute)'],
    triggers: ['trg_update_score (increments match.home_score or away_score on goal insertion)'],
    rules: ['Atomic audit log of in-game actions'],
    nf: 'BCNF'
  },
  {
    name: 'individual_result',
    category: 'operations',
    type: 'Dependent Result',
    pk: 'individual_result_id',
    attrs: [
      { name: 'individual_result_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'registration_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References registration.registration_id' },
      { name: 'stage_id', type: 'INT UNSIGNED NOT NULL', key: 'FK, UQ', note: 'References stage.stage_id (heat/final)' },
      { name: 'venue_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References venue.venue_id' },
      { name: 'result_value', type: 'DECIMAL(12,3) NULL', key: 'CK', note: 'Measured numerical performance' },
      { name: 'result_unit', type: "ENUM('seconds','metres','points') NOT NULL", key: '', note: 'Measurement metric' },
      { name: 'result_rank', type: 'SMALLINT UNSIGNED NULL', key: 'CK', note: 'Finishing rank in heat/final (1-indexed)' }
    ],
    keys: ['(registration_id, stage_id) UNIQUE (uq_individual_result_registration_stage)'],
    refs: [
      'registration_id → registration.registration_id [ON DELETE CASCADE ON UPDATE CASCADE]',
      'stage_id → stage.stage_id [ON DELETE CASCADE ON UPDATE CASCADE]',
      'venue_id → venue.venue_id [ON DELETE RESTRICT ON UPDATE CASCADE]'
    ],
    checks: [
      'result_value IS NULL OR result_value >= 0 (ck_individual_result_value)',
      'result_rank IS NULL OR result_rank > 0 (ck_individual_result_rank)'
    ],
    triggers: [],
    rules: ['Used exclusively for individual sports (track and field, athletics)', 'Avoids non-standard MySQL reserved words like rank'],
    nf: 'BCNF'
  },
  {
    name: 'official',
    category: 'governance',
    type: 'Assignment Entity',
    pk: 'official_id',
    attrs: [
      { name: 'official_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'match_id', type: 'INT UNSIGNED NULL', key: 'FK, CK', note: 'Team match assignment target' },
      { name: 'individual_result_id', type: 'INT UNSIGNED NULL', key: 'FK, CK', note: 'Athletics result assignment target' },
      { name: 'full_name', type: 'VARCHAR(120) NOT NULL', key: '', note: 'Official referee / umpire name' },
      { name: 'role', type: 'VARCHAR(60) NOT NULL', key: '', note: 'Assignment title (Referee, Line Judge, Timekeeper)' }
    ],
    keys: [],
    refs: [
      'match_id → match.match_id [ON DELETE RESTRICT ON UPDATE RESTRICT]',
      'individual_result_id → individual_result.individual_result_id [ON DELETE RESTRICT ON UPDATE RESTRICT]'
    ],
    checks: [
      'Exclusive assignment check: (match_id IS NOT NULL) <> (individual_result_id IS NOT NULL) (ck_official_exactly_one_assignment)'
    ],
    triggers: [],
    rules: ['Polymorphic-safe exclusive foreign key pattern without loose IDs', 'Referees either a match OR an athletics event'],
    nf: 'BCNF'
  },
  {
    name: 'award',
    category: 'governance',
    type: 'Relationship Entity',
    pk: 'award_id',
    attrs: [
      { name: 'award_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'event_id', type: 'INT UNSIGNED NOT NULL', key: 'FK', note: 'References event.event_id' },
      { name: 'student_id', type: 'INT UNSIGNED NULL', key: 'FK, CK', note: 'Individual recipient (NULL for team sports)' },
      { name: 'team_id', type: 'INT UNSIGNED NULL', key: 'FK, CK', note: 'Team recipient (NULL for individual sports)' },
      { name: 'award_type', type: "ENUM('gold','silver','bronze','player_of_tournament','department_trophy','other') NOT NULL", key: '', note: 'Award classification' },
      { name: 'award_rank', type: 'SMALLINT UNSIGNED NULL', key: 'CK', note: 'Podium rank (1, 2, 3)' },
      { name: 'awarded_at', type: 'DATE NOT NULL', key: '', note: 'Presentation date' }
    ],
    keys: [],
    refs: [
      'event_id → event.event_id [ON DELETE RESTRICT ON UPDATE CASCADE]',
      'student_id → student.student_id [ON DELETE RESTRICT ON UPDATE RESTRICT]',
      'team_id → team.team_id [ON DELETE RESTRICT ON UPDATE RESTRICT]'
    ],
    checks: [
      'Exclusive recipient check: (student_id IS NOT NULL) <> (team_id IS NOT NULL) (ck_award_exactly_one_recipient)',
      'award_rank IS NULL OR award_rank > 0 (ck_award_rank)'
    ],
    triggers: [],
    rules: ['Powers the dynamic v_medal_tally department rollup view', 'Recorded automatically via sp_assign_awards procedure or administrator tool'],
    nf: 'BCNF'
  },
  {
    name: 'app_user',
    category: 'governance',
    type: 'Account Entity',
    pk: 'app_user_id',
    attrs: [
      { name: 'app_user_id', type: 'INT UNSIGNED AUTO_INCREMENT', key: 'PK', note: 'Surrogate primary key' },
      { name: 'student_id', type: 'INT UNSIGNED NULL', key: 'FK, UQ', note: 'Optional 1:0..1 student account link' },
      { name: 'username', type: 'VARCHAR(80) NOT NULL', key: 'UQ', note: 'Unique login credential' },
      { name: 'password_hash', type: 'VARCHAR(255) NOT NULL', key: '', note: 'Bcrypt cryptographic hash' },
      { name: 'role', type: "ENUM('admin','coordinator','player','viewer') NOT NULL", key: '', note: 'Role-based access level' }
    ],
    keys: [
      'username UNIQUE (uq_app_user_username)',
      'student_id UNIQUE (uq_app_user_student)'
    ],
    refs: ['student_id → student.student_id [ON DELETE SET NULL ON UPDATE CASCADE]'],
    checks: [],
    triggers: [],
    rules: ['Application security boundary: bcrypt hashes, session tokens, SameSite cookies', 'Student link preserves account if student record is deleted (ON DELETE SET NULL)'],
    nf: 'BCNF'
  }
];

const RDBMS_RELATIONSHIPS = [
  ['department', 'student', 'contains', '1 : N', 'A department contains multiple registered students'],
  ['department', 'team', 'represents', '1 : N', 'A department fields teams across various sports'],
  ['student', 'team', 'captains', '0..1 : N', 'A student optionally captains a department squad'],
  ['tournament', 'event', 'contains', '1 : N', 'A tournament edition hosts multiple sport events'],
  ['sport', 'event', 'classifies', '1 : N', 'A sport defines rules and formats for events'],
  ['sport', 'sport_venue', 'qualifies', '1 : N', 'M:N resolution of suitable campus facilities'],
  ['venue', 'sport_venue', 'accommodates', '1 : N', 'M:N resolution of sports hosted by this venue'],
  ['event', 'eligibility_rule', 'constrains', '1 : 0..1', 'Optional criteria governing student participants'],
  ['event', 'registration', 'accepts', '1 : N', 'Entrants register for competition in an event'],
  ['student', 'registration', 'individual entrant', '0..1 : N', 'Exclusive XOR entrant: student entrant for individual sports'],
  ['team', 'registration', 'team entrant', '0..1 : N', 'Exclusive XOR entrant: team entrant for team sports'],
  ['team', 'team_member', 'roster', '1 : N', 'M:N resolution of players belonging to teams'],
  ['student', 'team_member', 'membership', '1 : N', 'M:N resolution of student roster memberships'],
  ['event', 'stage', 'organizes', '1 : N', 'Sequential tournament brackets (groups, knockouts, heats)'],
  ['stage', 'match', 'schedules', '1 : N', 'Matches scheduled within a tournament stage'],
  ['venue', 'match', 'hosts', '1 : N', 'Venue hosting scheduled matches (overlap guarded)'],
  ['team', 'match (home)', 'home contender', '1 : N', 'First competing team role'],
  ['team', 'match (away)', 'away contender', '1 : N', 'Opposing competing team role (must differ from home)'],
  ['match', 'match_event', 'records', '1 : N', 'In-game score, card, and foul event audit log'],
  ['student', 'match_event', 'performs', '0..1 : N', 'Individual athlete performing the play/event'],
  ['team', 'match_event', 'benefits', '0..1 : N', 'Team credited with the goal or event'],
  ['registration', 'individual_result', 'achieves', '1 : N', 'Individual sport athlete metric performance'],
  ['stage', 'individual_result', 'heats', '1 : N', 'Heat/final stage organizing the individual result'],
  ['venue', 'individual_result', 'hosts', '1 : N', 'Venue where track/field result occurred'],
  ['match', 'official', 'officiates match', '0..1 : N', 'Exclusive XOR assignment: refereeing team matches'],
  ['individual_result', 'official', 'officiates result', '0..1 : N', 'Exclusive XOR assignment: timekeeping/scoring heats'],
  ['event', 'award', 'bestows', '1 : N', 'Medals and honors presented for an event'],
  ['student', 'award', 'individual recipient', '0..1 : N', 'Exclusive XOR recipient: athlete medal recipient'],
  ['team', 'award', 'team recipient', '0..1 : N', 'Exclusive XOR recipient: department team medal recipient'],
  ['student', 'app_user', 'account link', '0..1 : 0..1', 'Optional 1-to-1 link between student and login user']
];

const RDBMS_PROGRAMMABILITY = {
  views: [
    { name: 'v_points_table', type: 'View', purpose: 'Dynamically computes round-robin group standings (P, W, D, L, GF, GA, GD, Points, and dense Rank) using window functions and CTEs.' },
    { name: 'v_medal_tally', type: 'View', purpose: 'Aggregates department gold, silver, and bronze medal awards across both individual athletics and team competitions.' },
    { name: 'v_match_schedule', type: 'View', purpose: 'Public consolidated schedule view combining matches, venues, teams, and live score aggregates.' }
  ],
  triggers: [
    { name: 'trg_check_eligibility_insert', table: 'registration', timing: 'BEFORE INSERT', rule: 'Verifies student gender, academic year, and age against event eligibility_rule.' },
    { name: 'trg_check_eligibility_update', table: 'registration', timing: 'BEFORE UPDATE', rule: 'Prevents modifying an entrant to one that violates event eligibility constraints.' },
    { name: 'trg_venue_clash_insert', table: 'match', timing: 'BEFORE INSERT', rule: 'Prevents scheduling conflicting matches at the same venue during overlapping time intervals.' },
    { name: 'trg_venue_clash_update', table: 'match', timing: 'BEFORE UPDATE', rule: 'Enforces interval clash detection when rescheduling venue, time, or duration, while permitting score-only updates.' },
    { name: 'trg_update_score', table: 'match_event', timing: 'AFTER INSERT', rule: 'Maintains controlled denormalization by incrementing home_score or away_score in match when a goal event is logged.' },
    { name: 'trg_lock_final_match', table: 'match', timing: 'BEFORE UPDATE', rule: 'Guarantees match immutability: rejects any attribute modifications once match status reaches completed.' }
  ],
  routines: [
    { name: 'fn_team_points(event_id, team_id)', type: 'Stored Function', returns: 'INT', purpose: 'Deterministic helper function returning cumulative points (3 for win, 1 for draw) earned by a team.' },
    { name: 'sp_generate_group_fixtures(stage_id, venue_id, start_at)', type: 'Stored Procedure', returns: 'VOID', purpose: 'Generates round-robin fixtures for all registered teams in a group stage, spacing matches by 2 hours.' },
    { name: 'sp_advance_knockout(source_stage, target_stage, venue_id, start_at)', type: 'Stored Procedure', returns: 'VOID', purpose: 'Extracts winning teams from a completed preliminary round and generates pairs for the subsequent knockout stage.' },
    { name: 'sp_assign_awards(event_id, final_stage_id, awarded_at)', type: 'Stored Procedure', returns: 'VOID', purpose: 'Evaluates the completed final match result and automatically registers gold and silver medal awards.' }
  ]
};

const RDBMS_DIAGRAM_COORDS = {
  // Row 1: Core Foundation (y = 55)
  department: { x: 50, y: 55, cat: 'foundation', label: 'department', type: 'Strong Entity' },
  student: { x: 270, y: 55, cat: 'foundation', label: 'student', type: 'Strong Entity' },
  team: { x: 490, y: 55, cat: 'competition', label: 'team', type: 'Strong Entity' },
  sport: { x: 720, y: 55, cat: 'foundation', label: 'sport', type: 'Strong Entity' },
  sport_venue: { x: 910, y: 55, cat: 'foundation', label: 'sport_venue', type: 'Associative (M:N)' },
  venue: { x: 1090, y: 55, cat: 'foundation', label: 'venue', type: 'Strong Entity' },

  // Row 2: Accounts, Members, Tournaments & Events (y = 210)
  app_user: { x: 60, y: 210, cat: 'governance', label: 'app_user', type: 'Account Entity' },
  team_member: { x: 490, y: 210, cat: 'competition', label: 'team_member', type: 'Associative (M:N)' },
  tournament: { x: 720, y: 210, cat: 'foundation', label: 'tournament', type: 'Strong Entity' },
  event: { x: 950, y: 210, cat: 'competition', label: 'event', type: 'Strong Entity' },

  // Row 3: Entrants, Eligibility & Stages (y = 360)
  registration: { x: 270, y: 360, cat: 'competition', label: 'registration', type: 'Relationship Entity' },
  stage: { x: 680, y: 360, cat: 'competition', label: 'stage', type: 'Dependent Entity' },
  eligibility_rule: { x: 950, y: 360, cat: 'competition', label: 'eligibility_rule', type: 'Dependent (1:0..1)' },

  // Row 4: Matches, Events & Results (y = 510)
  match_event: { x: 70, y: 510, cat: 'operations', label: 'match_event', type: 'Dependent Event' },
  match: { x: 360, y: 510, cat: 'operations', label: 'match', type: 'Scheduled Entity' },
  individual_result: { x: 750, y: 510, cat: 'operations', label: 'individual_result', type: 'Dependent Result' },

  // Row 5: Governance & Honors (y = 660)
  official: { x: 550, y: 660, cat: 'governance', label: 'official', type: 'Assignment (XOR)' },
  award: { x: 915, y: 660, cat: 'governance', label: 'award', type: 'Honors Entity (XOR)' }
};

const RDBMS_DIAGRAM_EDGES = [
  // Foundation & Members
  { from: 'department', to: 'student', label: 'contains (1:N)', type: 'direct' },
  { from: 'department', to: 'team', label: 'represents (1:N)', type: 'curve-top' },
  { from: 'student', to: 'team', label: 'captains (0..1:N)', type: 'direct' },
  { from: 'student', to: 'app_user', label: 'owns (0..1:0..1)', type: 'curve-down-left' },
  { from: 'student', to: 'team_member', label: 'joins (1:N)', type: 'direct' },
  { from: 'team', to: 'team_member', label: 'roster (1:N)', type: 'vertical-right' },

  // Sports, Venues & Tournament
  { from: 'sport', to: 'sport_venue', label: 'qualifies (1:N)', type: 'direct' },
  { from: 'venue', to: 'sport_venue', label: 'hosts (1:N)', type: 'direct' },
  { from: 'tournament', to: 'event', label: 'contains (1:N)', type: 'direct' },
  { from: 'sport', to: 'event', label: 'classifies (1:N)', type: 'curve-sport-event' },

  // Competition Hierarchy & Entrants
  { from: 'event', to: 'eligibility_rule', label: 'constrains (1:0..1)', type: 'vertical-right' },
  { from: 'event', to: 'stage', label: 'organizes (1:N)', type: 'direct' },
  { from: 'event', to: 'registration', label: 'accepts (1:N)', type: 'curve-event-reg' },
  { from: 'student', to: 'registration', label: 'entrant (XOR)', type: 'vertical-left' },
  { from: 'team', to: 'registration', label: 'entrant (XOR)', type: 'curve-team-reg' },

  // Matches, Heats & Operations
  { from: 'stage', to: 'match', label: 'schedules (1:N)', type: 'direct' },
  { from: 'venue', to: 'match', label: 'hosts venue (1:N)', type: 'spine-left' },
  { from: 'team', to: 'match', label: 'home / away (1:N)', type: 'curve-team-match' },
  { from: 'match', to: 'match_event', label: 'logs (1:N)', type: 'direct' },
  { from: 'registration', to: 'individual_result', label: 'produces (1:N)', type: 'curve-reg-result' },
  { from: 'stage', to: 'individual_result', label: 'heats (1:N)', type: 'direct' },
  { from: 'venue', to: 'individual_result', label: 'hosts (1:N)', type: 'spine-right' },

  // Governance, Officials & Honors
  { from: 'match', to: 'official', label: 'officiates match (XOR)', type: 'direct' },
  { from: 'individual_result', to: 'official', label: 'officiates heat (XOR)', type: 'direct' },
  { from: 'event', to: 'award', label: 'presents (1:N)', type: 'spine-down' },
  { from: 'match', to: 'award', label: 'podium results (XOR)', type: 'curve-bottom' }
];

function renderRdbmsDiagram() {
  const NODE_W = 130;
  const NODE_H = 48;

  function getNodeCenter(name) {
    const n = RDBMS_DIAGRAM_COORDS[name];
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
  }

  const edgeLines = [];
  const edgeLabels = [];

  RDBMS_DIAGRAM_EDGES.forEach((edge) => {
    const fromNode = RDBMS_DIAGRAM_COORDS[edge.from];
    const toNode = RDBMS_DIAGRAM_COORDS[edge.to];
    if (!fromNode || !toNode) return;

    const fc = getNodeCenter(edge.from);
    const tc = getNodeCenter(edge.to);

    let d = '';
    let labelX = (fc.x + tc.x) / 2;
    let labelY = (fc.y + tc.y) / 2 - 6;

    if (edge.type === 'direct') {
      let x1 = fc.x;
      let y1 = fc.y;
      let x2 = tc.x;
      let y2 = tc.y;

      if (Math.abs(tc.x - fc.x) > Math.abs(tc.y - fc.y)) {
        if (tc.x > fc.x) { x1 = fromNode.x + NODE_W; x2 = toNode.x; }
        else { x1 = fromNode.x; x2 = toNode.x + NODE_W; }
      } else {
        if (tc.y > fc.y) { y1 = fromNode.y + NODE_H; y2 = toNode.y; }
        else { y1 = fromNode.y; y2 = toNode.y + NODE_H; }
      }
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = (y1 + y2) / 2 - 6;
    } else if (edge.type === 'curve-top') {
      const x1 = fromNode.x + NODE_W / 2;
      const y1 = fromNode.y;
      const x2 = toNode.x + NODE_W / 2;
      const y2 = toNode.y;
      const cx = (x1 + x2) / 2;
      const cy = 18;
      d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
      labelX = cx;
      labelY = cy - 2;
    } else if (edge.type === 'vertical-left') {
      const x1 = fc.x;
      const y1 = fromNode.y + NODE_H;
      const x2 = tc.x;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
      labelX = x1 - 58;
      labelY = (y1 + y2) / 2;
    } else if (edge.type === 'vertical-right') {
      const x1 = fc.x;
      const y1 = fromNode.y + NODE_H;
      const x2 = tc.x;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
      labelX = x1 + 52;
      labelY = (y1 + y2) / 2;
    } else if (edge.type === 'curve-down-left') {
      const x1 = fromNode.x;
      const y1 = fc.y;
      const x2 = tc.x;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} C 210 110, 150 150, ${x2} ${y2}`;
      labelX = 180;
      labelY = 135;
    } else if (edge.type === 'curve-sport-event') {
      const x1 = fc.x;
      const y1 = fromNode.y + NODE_H;
      const x2 = tc.x - 20;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} C 810 140, 890 160, ${x2} ${y2}`;
      labelX = 855;
      labelY = 152;
    } else if (edge.type === 'curve-team-reg') {
      const x1 = fromNode.x + 10;
      const y1 = fromNode.y + NODE_H;
      const x2 = toNode.x + NODE_W - 10;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} C 440 160, 420 280, ${x2} ${y2}`;
      labelX = 415;
      labelY = 270;
    } else if (edge.type === 'curve-event-reg') {
      const x1 = fromNode.x;
      const y2_reg = toNode.y + 15;
      d = `M ${x1} ${fromNode.y + NODE_H - 10} C 780 290, 560 320, ${toNode.x + NODE_W} ${y2_reg}`;
      labelX = 600;
      labelY = 305;
    } else if (edge.type === 'curve-team-match') {
      const x1 = fromNode.x + 20;
      const y1 = fromNode.y + NODE_H;
      const x2 = tc.x + 20;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} C 440 220, 430 380, ${x2} ${y2}`;
      labelX = 438;
      labelY = 440;
    } else if (edge.type === 'curve-reg-result') {
      const x1 = fromNode.x + NODE_W;
      const y1 = fc.y;
      const x2 = toNode.x;
      const y2 = tc.y;
      d = `M ${x1} ${y1} C 500 420, 640 470, ${x2} ${y2}`;
      labelX = 580;
      labelY = 465;
    } else if (edge.type === 'spine-left') {
      const x1 = fromNode.x + 30;
      const y1 = fromNode.y + NODE_H;
      const x2 = toNode.x + NODE_W;
      const y2 = tc.y;
      d = `M ${x1} ${y1} C 1170 300, 700 520, ${x2} ${y2}`;
      labelX = 1110;
      labelY = 320;
    } else if (edge.type === 'spine-right') {
      const x1 = fromNode.x;
      const y1 = fc.y + 10;
      const x2 = toNode.x + NODE_W;
      const y2 = tc.y;
      d = `M ${x1} ${y1} C 1050 260, 960 440, ${x2} ${y2}`;
      labelX = 1000;
      labelY = 390;
    } else if (edge.type === 'spine-down') {
      const x1 = fromNode.x + NODE_W;
      const y1 = fc.y;
      const x2 = tc.x;
      const y2 = toNode.y;
      d = `M ${x1} ${y1} C 1140 360, 1080 540, ${x2} ${y2}`;
      labelX = 1080;
      labelY = 460;
    } else if (edge.type === 'curve-bottom') {
      const x1 = fc.x + 30;
      const y1 = fromNode.y + NODE_H;
      const x2 = tc.x - 30;
      const y2 = toNode.y + NODE_H;
      d = `M ${x1} ${y1} C 540 735, 780 740, ${x2} ${y2}`;
      labelX = 680;
      labelY = 730;
    }

    edgeLines.push(`
      <g class="diag-edge" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}">
        <path class="edge-path" d="${d}" marker-end="url(#diag-arrow)"></path>
      </g>
    `);

    edgeLabels.push(`
      <g class="diag-label" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}">
        <text class="edge-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${escapeHtml(edge.label)}</text>
      </g>
    `);
  });

  const nodeElements = Object.entries(RDBMS_DIAGRAM_COORDS).map(([name, node]) => {
    return `
      <g class="diag-node diag-cat-${escapeHtml(node.cat)}" data-table="${escapeHtml(name)}" transform="translate(${node.x}, ${node.y})">
        <a href="#rel-${escapeHtml(name)}" aria-label="View relation details for ${escapeHtml(name)}">
          <rect class="node-rect" width="${NODE_W}" height="${NODE_H}" rx="8" ry="8"></rect>
          <text class="node-title" x="${NODE_W / 2}" y="23" text-anchor="middle">${escapeHtml(node.label)}</text>
          <text class="node-sub" x="${NODE_W / 2}" y="38" text-anchor="middle">${escapeHtml(node.type)}</text>
        </a>
      </g>
    `;
  }).join('');

  return `
    <div class="erd-diagram-wrapper">
      <div class="erd-toolbar">
        <div class="erd-hint">
          <span class="pulse-dot"></span>
          <span><strong>Interactive Entity Graph:</strong> Hover over any entity box to highlight its direct relationships. Click to inspect full table dictionary below.</span>
        </div>
        <div class="erd-status-display" id="erd-inspector-text">Hover an entity to trace relations</div>
      </div>
      <div class="erd-svg-container">
        <svg class="erd-svg" viewBox="0 0 1260 760" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="diag-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" class="marker-path"></path>
            </marker>
            <marker id="diag-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" class="marker-path-active"></path>
            </marker>
            <filter id="diag-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0e2a47" flood-opacity="0.25"/>
            </filter>
          </defs>

          <!-- 1. Group of connecting relationship lines (background) -->
          <g class="diag-edges-group">
            ${edgeLines.join('')}
          </g>

          <!-- 2. Group of entity nodes/boxes (middle) -->
          <g class="diag-nodes-group">
            ${nodeElements}
          </g>

          <!-- 3. Group of relationship labels (foreground: never obscured by cards) -->
          <g class="diag-labels-group">
            ${edgeLabels.join('')}
          </g>
        </svg>
      </div>
    </div>

    <script>
      (function() {
        const nodes = document.querySelectorAll('.diag-node');
        const edges = document.querySelectorAll('.diag-edge');
        const labels = document.querySelectorAll('.diag-label');
        const inspector = document.getElementById('erd-inspector-text');

        nodes.forEach(node => {
          node.addEventListener('mouseenter', () => {
            const table = node.dataset.table;
            node.classList.add('is-active');
            
            const related = new Set();
            let connectionCount = 0;

            edges.forEach(edge => {
              if (edge.dataset.from === table || edge.dataset.to === table) {
                edge.classList.add('is-active');
                edge.querySelector('.edge-path')?.setAttribute('marker-end', 'url(#diag-arrow-active)');
                related.add(edge.dataset.from);
                related.add(edge.dataset.to);
                connectionCount++;
              } else {
                edge.classList.add('is-dimmed');
              }
            });

            labels.forEach(lbl => {
              if (lbl.dataset.from === table || lbl.dataset.to === table) {
                lbl.classList.add('is-active');
              } else {
                lbl.classList.add('is-dimmed');
              }
            });

            nodes.forEach(n => {
              if (n !== node && !related.has(n.dataset.table)) {
                n.classList.add('is-dimmed');
              } else if (n !== node) {
                n.classList.add('is-neighbor');
              }
            });

            if (inspector) {
              inspector.innerHTML = '<strong>' + table + '</strong>: ' + connectionCount + ' direct relations connected';
            }
          });

          node.addEventListener('mouseleave', () => {
            nodes.forEach(n => n.classList.remove('is-active', 'is-dimmed', 'is-neighbor'));
            edges.forEach(edge => {
              edge.classList.remove('is-active', 'is-dimmed');
              edge.querySelector('.edge-path')?.setAttribute('marker-end', 'url(#diag-arrow)');
            });
            labels.forEach(lbl => lbl.classList.remove('is-active', 'is-dimmed'));
            if (inspector) {
              inspector.textContent = 'Hover an entity to trace relations';
            }
          });
        });
      })();
    </script>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function csrfToken(request) {
  if (!request.session.csrfToken) request.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return request.session.csrfToken;
}

function renderFormToken(request) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken(request))}">`;
}
const csrfField = renderFormToken;

function statusBadge(status) {
  const label = String(status || 'scheduled');
  return `<span class="status-badge status-${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

function formatDateTime(value) {
  return formatDateOnly(value);
}

function formatDateOnly(value) {
  if (!value) return 'Date to be confirmed';
  const raw = typeof value === 'string' ? value.slice(0, 10) : formatDateForInput(value);
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function emptyState(title, message) {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">✦</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
}

function renderPage(request, title, body, options = {}) {
  const user = request.session.user;
  const auth = user
    ? `<form method="post" action="/logout" class="inline">${renderFormToken(request)}<button type="submit">Logout</button></form>`
    : '<a href="/login">Login</a>';
  const roleLinks = user?.role === 'player'
    ? '<a class="nav-role-link" href="/player">My participation</a>'
    : user?.role === 'coordinator'
      ? '<a class="nav-role-link" href="/coordinator">Match control</a>'
      : user?.role === 'admin'
        ? '<a class="nav-role-link" href="/admin">Admin</a><a class="nav-role-link" href="/coordinator">Match control</a>'
        : '';
  const roleBadge = user ? `<span class="nav-role-badge">${escapeHtml(ROLE_LABELS[user.role])}</span>` : '';
  const notice = options.message ? `<div class="alert alert-${escapeHtml(options.tone || 'info')}" role="status"><span>${escapeHtml(options.message)}</span><button class="alert-dismiss" type="button" aria-label="Dismiss message">×</button></div>` : '';
  return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Campus Sports</title><link rel="stylesheet" href="/css/app.css"></head>
  <body><header class="site-header"><div class="header-inner"><a class="brand" href="/"><span class="brand-mark">CS</span><span>Campus Sports<span class="brand-subtitle">Tournament hub</span></span></a><button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">Menu</button><nav class="site-nav"><div class="nav-links"><a href="/events">Events</a><a href="/schedule">Schedule</a><a href="/teams">Teams</a><a href="/points">Points</a><a href="/medals">Medals</a><a href="/design">RDBMS design</a></div><div class="nav-account">${roleLinks}${roleBadge}${auth}</div></nav></div></header><main class="page-shell"><div class="page-heading"><div><p class="eyebrow">Campus Sports 2026</p><h1>${escapeHtml(title)}</h1>${options.subtitle ? `<p class="page-subtitle">${escapeHtml(options.subtitle)}</p>` : ''}</div></div>${notice}${body}</main><footer class="site-footer"><div><strong>Campus Sports Tournament</strong><span>Compete well. Play fair.</span></div><span>College athletics management system</span></footer><script>
  document.querySelector('.nav-toggle')?.addEventListener('click', (event) => { const nav = document.querySelector('.site-nav'); const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!expanded)); nav.classList.toggle('is-open', !expanded); });
  document.querySelectorAll('.alert-dismiss').forEach((button) => button.addEventListener('click', () => button.closest('.alert').remove()));
  const teamDepartment = document.querySelector('#team-department_id');
  const teamCaptain = document.querySelector('#team-captain_id');
  if (teamDepartment && teamCaptain) {
    const filterCaptains = () => {
      const departmentId = teamDepartment.value;
      Array.from(teamCaptain.options).forEach((option) => {
        if (!option.value) { option.hidden = false; return; }
        option.hidden = Boolean(departmentId && option.dataset.departmentId !== departmentId);
      });
      if (teamCaptain.selectedOptions[0]?.hidden) teamCaptain.value = '';
    };
    teamDepartment.addEventListener('change', filterCaptains);
    teamCaptain.addEventListener('change', () => {
      const selected = teamCaptain.selectedOptions[0];
      if (selected?.dataset.departmentId) {
        teamDepartment.value = selected.dataset.departmentId;
        filterCaptains();
      }
    });
    filterCaptains();
  }
  </script></body></html>`;
}

function renderTable(columns, rows, actions = () => '', rowAttributes = () => '') {
  const header = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row, index) => `<tr ${rowAttributes(row, index)}>${columns.map((column) => `<td>${escapeHtml(formatDisplayValue(column.name, row[column.name]))}</td>`).join('')}${actions(row, index)}</tr>`).join('');
  return `<table><thead><tr>${header}</tr></thead><tbody>${body || '<tr><td colspan="20">No records found.</td></tr>'}</tbody></table>`;
}

function formatDisplayValue(name, value) {
  if (value === null || value === undefined) return '';
  if (name === 'date_of_birth' || name === 'starts_at' || name === 'awarded_at') {
    return typeof value === 'string' ? value.slice(0, 10) : formatDateForInput(value);
  }
  return String(value);
}

function formatDateForInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeLocalForInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatInputValue(type, value) {
  if (value === null || value === undefined || type === 'password') return '';
  if (type === 'date') {
    if (typeof value === 'string') return value.slice(0, 10);
    return formatDateForInput(value);
  }
  if (type === 'datetime-local') {
    if (typeof value === 'string') return value.replace(' ', 'T').slice(0, 16);
    return formatDateTimeLocalForInput(value);
  }
  return String(value);
}

function renderForm(request, action, fields, submitLabel = 'Save', values = {}) {
  const controls = fields.map(([name, label, type]) => {
    const value = formatInputValue(type, values[name]);
    return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${name.endsWith('_id') ? 'min="1"' : ''}></label>`;
  }).join('');
  return `<form method="post" action="${escapeHtml(action)}">${renderFormToken(request)}${controls}<button type="submit">${escapeHtml(submitLabel)}</button></form>`;
}

function renderChoiceForm(request, action, fields, submitLabel, values = {}) {
  const controls = fields.map(([name, label, input, optional = false]) => {
    if (typeof input === 'string') {
      return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${escapeHtml(input)}" value="${escapeHtml(formatInputValue(input, values[name]))}"${optional ? '' : ' required'}></label>`;
    }
    const options = input;
    const selected = values[name] === null || values[name] === undefined ? '' : String(values[name]);
    const choices = options.map((option) => `<option value="${escapeHtml(option.id)}"${String(option.id) === selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}"${optional ? '' : ' required'}>${optional ? '<option value="">Not assigned</option>' : '<option value="">Choose an option</option>'}${choices}</select></label>`;
  }).join('');
  return `<form method="post" action="${escapeHtml(action)}">${renderFormToken(request)}${controls}<button type="submit">${escapeHtml(submitLabel)}</button></form>`;
}

function renderSelect(request, action, name, label, options, submitLabel = 'Save') {
  return `<form method="post" action="${escapeHtml(action)}">${renderFormToken(request)}
    <label>${escapeHtml(label)}<select name="${escapeHtml(name)}" required>${options}</select></label>
    <button type="submit">${escapeHtml(submitLabel)}</button></form>`;
}

async function loadAdminOptions(resourceKey) {
  const references = ADMIN_REFERENCES[resourceKey] || {};
  const options = {};
  for (const [field, reference] of Object.entries(references)) {
    const [rows] = await pool.query(reference.query);
    options[field] = rows;
  }
  return options;
}

async function renderAdminForm(request, resourceKey, action, submitLabel, values = {}) {
  const resource = ADMIN_RESOURCES[resourceKey];
  const options = await loadAdminOptions(resourceKey);
  const controls = resource.fields.map(([name, label, type]) => {
    if (options[name]) {
      const selected = values[name] === null || values[name] === undefined ? '' : String(values[name]);
      const choices = options[name].map((option) => `<option value="${escapeHtml(option.id)}"${option.department_id ? ` data-department-id="${escapeHtml(option.department_id)}"` : ''}${String(option.id) === selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
      const optional = label.includes('optional');
      const teamField = resourceKey === 'teams' ? ` id="team-${escapeHtml(name)}"` : '';
      return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}"${teamField}${optional ? '' : ' required'}>${optional ? '<option value="">Not assigned</option>' : '<option value="">Choose an option</option>'}${choices}</select></label>`;
    }
    const value = formatInputValue(type, values[name]);
    return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${name.endsWith('_id') ? 'min="1"' : ''}></label>`;
  }).join('');
  return `<form method="post" action="${escapeHtml(action)}">${renderFormToken(request)}${controls}<button type="submit">${escapeHtml(submitLabel)}</button></form>`;
}

async function decorateAdminRows(resourceKey, rows) {
  const options = await loadAdminOptions(resourceKey);
  return rows.map((row) => {
    const decorated = { ...row };
    for (const [field, values] of Object.entries(options)) {
      const match = values.find((option) => String(option.id) === String(row[field]));
      decorated[field] = match ? match.label : '';
    }
    return decorated;
  });
}

function humanDatabaseError(error) {
  const messages = {
    3819: 'The submitted values violate a database CHECK rule.',
    1048: 'A required field is missing. Fill all required fields and try again.',
    1062: 'That record already exists. Use a different unique value.',
    1292: 'A date, time, or number format is invalid.',
    1366: 'One of the entered values has an invalid format.',
    1451: 'This record is still referenced by other tournament data.',
    1452: 'One of the referenced records does not exist.',
    1644: error.sqlMessage || 'The database rejected this operation because of a tournament rule.'
  };
  return messages[error.errno] || 'The database rejected this operation. Check the submitted values and try again.';
}

function requireAuth(request, response, next) {
  if (!request.session.user) return response.redirect(`/login?next=${encodeURIComponent(request.originalUrl)}`);
  next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.session.user) return response.redirect('/login');
    if (!roles.includes(request.session.user.role)) return response.status(403).send(renderPage(request, 'Access denied', '<p>Your role cannot access this page.</p>'));
    next();
  };
}

function validateCsrf(request, response, next) {
  if (request.method === 'POST' && (!request.body._csrf || request.body._csrf !== request.session.csrfToken)) {
    return response.status(403).send(renderPage(request, 'Invalid form', '<p>This form expired. Go back and try again.</p>'));
  }
  next();
}

function parseOptionalInteger(value) {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

async function readView(viewName, orderBy) {
  const [rows] = await pool.query(`SELECT * FROM ${viewName} ${orderBy}`);
  return rows;
}

app.use(validateCsrf);

app.get('/login', (request, response) => {
  response.send(renderPage(request, 'Sign in', `<section class="auth-layout"><div class="auth-intro"><p class="eyebrow">Tournament management</p><h2>Manage your tournament account.</h2><p>Sign in to access registrations, fixtures, scores, and administration.</p></div><form class="card form-card auth-card" method="post" action="/login">${renderFormToken(request)}
    <label>Username<input name="username" required autocomplete="username"></label>
    <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
    <input type="hidden" name="next" value="${escapeHtml(request.query.next || '/')}">
    <button class="button button-primary" type="submit">Sign in</button></form></section>`, { subtitle: 'Use your campus sports account' }));
});

app.post('/login', async (request, response, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT app_user_id, username, password_hash, role, student_id FROM app_user WHERE username = ?',
      [String(request.body.username || '').trim()]
    );
    const account = rows[0];
    if (!account || !(await bcrypt.compare(String(request.body.password || ''), account.password_hash))) {
      return response.status(401).send(renderPage(request, 'Login failed', '<p>Username or password is incorrect.</p>'));
    }
    request.session.regenerate((error) => {
      if (error) return next(error);
      request.session.user = {
        id: account.app_user_id,
        username: account.username,
        role: account.role,
        studentId: account.student_id
      };
      request.session.csrfToken = crypto.randomBytes(32).toString('hex');
      response.redirect(typeof request.body.next === 'string' && request.body.next.startsWith('/') ? request.body.next : '/');
    });
  } catch (error) {
    next(error);
  }
});

app.post('/logout', requireAuth, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.redirect('/');
  });
});

function getSportIcon(sportName = '') {
  const lower = String(sportName).toLowerCase();
  if (lower.includes('foot') || lower.includes('soccer')) return '⚽';
  if (lower.includes('basket')) return '🏀';
  if (lower.includes('cricket')) return '🏏';
  if (lower.includes('100') || lower.includes('sprint') || lower.includes('metre') || lower.includes('track') || lower.includes('run')) return '🏃';
  if (lower.includes('volley')) return '🏐';
  if (lower.includes('badminton')) return '🏸';
  if (lower.includes('tennis')) return '🎾';
  return '🏆';
}

function renderEventCards(events) {
  if (!events || !events.length) {
    return emptyState('No events found', 'There are no events registered yet.');
  }
  return `<div class="events-grid">${events.map((e) => {
    const isTeam = Boolean(e.is_team_sport);
    let matchPill = '';
    if (isTeam) {
      if (!e.match_count) {
        matchPill = '<span class="status-pill status-muted">No fixtures yet</span>';
      } else if (e.live_matches > 0) {
        matchPill = `<span class="status-pill status-live-pill">⚡ ${e.live_matches} Live</span>`;
      } else if (e.scheduled_matches > 0) {
        matchPill = `<span class="status-pill status-scheduled-pill">${e.scheduled_matches} Scheduled · ${e.completed_matches || 0} Done</span>`;
      } else {
        matchPill = `<span class="status-pill status-completed-pill">${e.completed_matches || 0} Completed</span>`;
      }
    } else {
      matchPill = '<span class="status-pill status-info-pill">Heats & Results</span>';
    }

    return `
      <article class="event-card">
        <div class="event-card-header">
          <div class="event-sport-mark">
            <span class="sport-emoji">${getSportIcon(e.sport_name)}</span>
            <div>
              <span class="event-sport-title">${escapeHtml(e.sport_name)}</span>
              <small class="event-tournament-label">${escapeHtml(e.tournament_name || 'Tournament')}</small>
            </div>
          </div>
          <span class="event-format-badge">${escapeHtml(String(e.format || '').replace('_', ' '))}</span>
        </div>
        <div class="event-card-body">
          <h2 class="event-card-title"><a href="/events/${e.event_id}">${escapeHtml(e.event_name || e.name)}</a></h2>
          <div class="event-meta-tags">
            <span class="event-meta-tag category-tag">${escapeHtml(e.gender_category || 'Open')}</span>
            <span class="event-meta-tag type-tag">${isTeam ? 'Team Sport' : 'Individual'}</span>
          </div>
          <div class="event-metrics-grid">
            <div class="event-metric">
              <span class="metric-num">${e.participant_count || 0}</span>
              <span class="metric-lbl">${isTeam ? 'Teams' : 'Athletes'}</span>
            </div>
            <div class="event-metric">
              <span class="metric-num">${e.stage_count || 0}</span>
              <span class="metric-lbl">${isTeam ? 'Stages' : 'Heats'}</span>
            </div>
            <div class="event-metric">
              <span class="metric-num">${isTeam ? (e.match_count || 0) : '—'}</span>
              <span class="metric-lbl">${isTeam ? 'Matches' : 'Individual'}</span>
            </div>
          </div>
          <div class="event-status-row">
            ${matchPill}
          </div>
        </div>
        <div class="event-card-footer">
          <a href="/events/${e.event_id}" class="button button-primary event-action-btn">View groups & matches →</a>
        </div>
      </article>
    `;
  }).join('')}</div>`;
}

app.get('/', async (request, response, next) => {
  try {
    const [events] = await pool.query(
      `SELECT e.event_id, e.name AS event_name, e.gender_category, e.format,
              s.sport_id, s.name AS sport_name, s.is_team_sport,
              t.tournament_id, t.name AS tournament_name,
              (SELECT COUNT(DISTINCT stage_id) FROM stage WHERE event_id = e.event_id) AS stage_count,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id) AS match_count,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'completed') AS completed_matches,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'live') AS live_matches,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'scheduled') AS scheduled_matches,
              (SELECT COUNT(*) FROM registration WHERE event_id = e.event_id) AS participant_count
       FROM \`event\` e
       JOIN sport s ON s.sport_id = e.sport_id
       JOIN tournament t ON t.tournament_id = e.tournament_id
       ORDER BY e.event_id`
    );

    const body = `
      <section class="landing-notice">
        <strong>Public tournament information</strong>
        <span>Explore ongoing competitions, view round-robin groups, track schedules, and review live standings. Editing is restricted to coordinators and administrators.</span>
      </section>
      <section class="insight-links">
        <a class="insight-link" href="/events">
          <span class="insight-icon">🏆</span>
          <span><strong>All Events</strong><small>Check every sport event, its groups, and matches.</small></span>
          <b>→</b>
        </a>
        <a class="insight-link" href="/schedule">
          <span class="insight-icon">📅</span>
          <span><strong>Match schedule</strong><small>Timeline of live, scheduled, and completed fixtures.</small></span>
          <b>→</b>
        </a>
        <a class="insight-link" href="/points">
          <span class="insight-icon">📊</span>
          <span><strong>Points table</strong><small>Group standings, goals, and team rankings.</small></span>
          <b>→</b>
        </a>
        <a class="insight-link" href="/medals">
          <span class="insight-icon">★</span>
          <span><strong>Medal tally</strong><small>Department awards from completed finals.</small></span>
          <b>→</b>
        </a>
      </section>
      <section class="card" style="margin-top: var(--space-5);">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Active competitions</p>
            <h2>Ongoing Events</h2>
            <p class="muted">Select any event below to open its dedicated groups, standings, and match fixtures.</p>
          </div>
          <a href="/events" class="button button-secondary">View all events →</a>
        </div>
        ${renderEventCards(events)}
      </section>
    `;

    response.send(renderPage(request, 'Tournament overview', body, {
      subtitle: 'Official Campus Sports Tournament hub and competition engine.'
    }));
  } catch (error) { next(error); }
});

app.get('/events', async (request, response, next) => {
  try {
    const [events] = await pool.query(
      `SELECT e.event_id, e.name AS event_name, e.gender_category, e.format,
              s.sport_id, s.name AS sport_name, s.is_team_sport,
              t.tournament_id, t.name AS tournament_name,
              (SELECT COUNT(DISTINCT stage_id) FROM stage WHERE event_id = e.event_id) AS stage_count,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id) AS match_count,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'completed') AS completed_matches,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'live') AS live_matches,
              (SELECT COUNT(*) FROM \`match\` m JOIN stage st ON st.stage_id = m.stage_id WHERE st.event_id = e.event_id AND m.status = 'scheduled') AS scheduled_matches,
              (SELECT COUNT(*) FROM registration WHERE event_id = e.event_id) AS participant_count
       FROM \`event\` e
       JOIN sport s ON s.sport_id = e.sport_id
       JOIN tournament t ON t.tournament_id = e.tournament_id
       ORDER BY e.event_id`
    );

    const sportFilter = request.query.sport ? String(request.query.sport).trim().toLowerCase() : '';
    const filteredEvents = sportFilter
      ? events.filter((e) => e.sport_name.toLowerCase() === sportFilter)
      : events;

    const sportsList = [...new Set(events.map((e) => e.sport_name))];
    const filterButtons = [
      `<a href="/events" class="filter-btn ${!sportFilter ? 'active' : ''}">All Sports (${events.length})</a>`,
      ...sportsList.map((sport) => {
        const count = events.filter((e) => e.sport_name === sport).length;
        const isActive = sportFilter === sport.toLowerCase();
        return `<a href="/events?sport=${encodeURIComponent(sport.toLowerCase())}" class="filter-btn ${isActive ? 'active' : ''}">${getSportIcon(sport)} ${escapeHtml(sport)} (${count})</a>`;
      })
    ].join('');

    const body = `
      <section class="events-hub-intro">
        <div class="event-filter-bar">${filterButtons}</div>
      </section>
      ${renderEventCards(filteredEvents)}
    `;

    response.send(renderPage(request, 'Tournament events', body, {
      subtitle: 'Browse competitions by sport, check their stage groups, standings, and match fixtures.'
    }));
  } catch (error) { next(error); }
});

app.get('/events/:id', async (request, response, next) => {
  try {
    const eventId = Number(request.params.id);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return response.status(404).send(renderPage(request, 'Event not found', '<p>No such event exists.</p>'));
    }

    const [eventRows] = await pool.execute(
      `SELECT e.event_id, e.name AS event_name, e.gender_category, e.format,
              s.sport_id, s.name AS sport_name, s.is_team_sport,
              t.tournament_id, t.name AS tournament_name, t.start_date, t.end_date
       FROM \`event\` e
       JOIN sport s ON s.sport_id = e.sport_id
       JOIN tournament t ON t.tournament_id = e.tournament_id
       WHERE e.event_id = ?`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) return response.status(404).send(renderPage(request, 'Event not found', '<p>No such event exists.</p>'));

    const isTeam = Boolean(event.is_team_sport);

    const [stages] = await pool.execute(
      `SELECT st.stage_id, st.name AS stage_name, st.stage_type, st.stage_order,
              COUNT(m.match_id) AS match_count
       FROM stage st
       LEFT JOIN \`match\` m ON m.stage_id = st.stage_id
       WHERE st.event_id = ?
       GROUP BY st.stage_id, st.name, st.stage_type, st.stage_order
       ORDER BY st.stage_order, st.stage_id`,
      [eventId]
    );

    const [matches] = await pool.execute(
      `SELECT m.match_id, m.stage_id, st.name AS stage_name, st.stage_type, st.stage_order,
              m.starts_at, m.duration_minutes, m.status,
              m.home_score, m.away_score,
              home.team_id AS home_team_id, home.name AS home_team,
              away.team_id AS away_team_id, away.name AS away_team,
              v.name AS venue_name
       FROM \`match\` m
       JOIN stage st ON st.stage_id = m.stage_id
       JOIN team home ON home.team_id = m.home_team_id
       JOIN team away ON away.team_id = m.away_team_id
       JOIN venue v ON v.venue_id = m.venue_id
       WHERE st.event_id = ?
       ORDER BY st.stage_order, m.starts_at, m.match_id`,
      [eventId]
    );

    let teams = [];
    let students = [];
    if (isTeam) {
      const [teamRows] = await pool.execute(
        `SELECT r.registration_id, r.status, t.team_id, t.name AS team_name, d.name AS department_name,
                s.full_name AS captain_name, s.roll_number AS captain_roll
         FROM registration r
         JOIN team t ON t.team_id = r.team_id
         JOIN department d ON d.department_id = t.department_id
         LEFT JOIN student s ON s.student_id = t.captain_id
         WHERE r.event_id = ?
         ORDER BY t.name`,
        [eventId]
      );
      teams = teamRows;
    } else {
      const [studentRows] = await pool.execute(
        `SELECT r.registration_id, r.status, s.student_id, s.full_name, s.roll_number, d.name AS department_name
         FROM registration r
         JOIN student s ON s.student_id = r.student_id
         JOIN department d ON d.department_id = s.department_id
         WHERE r.event_id = ?
         ORDER BY s.full_name`,
        [eventId]
      );
      students = studentRows;
    }

    let standingsRows = [];
    let individualResults = [];
    if (isTeam) {
      const [points] = await pool.execute(
        `SELECT * FROM v_points_table WHERE event_id = ? ORDER BY stage_id, points_position`,
        [eventId]
      );
      standingsRows = points;
    } else {
      const [results] = await pool.execute(
        `SELECT ir.individual_result_id, ir.result_value, ir.result_unit, ir.result_rank,
                st.stage_id, st.name AS stage_name, s.full_name, s.roll_number, d.name AS department_name,
                v.name AS venue_name
         FROM individual_result ir
         JOIN stage st ON st.stage_id = ir.stage_id
         JOIN registration r ON r.registration_id = ir.registration_id
         JOIN student s ON s.student_id = r.student_id
         JOIN department d ON d.department_id = s.department_id
         LEFT JOIN venue v ON v.venue_id = ir.venue_id
         WHERE r.event_id = ?
         ORDER BY st.stage_order, ir.result_rank, ir.result_value`,
        [eventId]
      );
      individualResults = results;
    }

    const participantCount = isTeam ? teams.length : students.length;
    const completedMatches = matches.filter((m) => m.status === 'completed').length;

    const heroActions = [];
    if (request.session.user?.role === 'admin') {
      heroActions.push(`<a href="/admin/events/${eventId}/setup" class="button button-primary">Configure Event & Teams ↗</a>`);
    }
    if (request.session.user?.role === 'coordinator' || request.session.user?.role === 'admin') {
      heroActions.push(`<a href="/coordinator" class="button button-secondary">Match Control ↗</a>`);
    }

    const hero = `
      <section class="event-detail-hero">
        <div class="event-hero-top">
          <div>
            <p class="eyebrow" style="color: var(--accent);">${escapeHtml(event.tournament_name)} · ${escapeHtml(event.sport_name)}</p>
            <h1>${escapeHtml(event.event_name)}</h1>
            <div class="event-hero-badges">
              <span class="event-hero-badge">${getSportIcon(event.sport_name)} ${escapeHtml(event.sport_name)}</span>
              <span class="event-hero-badge">Format: ${escapeHtml(event.format.replace('_', ' '))}</span>
              <span class="event-hero-badge">Category: ${escapeHtml(event.gender_category)}</span>
              <span class="event-hero-badge">${isTeam ? 'Team Sport' : 'Individual'}</span>
            </div>
          </div>
          ${heroActions.length ? `<div class="event-hero-actions">${heroActions.join('')}</div>` : ''}
        </div>
        <div class="event-hero-stats">
          <div class="event-hero-stat">
            <strong>${participantCount}</strong>
            <span>${isTeam ? 'Registered Teams' : 'Athletes'}</span>
          </div>
          <div class="event-hero-stat">
            <strong>${stages.length}</strong>
            <span>${isTeam ? 'Competition Stages' : 'Heats'}</span>
          </div>
          <div class="event-hero-stat">
            <strong>${isTeam ? matches.length : individualResults.length}</strong>
            <span>${isTeam ? 'Total Matches' : 'Results Logged'}</span>
          </div>
          ${isTeam && matches.length ? `
            <div class="event-hero-stat">
              <strong>${completedMatches} / ${matches.length}</strong>
              <span>Completed</span>
            </div>
          ` : ''}
        </div>
      </section>
    `;

    const subnav = `
      <nav class="event-subnav" aria-label="Event Sections">
        <a href="#section-groups" class="event-subnav-link">◫ ${isTeam ? 'Groups & Standings' : 'Heats & Rankings'}</a>
        <a href="#section-matches" class="event-subnav-link">⚡ ${isTeam ? `Matches (${matches.length})` : 'Schedule'}</a>
        <a href="#section-participants" class="event-subnav-link">👥 ${isTeam ? `Teams (${teams.length})` : `Athletes (${students.length})`}</a>
      </nav>
    `;

    let groupsContent = '';
    if (isTeam) {
      if (stages.length === 0) {
        groupsContent = emptyState('No groups created yet', 'The administrator has not configured stages for this event yet.');
      } else {
        const groupCards = stages.map((stage) => {
          const stageStandings = standingsRows.filter((r) => r.stage_id === stage.stage_id);
          const stageMatches = matches.filter((m) => m.stage_id === stage.stage_id);
          
          let bodyHtml = '';
          if (stageStandings.length > 0) {
            bodyHtml = renderTable([
              { name: 'points_position', label: 'Pos' },
              { name: 'team_name', label: 'Team' },
              { name: 'played', label: 'P' },
              { name: 'won', label: 'W' },
              { name: 'drawn', label: 'D' },
              { name: 'lost', label: 'L' },
              { name: 'goal_difference', label: 'GD' },
              { name: 'points', label: 'Pts' }
            ], stageStandings);
          } else {
            const registeredTags = teams.map((t) => `<span class="group-team-tag"><strong>${escapeHtml(t.team_name)}</strong><small>${escapeHtml(t.department_name)}</small></span>`).join('');
            bodyHtml = `
              <div class="event-group-empty">
                <p><strong>Fixtures generated (${stageMatches.length} matches scheduled)</strong></p>
                <p class="muted">Standings table will update automatically as matches conclude and scores are recorded.</p>
                <div class="group-team-tags">${registeredTags || '<span class="muted">No teams registered.</span>'}</div>
              </div>
            `;
          }

          return `
            <div class="event-group-card">
              <div class="event-group-card-header">
                <div>
                  <p class="eyebrow">${escapeHtml(stage.stage_type.replace('_', ' '))}</p>
                  <h3>${escapeHtml(stage.stage_name)}</h3>
                </div>
                <span class="relationship-pill">${stageMatches.length} Matches</span>
              </div>
              ${bodyHtml}
            </div>
          `;
        }).join('');
        groupsContent = `<div class="event-group-container">${groupCards}</div>`;
      }
    } else {
      if (stages.length === 0) {
        groupsContent = emptyState('No heats created yet', 'No heat stages created for this individual event.');
      } else {
        const heatCards = stages.map((stage) => {
          const heatResults = individualResults.filter((r) => r.stage_id === stage.stage_id);
          let bodyHtml = '';
          if (heatResults.length > 0) {
            bodyHtml = renderTable([
              { name: 'result_rank', label: 'Rank' },
              { name: 'full_name', label: 'Athlete' },
              { name: 'roll_number', label: 'Roll No' },
              { name: 'department_name', label: 'Department' },
              { name: 'result_value', label: 'Result' },
              { name: 'result_unit', label: 'Unit' },
              { name: 'venue_name', label: 'Venue' }
            ], heatResults);
          } else {
            bodyHtml = `<div class="event-group-empty"><p class="muted">No athlete results recorded yet for this heat stage.</p></div>`;
          }

          return `
            <div class="event-group-card">
              <div class="event-group-card-header">
                <div>
                  <p class="eyebrow">Individual Stage</p>
                  <h3>${escapeHtml(stage.stage_name)}</h3>
                </div>
                <span class="relationship-pill">${heatResults.length} Results</span>
              </div>
              ${bodyHtml}
            </div>
          `;
        }).join('');
        groupsContent = `<div class="event-group-container">${heatCards}</div>`;
      }
    }

    const groupsSection = `
      <section id="section-groups" class="card" style="margin-bottom: var(--space-5);">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Competition Stages</p>
            <h2>${isTeam ? 'Groups & Standings' : 'Heats & Rankings'}</h2>
            <p class="muted">${isTeam ? 'Official group standings and progression stages for this event.' : 'Heat stages, recorded student results, and official ranks.'}</p>
          </div>
        </div>
        ${groupsContent}
      </section>
    `;

    let matchesContent = '';
    if (isTeam) {
      if (matches.length === 0) {
        matchesContent = emptyState('No matches generated', 'No fixtures have been generated for this event yet.');
      } else {
        const matchCards = matches.map((m) => {
          const isFinished = m.status === 'completed';
          const isLive = m.status === 'live';
          const scoreDisplay = isFinished || isLive ? `${m.home_score} – ${m.away_score}` : 'VS';
          
          let controlLink = '';
          if (request.session.user?.role === 'coordinator' || request.session.user?.role === 'admin') {
            controlLink = `<div style="margin-top: .6rem; padding-top: .5rem; border-top: 1px solid var(--line); text-align: right;"><a href="/coordinator/matches/${m.match_id}" class="button button-secondary table-action">${isFinished ? 'View result' : 'Open match control'}</a></div>`;
          }

          return `
            <article class="match-card">
              <div class="match-meta">
                <span class="relationship-pill">${escapeHtml(m.stage_name)}</span>
                ${statusBadge(m.status)}
              </div>
              <div class="match-teams">
                <strong>${escapeHtml(m.home_team)}</strong>
                <span class="versus ${isLive ? 'status-live-pill' : ''}">${scoreDisplay}</span>
                <strong>${escapeHtml(m.away_team)}</strong>
              </div>
              <div class="match-details">
                <span>◷ ${escapeHtml(formatDateTime(m.starts_at))}</span>
                <span>⌖ ${escapeHtml(m.venue_name)}</span>
              </div>
              ${controlLink}
            </article>
          `;
        }).join('');
        matchesContent = `<div class="schedule-grid">${matchCards}</div>`;
      }
    } else {
      matchesContent = `<div class="empty-state"><span class="empty-icon">🏃</span><p class="muted">Individual athletics events use heat results and times rather than home/away team fixtures. View results in the section above.</p></div>`;
    }

    const matchesSection = `
      <section id="section-matches" class="card" style="margin-bottom: var(--space-5);">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Match Fixtures</p>
            <h2>${escapeHtml(event.event_name)} Schedule & Results</h2>
            <p class="muted">All scheduled, live, and completed matches for this event.</p>
          </div>
          ${isTeam && matches.length ? `<span class="relationship-pill">${matches.length} Total Matches</span>` : ''}
        </div>
        ${matchesContent}
      </section>
    `;

    let participantsContent = '';
    if (isTeam) {
      if (teams.length === 0) {
        participantsContent = emptyState('No teams registered', 'No teams have registered for this event yet.');
      } else {
        const teamCards = teams.map((t) => `
          <a class="team-card" href="/teams/${t.team_id}">
            <div class="team-avatar">${escapeHtml(t.team_name.slice(0, 2).toUpperCase())}</div>
            <div>
              <p class="eyebrow">${escapeHtml(t.department_name)}</p>
              <h2>${escapeHtml(t.team_name)}</h2>
              <p class="muted">Status: ${escapeHtml(t.status)}</p>
            </div>
            <div class="team-captain">
              <span>Captain</span>
              <strong>${escapeHtml(t.captain_name || 'Not assigned')}</strong>
              ${t.captain_roll ? `<small>${escapeHtml(t.captain_roll)}</small>` : ''}
              <span class="team-card-link">View team roster →</span>
            </div>
          </a>
        `).join('');
        participantsContent = `<div class="team-grid">${teamCards}</div>`;
      }
    } else {
      if (students.length === 0) {
        participantsContent = emptyState('No athletes registered', 'No students have been registered for this event yet.');
      } else {
        const studentCards = students.map((s) => `
          <div class="entrant-card">
            <strong>${escapeHtml(s.full_name)}</strong>
            <span>${escapeHtml(s.roll_number)}</span>
            <small>${escapeHtml(s.department_name)}</small>
          </div>
        `).join('');
        participantsContent = `<div class="entrant-grid">${studentCards}</div>`;
      }
    }

    const participantsSection = `
      <section id="section-participants" class="card" style="margin-bottom: var(--space-5);">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Contenders</p>
            <h2>${isTeam ? 'Participating Teams' : 'Registered Athletes'}</h2>
            <p class="muted">All registered contenders competing for the championship in this event.</p>
          </div>
          <span class="relationship-pill">${participantCount} Registered</span>
        </div>
        ${participantsContent}
      </section>
    `;

    const body = `
      ${hero}
      ${subnav}
      ${groupsSection}
      ${matchesSection}
      ${participantsSection}
      <p style="margin-top: var(--space-4);"><a href="/events">← Back to all events</a> · <a href="/schedule">View global schedule</a> · <a href="/points">View all standings</a></p>
    `;

    response.send(renderPage(request, event.event_name, body, {
      subtitle: `${event.sport_name} tournament competition details, groups, and matches.`
    }));
  } catch (error) { next(error); }
});

app.get('/schedule', async (request, response, next) => {
  try {
    const selectedEventId = parseOptionalInteger(request.query.event) || parseOptionalInteger(request.query.event_id);

    const [allEvents] = await pool.query(
      `SELECT e.event_id, e.name AS event_name, s.name AS sport_name,
              COUNT(m.match_id) AS match_count
       FROM \`event\` e
       JOIN sport s ON s.sport_id = e.sport_id
       LEFT JOIN stage st ON st.event_id = e.event_id
       LEFT JOIN \`match\` m ON m.stage_id = st.stage_id
       WHERE s.is_team_sport = TRUE
       GROUP BY e.event_id, e.name, s.name
       ORDER BY e.name`
    );

    let query = `
      SELECT m.match_id, e.event_id, e.name AS event_name, st.name AS stage_name, m.starts_at, m.status,
             m.home_score, m.away_score, home.team_id AS home_team_id, home.name AS home_team,
             away.team_id AS away_team_id, away.name AS away_team, v.name AS venue_name
      FROM \`match\` m
      JOIN stage st ON st.stage_id = m.stage_id
      JOIN \`event\` e ON e.event_id = st.event_id
      JOIN team home ON home.team_id = m.home_team_id
      JOIN team away ON away.team_id = m.away_team_id
      JOIN venue v ON v.venue_id = m.venue_id
    `;
    const params = [];
    if (selectedEventId) {
      query += ' WHERE e.event_id = ?';
      params.push(selectedEventId);
    }
    query += ` ORDER BY CASE m.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'cancelled' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
              m.starts_at DESC, m.match_id DESC`;

    const [rows] = await pool.execute(query, params);

    const totalMatchesCount = allEvents.reduce((sum, e) => sum + Number(e.match_count), 0);
    const filterButtons = [
      `<a href="/schedule" class="filter-btn ${!selectedEventId ? 'active' : ''}">All Matches (${totalMatchesCount})</a>`,
      ...allEvents.map((e) => `<a href="/schedule?event=${e.event_id}" class="filter-btn ${selectedEventId === e.event_id ? 'active' : ''}">${getSportIcon(e.sport_name)} ${escapeHtml(e.event_name)} (${e.match_count})</a>`)
    ].join('');

    let banner = '';
    if (selectedEventId) {
      const selectedEvent = allEvents.find((e) => e.event_id === selectedEventId);
      if (selectedEvent) {
        banner = `
          <div class="schedule-event-banner">
            <div>
              <span>Viewing schedule for</span>
              <strong>${escapeHtml(selectedEvent.event_name)}</strong>
              <small class="muted" style="margin-left: .5rem;">(${rows.length} match${rows.length === 1 ? '' : 'es'})</small>
            </div>
            <a href="/events/${selectedEventId}" class="button button-secondary" style="font-size: .82rem;">View Event Groups & Standings →</a>
          </div>
        `;
      }
    }

    const grouped = rows.reduce((dates, row) => {
      const date = new Date(row.starts_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      (dates[date] ||= []).push(row);
      return dates;
    }, {});

    const cards = Object.entries(grouped).map(([date, matches]) => `
      <section class="schedule-day">
        <h2>${escapeHtml(date)}</h2>
        <div class="schedule-grid">${matches.map((row) => `
          <article class="match-card">
            <div class="match-meta">
              <a href="/events/${row.event_id}" class="match-event-link" title="Open ${escapeHtml(row.event_name)} event page">${escapeHtml(row.event_name)}</a>
              ${statusBadge(row.status)}
            </div>
            <div class="match-teams">
              <strong>${escapeHtml(row.home_team)}</strong>
              <span class="versus">${row.status === 'completed' || row.status === 'live' ? `${escapeHtml(row.home_score)} – ${escapeHtml(row.away_score)}` : 'VS'}</span>
              <strong>${escapeHtml(row.away_team)}</strong>
            </div>
            <div class="match-details">
              <span>◷ ${escapeHtml(formatDateTime(row.starts_at))}</span>
              <span>⌖ ${escapeHtml(row.venue_name)}</span>
            </div>
            <div class="match-stage">${escapeHtml(row.stage_name)}</div>
          </article>
        `).join('')}</div>
      </section>
    `).join('');

    const body = `
      <div class="event-filter-bar">${filterButtons}</div>
      ${banner}
      ${cards || emptyState('No matches scheduled', selectedEventId ? 'No fixtures found for this event.' : 'The schedule will appear here when fixtures are published.')}
    `;

    response.send(renderPage(request, 'Match schedule', body, {
      subtitle: 'See scheduled, live, completed, and cancelled matches with their current scores.'
    }));
  } catch (error) { next(error); }
});

app.get('/teams', async (request, response, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.team_id, t.name AS team_name, d.name AS department_name, s.full_name AS captain_name, s.roll_number,
              COUNT(tm.student_id) AS member_count
       FROM team t JOIN department d ON d.department_id = t.department_id
       LEFT JOIN student s ON s.student_id = t.captain_id
       LEFT JOIN team_member tm ON tm.team_id = t.team_id
       GROUP BY t.team_id, t.name, d.name, s.full_name, s.roll_number
       ORDER BY t.name`
    );
    const cards = rows.map((row) => `<a class="team-card" href="/teams/${row.team_id}" aria-label="View members of ${escapeHtml(row.team_name)}"><div class="team-avatar">${escapeHtml(row.team_name.slice(0, 2).toUpperCase())}</div><div><p class="eyebrow">${escapeHtml(row.department_name)}</p><h2>${escapeHtml(row.team_name)}</h2><p class="muted">${escapeHtml(row.member_count)} registered members</p></div><div class="team-captain"><span>Captain</span><strong>${escapeHtml(row.captain_name || 'Not assigned')}</strong>${row.roll_number ? `<small>${escapeHtml(row.roll_number)}</small>` : ''}<span class="team-card-link">View full roster →</span></div></a>`).join('');
    response.send(renderPage(request, 'Teams', cards ? `<div class="team-grid">${cards}</div>` : emptyState('No teams yet', 'Teams will appear here once they are registered.'), { subtitle: 'Meet the departments competing this season.' }));
  } catch (error) { next(error); }
});

app.get('/teams/:id', async (request, response, next) => {
  try {
    const teamId = Number(request.params.id);
    if (!Number.isInteger(teamId) || teamId < 1) return response.status(404).send(renderPage(request, 'Team not found', '<p>No such team.</p>'));
    const [teams] = await pool.execute(
      `SELECT t.team_id, t.department_id, t.name AS team_name, d.name AS department_name, s.full_name AS captain_name, s.roll_number AS captain_roll
       FROM team t JOIN department d ON d.department_id = t.department_id
       LEFT JOIN student s ON s.student_id = t.captain_id
       WHERE t.team_id = ?`,
      [teamId]
    );
    if (!teams[0]) return response.status(404).send(renderPage(request, 'Team not found', '<p>No such team.</p>'));
    const [members] = await pool.execute(
      `SELECT s.student_id, s.full_name, s.roll_number, s.academic_year, tm.jersey_number
       FROM team_member tm JOIN student s ON s.student_id = tm.student_id
       WHERE tm.team_id = ? ORDER BY tm.jersey_number IS NULL, tm.jersey_number, s.full_name`,
      [teamId]
    );
    const team = teams[0];
    const canEdit = request.session.user && (request.session.user.role === 'admin' || request.session.user.role === 'coordinator');

    const memberRows = members.map((member) => {
      const removeBtn = canEdit ? `
        <td style="text-align: right;">
          <form method="post" action="/teams/${teamId}/members/${member.student_id}/remove" style="display:inline;" onsubmit="return confirm('Remove ${escapeHtml(member.full_name)} from squad?');">
            ${renderFormToken(request)}
            <button type="submit" class="button button-secondary" style="color: #dc2626; border-color: #fecaca; padding: 2px 8px; font-size: 0.8rem; min-height: unset;">Remove</button>
          </form>
        </td>` : '';
      return `<tr><td><strong>${escapeHtml(member.full_name)}</strong></td><td>${escapeHtml(member.roll_number)}</td><td>${escapeHtml(member.academic_year)}</td><td>${member.jersey_number === null ? '—' : escapeHtml(member.jersey_number)}</td>${removeBtn}</tr>`;
    }).join('');

    let addMemberSection = '';
    if (canEdit) {
      const [availableStudents] = await pool.execute(
        `SELECT s.student_id, s.full_name, s.roll_number, d.name AS department_name, s.academic_year
         FROM student s
         JOIN department d ON d.department_id = s.department_id
         WHERE s.student_id NOT IN (
           SELECT tm.student_id FROM team_member tm WHERE tm.team_id = ?
         )
         ORDER BY (s.department_id = ?) DESC, d.name, s.full_name`,
        [teamId, team.department_id]
      );

      const studentOptions = availableStudents.map((s) => {
        const isDept = s.department_name === team.department_name;
        const tag = isDept ? '★ Home Dept' : s.department_name;
        return `<option value="${s.student_id}">${escapeHtml(s.full_name)} (${escapeHtml(s.roll_number)} · ${escapeHtml(tag)} · Year ${s.academic_year})</option>`;
      }).join('');

      addMemberSection = `
        <section class="card" style="margin-top: var(--space-4);">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Squad roster management</p>
              <h2>Add student to team</h2>
              <p class="muted">Add an eligible student to this squad roster and assign their jersey number (0–99).</p>
            </div>
            <span class="status-pill status-scheduled-pill">${availableStudents.length} Available</span>
          </div>
          ${availableStudents.length === 0 ? '<p class="muted">All existing students are already enrolled in this squad.</p>' : `
            <form method="post" action="/teams/${teamId}/members" class="form-grid">
              ${renderFormToken(request)}
              <div class="form-group" style="grid-column: span 2;">
                <label for="student_id">Select student to add</label>
                <select name="student_id" id="student_id" required>
                  <option value="">— Choose student —</option>
                  ${studentOptions}
                </select>
              </div>
              <div class="form-group">
                <label for="jersey_number">Jersey number <small class="muted">(Optional, 0–99)</small></label>
                <input type="number" name="jersey_number" id="jersey_number" min="0" max="99" placeholder="e.g. 10">
              </div>
              <div class="form-group" style="display: flex; align-items: flex-end;">
                <button type="submit" class="button button-primary">Add to squad roster</button>
              </div>
            </form>
          `}
        </section>
      `;
    }

    const body = `
      <section class="team-detail-hero">
        <div class="team-avatar team-avatar-large">${escapeHtml(team.team_name.slice(0, 2).toUpperCase())}</div>
        <div>
          <p class="eyebrow">${escapeHtml(team.department_name)}</p>
          <h2>${escapeHtml(team.team_name)}</h2>
          <p class="muted">${members.length} registered member${members.length === 1 ? '' : 's'}</p>
        </div>
      </section>
      <section class="team-detail-summary">
        <div>
          <span>Captain</span>
          <strong>${escapeHtml(team.captain_name || 'Not assigned')}</strong>
          ${team.captain_roll ? `<small>${escapeHtml(team.captain_roll)}</small>` : ''}
        </div>
        <div>
          <span>Department</span>
          <strong>${escapeHtml(team.department_name)}</strong>
        </div>
      </section>
      <section class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Team roster</p>
            <h2>Members</h2>
            <p class="muted">Players currently registered for this team.</p>
          </div>
          <span class="relationship-pill">${members.length} Players</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Roll number</th>
                <th>Year</th>
                <th>Jersey</th>
                ${canEdit ? '<th style="text-align: right;">Action</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${memberRows || `<tr><td colspan="${canEdit ? 5 : 4}">No members registered yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      ${addMemberSection}
      <p style="margin-top: var(--space-4);"><a class="button button-secondary" href="/teams">← Back to teams</a></p>
    `;
    response.send(renderPage(request, team.team_name, body, { subtitle: 'View and manage team squad rosters and member jerseys.' }));
  } catch (error) { next(error); }
});

app.post('/teams/:id/members', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const teamId = Number(request.params.id);
    const studentId = Number(request.body.student_id);
    const rawJersey = request.body.jersey_number !== undefined && request.body.jersey_number !== ''
      ? Number(request.body.jersey_number)
      : null;

    if (!teamId || !studentId) {
      throw { errno: 1644, sqlMessage: 'Please select a valid student to add to the team.' };
    }
    if (rawJersey !== null && (!Number.isInteger(rawJersey) || rawJersey < 0 || rawJersey > 99)) {
      throw { errno: 1644, sqlMessage: 'Jersey number must be an integer between 0 and 99.' };
    }

    await pool.execute(
      `INSERT INTO team_member (team_id, student_id, jersey_number)
       VALUES (?, ?, ?)`,
      [teamId, studentId, rawJersey]
    );

    response.redirect(`/teams/${teamId}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Squad update rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p><p><a class="button button-secondary" href="/teams/${request.params.id}">← Back to team</a></p>`));
  }
});

app.post('/teams/:id/members/:studentId/remove', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const teamId = Number(request.params.id);
    const studentId = Number(request.params.studentId);
    await pool.execute(
      `DELETE FROM team_member WHERE team_id = ? AND student_id = ?`,
      [teamId, studentId]
    );
    response.redirect(`/teams/${teamId}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Squad update rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p><p><a class="button button-secondary" href="/teams/${request.params.id}">← Back to team</a></p>`));
  }
});

app.get('/design', (request, response) => {
  const categoryLabels = {
    all: 'All Relations (18)',
    foundation: 'Foundation Data (6)',
    competition: 'Competition & Entries (6)',
    operations: 'Matches & Metrics (3)',
    governance: 'Governance & Users (3)'
  };

  const relationCards = RDBMS_RELATIONS.map((relation) => {
    const attributeRows = relation.attrs.map((attr) => {
      const badge = attr.key ? `<span class="col-badge col-${attr.key.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${escapeHtml(attr.key)}</span>` : '';
      return `<div class="attr-row">
        <div class="attr-name"><code>${escapeHtml(attr.name)}</code>${badge}</div>
        <div class="attr-type"><code>${escapeHtml(attr.type)}</code></div>
        <div class="attr-desc">${escapeHtml(attr.note)}</div>
      </div>`;
    }).join('');

    const checksList = relation.checks.length
      ? `<div class="relation-block"><strong>Database CHECK Constraints</strong>${relation.checks.map((ck) => `<span class="code-pill">${escapeHtml(ck)}</span>`).join('')}</div>`
      : '';

    const triggersList = relation.triggers.length
      ? `<div class="relation-block"><strong>Associated Triggers</strong>${relation.triggers.map((trg) => `<span class="trg-pill">⚡ ${escapeHtml(trg)}</span>`).join('')}</div>`
      : '';

    const keysList = relation.keys.length
      ? `<div class="relation-block"><strong>Candidate & Unique Keys</strong>${relation.keys.map((k) => `<span>✦ ${escapeHtml(k)}</span>`).join('')}</div>`
      : '';

    const refsList = relation.refs.length
      ? `<div class="relation-block"><strong>Foreign Key Wiring & Actions</strong>${relation.refs.map((r) => `<span>↳ ${escapeHtml(r)}</span>`).join('')}</div>`
      : '';

    return `
      <article class="relation-card" id="rel-${escapeHtml(relation.name)}" data-category="${escapeHtml(relation.category)}">
        <div class="relation-card-head">
          <div>
            <div class="relation-badge-row">
              <span class="relation-type">${escapeHtml(relation.type)}</span>
              <span class="nf-badge">${escapeHtml(relation.nf)}</span>
            </div>
            <h3>${escapeHtml(relation.name)}</h3>
          </div>
          <span class="relation-pk" title="Primary Key: ${escapeHtml(relation.pk)}">PK</span>
        </div>
        <div class="relation-attributes-table">
          <div class="attr-head"><span>Column</span><span>Type</span><span>Purpose / Integrity</span></div>
          ${attributeRows}
        </div>
        <div class="relation-meta">
          ${keysList}
          ${refsList}
          ${checksList}
          ${triggersList}
          <div class="relation-block relation-rules">
            <strong>Relational & Domain Invariants</strong>
            ${relation.rules.map((rule) => `<span>• ${escapeHtml(rule)}</span>`).join('')}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const relationshipRows = RDBMS_RELATIONSHIPS.map(([parent, child, rel, card, explanation]) => `
    <tr>
      <td><strong>${escapeHtml(parent)}</strong></td>
      <td><strong>${escapeHtml(child)}</strong></td>
      <td>${escapeHtml(rel)}</td>
      <td><span class="relationship-pill">${escapeHtml(card)}</span></td>
      <td><small class="muted">${escapeHtml(explanation)}</small></td>
    </tr>
  `).join('');

  const viewCards = RDBMS_PROGRAMMABILITY.views.map((v) => `
    <div class="prog-card">
      <div class="prog-header">
        <span class="prog-kind view-kind">VIEW</span>
        <code>${escapeHtml(v.name)}</code>
      </div>
      <p>${escapeHtml(v.purpose)}</p>
    </div>
  `).join('');

  const triggerCards = RDBMS_PROGRAMMABILITY.triggers.map((t) => `
    <div class="prog-card">
      <div class="prog-header">
        <span class="prog-kind trigger-kind">TRIGGER</span>
        <code>${escapeHtml(t.name)}</code>
      </div>
      <div class="prog-meta">
        <span>Table: <strong>${escapeHtml(t.table)}</strong></span>
        <span>Timing: <strong>${escapeHtml(t.timing)}</strong></span>
      </div>
      <p>${escapeHtml(t.rule)}</p>
    </div>
  `).join('');

  const routineCards = RDBMS_PROGRAMMABILITY.routines.map((r) => `
    <div class="prog-card">
      <div class="prog-header">
        <span class="prog-kind routine-kind">${escapeHtml(r.type.toUpperCase())}</span>
        <code>${escapeHtml(r.name)}</code>
      </div>
      <div class="prog-meta">
        <span>Returns: <strong>${escapeHtml(r.returns)}</strong></span>
      </div>
      <p>${escapeHtml(r.purpose)}</p>
    </div>
  `).join('');

  const body = `
    <!-- Subnav / Table of contents -->
    <nav class="design-nav" aria-label="RDBMS Design Sections">
      <a href="#section-erd" class="design-nav-link active">1. Entity & Relationship Diagram</a>
      <a href="#section-schema" class="design-nav-link">2. Relational Dictionary (18 Tables)</a>
      <a href="#section-relationships" class="design-nav-link">3. Cardinality & Dependency Matrix</a>
      <a href="#section-programmability" class="design-nav-link">4. Views, Triggers & Routines</a>
    </nav>

    <!-- Section 1: Entity & Relationship Diagram -->
    <section id="section-erd" class="design-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Relational Architecture</p>
          <h2>Entity & Relationship Diagram</h2>
          <p class="muted">Visual schema showing all 18 database entities and their inter-table relationships. Detailed column attributes, SQL types, and integrity constraints are documented in the Relational Data Dictionary below.</p>
        </div>
        <div class="legend">
          <span><i class="legend-dot entity"></i>Strong Entity</span>
          <span><i class="legend-dot dependent"></i>Dependent / Weak</span>
          <span><i class="legend-dot associative"></i>Associative / M:N</span>
          <span><i class="legend-dot trigger-dot"></i>Trigger Protected</span>
        </div>
      </div>
      ${renderRdbmsDiagram()}
    </section>

    <!-- Section 2: Relational Dictionary -->
    <section id="section-schema" class="design-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Physical Schema Specification</p>
          <h2>Complete Relational Data Dictionary</h2>
          <p class="muted">Every column, SQL data type, candidate key, and engine rule exactly as declared in <code>sql/schema.sql</code>.</p>
        </div>
        <div class="relation-filter-bar" role="tablist">
          <button type="button" class="filter-btn active" data-filter="all">All (18)</button>
          <button type="button" class="filter-btn" data-filter="foundation">Foundation (6)</button>
          <button type="button" class="filter-btn" data-filter="competition">Competition (6)</button>
          <button type="button" class="filter-btn" data-filter="operations">Operations (3)</button>
          <button type="button" class="filter-btn" data-filter="governance">Governance (3)</button>
        </div>
      </div>
      <div class="relation-grid">
        ${relationCards}
      </div>
    </section>

    <!-- Section 3: Relationships & Cardinality -->
    <section id="section-relationships" class="design-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Relational Algebra & Semantics</p>
          <h2>Complete Relationships & Cardinality Matrix</h2>
          <p class="muted">Comprehensive mapping of every parent-child connection, participation constraints, and relationship semantics.</p>
        </div>
      </div>
      <div class="table-scroll">
        <table class="relationship-table">
          <thead>
            <tr>
              <th>Parent / Determinant</th>
              <th>Child / Dependent</th>
              <th>Semantic Verb</th>
              <th>Cardinality</th>
              <th>Relational Rule & Integrity Constraint</th>
            </tr>
          </thead>
          <tbody>
            ${relationshipRows}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section 4: Programmable Database Objects -->
    <section id="section-programmability" class="design-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Database Programmability Layer</p>
          <h2>Database Views, Triggers & Stored Routines</h2>
          <p class="muted">Business rules, audit records, and complex analytics execute inside MySQL rather than client applications.</p>
        </div>
      </div>
      
      <div class="programmable-layout">
        <div class="prog-group">
          <h3><span class="prog-title-badge view-badge">4 Views</span> Read-Only Computed Aggregates</h3>
          <p class="muted">Encapsulate complex joins, window functions (<code>RANK() OVER ...</code>), and CTEs for real-time leaderboards.</p>
          <div class="prog-cards-grid">${viewCards}</div>
        </div>

        <div class="prog-group">
          <h3><span class="prog-title-badge trigger-badge">6 Triggers</span> Engine-Level Invariant Enforcement</h3>
          <p class="muted">Fired automatically on <code>BEFORE/AFTER INSERT/UPDATE</code> to guarantee zero corrupt or conflicting tournament states.</p>
          <div class="prog-cards-grid">${triggerCards}</div>
        </div>

        <div class="prog-group">
          <h3><span class="prog-title-badge routine-badge">4 Routines</span> Stored Procedures & Functions</h3>
          <p class="muted">Deterministic point functions and automated bracket generators executing with database transactions.</p>
          <div class="prog-cards-grid">${routineCards}</div>
        </div>
      </div>
    </section>

    <script>
      // Interactive category filter for 18 relational cards
      document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          const filter = e.currentTarget.dataset.filter;
          document.querySelectorAll('.relation-card').forEach((card) => {
            if (filter === 'all' || card.dataset.category === filter) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    </script>
  `;

  response.send(renderPage(request, 'RDBMS design', body, {
    subtitle: 'Comprehensive architectural reference, schema dictionary, and integrity mapping for the Campus Sports Tournament DBMS.'
  }));
});

app.get('/points', async (request, response, next) => {
  try {
    const [eventGroups] = await pool.query(
      `SELECT e.event_id, e.name AS event_name, sp.name AS sport_name, st.stage_id, st.name AS group_name
       FROM \`event\` e
       JOIN sport sp ON sp.sport_id = e.sport_id
       JOIN stage st ON st.event_id = e.event_id
       WHERE sp.is_team_sport = TRUE AND st.stage_type = 'group'
       ORDER BY sp.name, e.name, st.stage_order`
    );

    const rows = await readView('v_points_table', 'ORDER BY event_id, stage_id, points_position');
    const columns = [
      { name: 'team_name', label: 'Team' }, { name: 'played', label: 'Played' },
      { name: 'won', label: 'Won' }, { name: 'drawn', label: 'Drawn' }, { name: 'lost', label: 'Lost' },
      { name: 'goal_difference', label: 'GD' }, { name: 'points', label: 'Points' }, { name: 'points_position', label: 'Position' }
    ];

    const standingsByKey = new Map();
    rows.forEach((row) => {
      const key = `${row.event_id}:${row.stage_id}`;
      if (!standingsByKey.has(key)) {
        standingsByKey.set(key, []);
      }
      standingsByKey.get(key).push(row);
    });

    const eventsMap = new Map();
    eventGroups.forEach((eg) => {
      if (!eventsMap.has(eg.event_id)) {
        eventsMap.set(eg.event_id, {
          id: eg.event_id,
          name: eg.event_name,
          sport: eg.sport_name,
          groups: []
        });
      }
      const key = `${eg.event_id}:${eg.stage_id}`;
      eventsMap.get(eg.event_id).groups.push({
        stageId: eg.stage_id,
        name: eg.group_name,
        rows: standingsByKey.get(key) || []
      });
    });

    // Also include any events that have standings in v_points_table but weren't in eventGroups query
    rows.forEach((row) => {
      if (!eventsMap.has(row.event_id)) {
        eventsMap.set(row.event_id, {
          id: row.event_id,
          name: row.event_name,
          sport: row.sport_name,
          groups: []
        });
      }
      const event = eventsMap.get(row.event_id);
      if (!event.groups.some(g => g.stageId === row.stage_id)) {
        const key = `${row.event_id}:${row.stage_id}`;
        event.groups.push({
          stageId: row.stage_id,
          name: row.group_name,
          rows: standingsByKey.get(key) || []
        });
      }
    });

    const eventSections = Array.from(eventsMap.values());
    const groupedTables = eventSections.map((event, eventIndex) => `
      <section class="points-event-section">
        <div class="points-event-heading">
          <div>
            <p class="eyebrow">${escapeHtml(event.sport)} competition</p>
            <h2><a href="/events/${event.id}" style="color: inherit; text-decoration: none;">${escapeHtml(event.name)}</a></h2>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="points-event-label">${event.groups.length} ${event.groups.length === 1 ? 'group' : 'groups'}</span>
            <a href="/events/${event.id}" class="button button-outline" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;">View Event Hub →</a>
          </div>
        </div>
        <div class="points-group-grid">
          ${event.groups.map((group, groupIndex) => `
            <section class="points-group-card points-group-${((eventIndex + groupIndex) % 4) + 1}">
              <div class="points-group-heading">
                <div>
                  <p class="eyebrow">Group standings</p>
                  <h3>${escapeHtml(group.name)}</h3>
                </div>
                <span class="points-group-count">${group.rows.length} ${group.rows.length === 1 ? 'team' : 'teams'}</span>
              </div>
              ${group.rows.length > 0 ? renderTable(columns, group.rows) : '<p class="muted" style="padding: 1rem; font-size: 0.88rem; margin: 0;">No teams registered in this group yet.</p>'}
            </section>
          `).join('')}
        </div>
      </section>
    `).join('');

    const body = `<section class="page-intro"><div><p class="eyebrow">Team competition</p><h2>Points by competition</h2><p class="muted">Each sport event has its own section, with separate group standings beneath it.</p></div></section>${groupedTables || '<section class="card empty-state">No group standings available.</section>'}`;
    response.send(renderPage(request, 'Points table', body));
  } catch (error) { next(error); }
});

app.get('/medals', async (request, response, next) => {
  try {
    const rows = await readView('v_medal_tally', 'ORDER BY gold DESC, silver DESC, bronze DESC');
    response.send(renderPage(request, 'Medal tally', '<div class="page-context"><span>Calculated from awards assigned after completed final results.</span><a href="/schedule">View match schedule →</a></div>' + renderTable([
      { name: 'department_name', label: 'Department' }, { name: 'gold', label: 'Gold' }, { name: 'silver', label: 'Silver' },
      { name: 'bronze', label: 'Bronze' }, { name: 'total_awards', label: 'Total' }
    ], rows), { subtitle: 'Department awards from completed tournament results.' }));
  } catch (error) { next(error); }
});

app.get('/player', requireRole('player'), async (request, response, next) => {
  try {
    const [registrations] = await pool.execute(
      `SELECT r.registration_id, e.name AS event_name, r.status
       FROM registration r JOIN \`event\` e ON e.event_id = r.event_id
       WHERE r.student_id = ? ORDER BY r.registration_id DESC`,
      [request.session.user.studentId]
    );
    const [matches] = await pool.execute(
      `SELECT m.match_id, e.name AS event_name, home.name AS home_team, away.name AS away_team, m.starts_at, m.status
       FROM registration r JOIN \`event\` e ON e.event_id = r.event_id
       JOIN stage st ON st.event_id = e.event_id JOIN \`match\` m ON m.stage_id = st.stage_id
       JOIN team home ON home.team_id = m.home_team_id JOIN team away ON away.team_id = m.away_team_id
       JOIN team_member tm ON tm.team_id IN (m.home_team_id, m.away_team_id) AND tm.student_id = r.student_id
       WHERE r.student_id = ? ORDER BY m.starts_at`,
      [request.session.user.studentId]
    );
    response.send(renderPage(request, 'Participant view', `<div class="workflow-guide"><strong>View-only access</strong><span>Your participant account can view registrations and assigned matches. Coordinators and administrators currently handle registrations, scheduling, scores, and all edits.</span></div>
      <h2>My registrations</h2>${renderTable([{ name: 'event_name', label: 'Event' }, { name: 'status', label: 'Status' }], registrations)}
      <h2>My matches</h2>${renderTable([
        { name: 'event_name', label: 'Event' }, { name: 'home_team', label: 'Home' }, { name: 'away_team', label: 'Away' },
        { name: 'starts_at', label: 'Starts' }, { name: 'status', label: 'Status' }
      ], matches)}`));
  } catch (error) { next(error); }
});

app.post('/player/registrations', requireRole('player'), async (request, response, next) => {
  rejectPlayerWrite(request, response);
});

app.post('/player/registrations/:id/cancel', requireRole('player'), async (request, response, next) => {
  rejectPlayerWrite(request, response);
});

app.get('/coordinator', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const noticeMessage = request.query.message || '';
    const noticeTone = request.query.tone || 'info';

    const [matches] = await pool.query(
      `SELECT m.match_id, sp.name AS sport_name, e.name AS event_name, st.name AS stage_name,
              home.name AS home_team, away.name AS away_team, m.starts_at, m.status, m.home_score, m.away_score
       FROM \`match\` m
       JOIN stage st ON st.stage_id = m.stage_id
       JOIN \`event\` e ON e.event_id = st.event_id
       JOIN sport sp ON sp.sport_id = e.sport_id
       JOIN team home ON home.team_id = m.home_team_id
       JOIN team away ON away.team_id = m.away_team_id
       ORDER BY m.starts_at DESC, m.match_id DESC LIMIT 100`
    );
    const sportsList = [...new Set(matches.map((m) => m.sport_name))].sort();
    const [stages] = await pool.query(
      `SELECT st.stage_id AS id, CONCAT(sp.name, ' — ', e.name, ' · ', st.name) AS label
       FROM stage st JOIN \`event\` e ON e.event_id = st.event_id
       JOIN sport sp ON sp.sport_id = e.sport_id
       WHERE sp.is_team_sport = TRUE
       ORDER BY sp.name, e.name, st.stage_order`
    );
    const [venues] = await pool.query('SELECT venue_id AS id, name AS label FROM venue ORDER BY name');
    const [teams] = await pool.query(
      `SELECT team_id AS id, CONCAT(name, ' · ', (SELECT name FROM department WHERE department_id = t.department_id)) AS label
       FROM team t ORDER BY name`
    );
    const [events] = await pool.query(
      `SELECT e.event_id AS id, e.name AS label, sp.name AS sport_name
       FROM \`event\` e JOIN sport sp ON sp.sport_id = e.sport_id
       WHERE sp.is_team_sport = TRUE
       ORDER BY e.name`
    );
    const [allStages] = await pool.query(
      `SELECT st.stage_id, st.event_id, st.name AS stage_name, st.stage_type, st.stage_order,
              (SELECT COUNT(*) FROM \`match\` WHERE stage_id = st.stage_id) AS total_matches,
              (SELECT COUNT(*) FROM \`match\` WHERE stage_id = st.stage_id AND status = 'completed') AS completed_matches,
              (SELECT COUNT(*) FROM \`match\` WHERE stage_id = st.stage_id AND status = 'completed' AND home_score <> away_score) AS decisive_matches
       FROM stage st
       JOIN \`event\` e ON e.event_id = st.event_id
       JOIN sport sp ON sp.sport_id = e.sport_id
       WHERE sp.is_team_sport = TRUE
       ORDER BY st.event_id, st.stage_order`
    );
    const [currentAwards] = await pool.query(
      `SELECT a.award_id, a.event_id, a.award_type, a.award_rank, a.awarded_at,
              t.team_id, t.name AS team_name, d.name AS department_name
       FROM award a
       JOIN team t ON t.team_id = a.team_id
       JOIN department d ON d.department_id = t.department_id
       ORDER BY a.event_id, a.award_rank`
    );

    const awardsByEvent = {};
    currentAwards.forEach((a) => {
      awardsByEvent[a.event_id] ||= [];
      awardsByEvent[a.event_id].push({
        award_id: a.award_id,
        award_type: a.award_type,
        award_rank: a.award_rank,
        team_name: a.team_name,
        department_name: a.department_name,
        awarded_at: a.awarded_at ? String(a.awarded_at).slice(0, 10) : ''
      });
    });

    const [standingsRows] = await pool.query(
      `SELECT event_id, stage_id, team_id, team_name, points, goal_difference, points_position
       FROM v_points_table
       ORDER BY event_id, stage_id, points_position ASC`
    );
    const standingsByStage = {};
    standingsRows.forEach((row) => {
      standingsByStage[row.stage_id] ||= [];
      standingsByStage[row.stage_id].push({
        team_id: row.team_id,
        team_name: row.team_name,
        points: row.points,
        goal_diff: row.goal_difference,
        position: row.points_position
      });
    });

    const [finalMatches] = await pool.query(
      `SELECT m.stage_id, m.match_id, m.status, m.home_score, m.away_score,
              ht.name AS home_name, at.name AS away_name
       FROM \`match\` m
       JOIN stage st ON st.stage_id = m.stage_id
       JOIN team ht ON ht.team_id = m.home_team_id
       JOIN team at ON at.team_id = m.away_team_id
       WHERE st.stage_type IN ('final', 'knockout')
       ORDER BY m.match_id DESC`
    );
    const finalMatchesByStage = {};
    finalMatches.forEach((m) => {
      if (!finalMatchesByStage[m.stage_id]) {
        finalMatchesByStage[m.stage_id] = m;
      }
    });

    const controlIntro = `<div class="workflow-guide"><strong>Team match control</strong><span>This page is only for team sports. Football, basketball, and cricket use home/away matches, scores, standings, and knockout rounds. Sprint and singles events use heats and individual results from their event setup page.</span></div>`;

    const isAuthorized = ['coordinator', 'admin'].includes(request.session.user.role);
    const todayDate = new Date().toISOString().slice(0, 10);
    const awardSection = isAuthorized
      ? `
        <p class="muted">Assign championship medals from completed tournament results. Automatically supports both <strong>Knockout Finals</strong> (Winner: Gold, Runner-up: Silver) and <strong>Round-Robin Standings</strong> (1st: Gold, 2nd: Silver, 3rd: Bronze).</p>
        <form method="post" action="/coordinator/awards" id="awards-assign-form">
          ${renderFormToken(request)}
          <label>Competition event
            <select id="award-event-select" name="event_id" required>
              <option value="">-- Choose competition event --</option>
              ${events.map((e) => `<option value="${e.id}">${escapeHtml(e.label)} (${escapeHtml(e.sport_name)})</option>`).join('')}
            </select>
          </label>
          <label>Deciding stage
            <select id="award-stage-select" name="final_stage_id" required disabled>
              <option value="">-- Choose competition event first --</option>
            </select>
            <div id="award-stage-hint" style="margin-top: 6px; font-size: 0.85rem;"></div>
          </label>
          <label>Award date
            <input type="date" id="award-date-input" name="awarded_at" value="${todayDate}" required>
          </label>
          <div id="current-awards-preview" style="display: none; margin-top: 10px; margin-bottom: 8px;"></div>
          <div style="display: flex; gap: 8px; align-items: center; margin-top: 12px;">
            <button type="submit" id="award-submit-btn" class="button button-primary" disabled>Assign awards</button>
            <button type="button" id="award-reset-btn" class="button button-outline" style="display: none; color: #dc2626; border-color: currentColor;" onclick="resetEventAwards()">Clear awards</button>
          </div>
        </form>
        <script>
        (function() {
          const allStages = ${JSON.stringify(allStages)};
          const awardsData = ${JSON.stringify(awardsByEvent)};
          const standingsData = ${JSON.stringify(standingsByStage)};
          const finalMatchesData = ${JSON.stringify(finalMatchesByStage)};

          const eventSel = document.getElementById('award-event-select');
          const stageSel = document.getElementById('award-stage-select');
          const hint = document.getElementById('award-stage-hint');
          const preview = document.getElementById('current-awards-preview');
          const resetBtn = document.getElementById('award-reset-btn');
          const submitBtn = document.getElementById('award-submit-btn');

          function escapeHtml(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          }

          function updateStages() {
            const eventId = Number(eventSel ? eventSel.value : 0);
            if (!eventId) {
              if (stageSel) {
                stageSel.disabled = true;
                stageSel.innerHTML = '<option value="">-- Choose competition event first --</option>';
              }
              if (submitBtn) submitBtn.disabled = true;
              if (hint) hint.innerHTML = '<span style="color: var(--muted, #64748b);">Select an event above to view its deciding stages.</span>';
              if (preview) preview.style.display = 'none';
              if (resetBtn) resetBtn.style.display = 'none';
              return;
            }

            const eventStages = allStages.filter(s => Number(s.event_id) === eventId);
            if (stageSel) {
              if (eventStages.length === 0) {
                stageSel.disabled = true;
                stageSel.innerHTML = '<option value="">No stages found for this event</option>';
                if (submitBtn) submitBtn.disabled = true;
              } else {
                stageSel.disabled = false;
                stageSel.innerHTML = eventStages.map(st => {
                  const typeLabel = st.stage_type === 'final' ? 'Knockout Final' : (st.stage_type.charAt(0).toUpperCase() + st.stage_type.slice(1).replace('_', ' '));
                  return '<option value="' + st.stage_id + '">' + escapeHtml(st.stage_name) + ' (' + typeLabel + ' · ' + st.completed_matches + '/' + st.total_matches + ' matches done)</option>';
                }).join('');

                const finalStage = eventStages.find(s => s.stage_type === 'final');
                if (finalStage) {
                  stageSel.value = String(finalStage.stage_id);
                } else {
                  stageSel.value = String(eventStages[0].stage_id);
                }
              }
            }

            updateHint();
            renderPreview(eventId);
          }

          function updateHint() {
            if (!stageSel || !hint) return;
            const eventId = Number(eventSel ? eventSel.value : 0);
            const stageId = Number(stageSel.value || 0);

            if (!eventId || !stageId) {
              if (hint) hint.innerHTML = '';
              if (submitBtn) submitBtn.disabled = true;
              return;
            }

            const stage = allStages.find(s => Number(s.stage_id) === stageId);
            if (!stage) {
              hint.innerHTML = '<span style="color: var(--muted, #64748b);">Stage details unavailable.</span>';
              if (submitBtn) submitBtn.disabled = true;
              return;
            }

            const stageType = stage.stage_type;
            const completed = Number(stage.completed_matches || 0);
            const total = Number(stage.total_matches || 0);
            const decisive = Number(stage.decisive_matches || 0);

            if (stageType === 'final' || stageType === 'knockout') {
              const match = finalMatchesData[stageId];
              if (match && match.status === 'completed' && match.home_score !== match.away_score) {
                const winner = match.home_score > match.away_score ? match.home_name : match.away_name;
                const runnerUp = match.home_score > match.away_score ? match.away_name : match.home_name;
                hint.innerHTML = '<div style="padding: 6px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; color: #065f46; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>✓ Final match completed:</strong> ' + escapeHtml(match.home_name) + ' ' + match.home_score + ' - ' + match.away_score + ' ' + escapeHtml(match.away_name) + '<br>' +
                  '🏆 Ready to award <strong>Gold</strong> to ' + escapeHtml(winner) + ' and <strong>Silver</strong> to ' + escapeHtml(runnerUp) + '.' +
                  '</div>';
                if (submitBtn) submitBtn.disabled = false;
              } else if (match && match.status === 'completed' && match.home_score === match.away_score) {
                hint.innerHTML = '<div style="padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; color: #92400e; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>⚠ Match ended in a draw (' + match.home_score + ' - ' + match.away_score + ').</strong> A decisive winner is required before awards can be assigned.' +
                  '</div>';
                if (submitBtn) submitBtn.disabled = true;
              } else {
                hint.innerHTML = '<div style="padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; color: #92400e; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>⚠ Final match is not completed yet</strong> (' + completed + '/' + total + ' completed). Complete the final match score in Match Control first.' +
                  '</div>';
                if (submitBtn) submitBtn.disabled = true;
              }
            } else if (stageType === 'group') {
              const standings = standingsData[stageId] || [];
              if (standings.length >= 2) {
                const p1 = standings[0];
                const p2 = standings[1];
                const p3 = standings[2];
                hint.innerHTML = '<div style="padding: 6px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; color: #065f46; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>🏆 Round-robin standings ready:</strong><br>' +
                  '🥇 1st: <strong>' + escapeHtml(p1.team_name) + '</strong> (' + p1.points + ' pts, GD ' + p1.goal_diff + ')<br>' +
                  '🥈 2nd: <strong>' + escapeHtml(p2.team_name) + '</strong> (' + p2.points + ' pts, GD ' + p2.goal_diff + ')' +
                  (p3 ? '<br>🥉 3rd: <strong>' + escapeHtml(p3.team_name) + '</strong> (' + p3.points + ' pts, GD ' + p3.goal_diff + ')' : '') +
                  '</div>';
                if (submitBtn) submitBtn.disabled = false;
              } else if (completed > 0) {
                hint.innerHTML = '<div style="padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; color: #92400e; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>⚠ Need at least 2 teams with completed match standings in this group</strong> (' + completed + '/' + total + ' matches completed).' +
                  '</div>';
                if (submitBtn) submitBtn.disabled = true;
              } else {
                hint.innerHTML = '<div style="padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; color: #92400e; font-size: 0.83rem; margin-top: 4px;">' +
                  '<strong>⚠ No completed matches in this group yet</strong> (' + total + ' scheduled). Record match scores in Match Control first.' +
                  '</div>';
                if (submitBtn) submitBtn.disabled = true;
              }
            } else {
              hint.innerHTML = '<div style="padding: 4px 0; color: var(--muted, #64748b); font-size: 0.82rem;">Stage: ' + escapeHtml(stageType) + ' (' + completed + '/' + total + ' completed).</div>';
              if (submitBtn) submitBtn.disabled = (completed === 0);
            }
          }

          function renderPreview(eventId) {
            if (!preview) return;
            const awards = awardsData[eventId] || [];
            if (awards.length === 0) {
              preview.innerHTML = '<div style="padding: 8px 10px; background: var(--surface-2, #f8fafc); border: 1px dashed var(--line, #cbd5e1); border-radius: 6px; font-size: 0.83rem; color: var(--muted, #64748b);">No medals recorded yet for this tournament.</div>';
              preview.style.display = 'block';
              if (resetBtn) resetBtn.style.display = 'none';
              return;
            }

            const medals = { gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' };
            const list = awards.map(a => '<span class="relationship-pill" style="font-size: 0.82rem; padding: 4px 8px;">' + (medals[a.award_type] || a.award_type) + ': <strong>' + escapeHtml(a.team_name) + '</strong> (' + escapeHtml(a.department_name) + ')</span>').join(' ');

            preview.innerHTML = '<div style="padding: 8px 12px; background: var(--surface-2, #f8fafc); border: 1px solid var(--line, #e2e8f0); border-radius: 6px;">' +
              '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
              '<span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted, #64748b);">Current Podium</span>' +
              '<span style="font-size: 0.76rem; color: var(--muted, #64748b);">Awarded ' + (awards[0]?.awarded_at || '') + '</span>' +
              '</div>' +
              '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' + list + '</div></div>';
            preview.style.display = 'block';
            if (resetBtn) resetBtn.style.display = 'inline-block';
          }

          if (eventSel) {
            eventSel.addEventListener('change', updateStages);
          }
          if (stageSel) {
            stageSel.addEventListener('change', updateHint);
          }
          updateStages();
        })();

        function resetEventAwards() {
          const eventId = document.getElementById('award-event-select')?.value;
          if (!eventId) return;
          if (confirm('Are you sure you want to clear/delete existing awards for this tournament?')) {
            const form = document.createElement('form');
            form.method = 'post';
            form.action = '/coordinator/awards/reset';
            const csrf = document.querySelector('input[name="_csrf"]')?.value;
            if (csrf) {
              const csrfInput = document.createElement('input');
              csrfInput.type = 'hidden';
              csrfInput.name = '_csrf';
              csrfInput.value = csrf;
              form.appendChild(csrfInput);
            }
            const eventInput = document.createElement('input');
            eventInput.type = 'hidden';
            eventInput.name = 'event_id';
            eventInput.value = eventId;
            form.appendChild(eventInput);
            document.body.appendChild(form);
            form.submit();
          }
        }
        </script>
      `
      : `<p class="muted">Award assignment is available to tournament coordinators and administrators after matches are completed.</p>`;
    response.send(renderPage(request, 'Match control', `${controlIntro}<div class="control-grid">
      <section class="card control-card control-card-wide"><div class="section-heading"><div><p class="eyebrow">Fixture tools</p><h2>Create a single match</h2></div><span class="control-step">01</span></div><p class="muted">Use this for a special or knockout fixture. Most group matches should be created from the event setup page.</p>
        ${renderChoiceForm(request, '/coordinator/matches', [['stage_id', 'Stage', stages], ['venue_id', 'Venue', venues], ['home_team_id', 'Home team', teams], ['away_team_id', 'Away team', teams], ['starts_at', 'Start time', 'datetime-local'], ['duration_minutes', 'Duration minutes', 'number']], 'Create match')}</section>
      <section class="card control-card"><div class="section-heading"><div><p class="eyebrow">Fixture tools</p><h2>Generate group fixtures</h2></div><span class="control-step">02</span></div><p class="muted">Create round-robin fixtures for teams already registered in a group.</p>${renderChoiceForm(request, '/coordinator/fixtures', [['stage_id', 'Stage', stages], ['venue_id', 'Venue', venues], ['start_at', 'First match start', 'datetime-local']], 'Generate fixtures')}</section>
      <section class="card control-card"><div class="section-heading"><div><p class="eyebrow">Knockout</p><h2>Advance winners</h2></div><span class="control-step">03</span></div><p class="muted">Move winners from a completed stage into the next round.</p>${renderChoiceForm(request, '/coordinator/advance', [['source_stage_id', 'Completed source stage', stages], ['target_stage_id', 'Next stage', stages], ['venue_id', 'Venue', venues], ['start_at', 'First match start', 'datetime-local']], 'Advance knockout')}</section>
      <section class="card control-card"><div class="section-heading"><div><p class="eyebrow">Awards</p><h2>Assign awards</h2></div><span class="control-step">04</span></div>${awardSection}</section>
    </div><section class="card matches-panel"><div class="section-heading" style="flex-wrap: wrap; gap: 12px;"><div><p class="eyebrow">Live operations</p><h2>Matches</h2></div><div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><label style="margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--muted); display: flex; align-items: center; gap: 6px;">Filter by sport:<select id="match-sport-filter" style="padding: 4px 10px; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--line); background: var(--surface);"><option value="">All sports (${matches.length})</option>${sportsList.map((s) => {
      const count = matches.filter((m) => m.sport_name === s).length;
      return `<option value="${escapeHtml(s)}">${escapeHtml(s)} (${count})</option>`;
    }).join('')}</select></label><span class="muted" style="font-size: 0.85rem;">Open a match to record its score and final status.</span></div></div>${renderTable([
        { name: 'match_id', label: 'ID' },
        { name: 'sport_name', label: 'Sport' },
        { name: 'event_name', label: 'Event' },
        { name: 'stage_name', label: 'Stage' },
        { name: 'home_team', label: 'Home' },
        { name: 'away_team', label: 'Away' },
        { name: 'starts_at', label: 'Starts' },
        { name: 'status', label: 'Status' },
        { name: 'home_score', label: 'Home score' },
        { name: 'away_score', label: 'Away score' }
      ], matches, (row) => `<td><a class="button button-secondary table-action" href="/coordinator/matches/${row.match_id}">${row.status === 'completed' ? 'View result' : 'Open control'}</a></td>`, (row) => `data-sport="${escapeHtml(row.sport_name)}"`)}
      <script>
      (function() {
        const sportFilter = document.getElementById('match-sport-filter');
        if (!sportFilter) return;
        sportFilter.addEventListener('change', function() {
          const selected = this.value.toLowerCase();
          document.querySelectorAll('.matches-panel table tbody tr').forEach(tr => {
            const sport = (tr.dataset.sport || '').toLowerCase();
            tr.style.display = (!selected || sport === selected) ? '' : 'none';
          });
        });
      })();
      </script>
    </section>`, {
      message: noticeMessage,
      tone: noticeTone
    }));
  } catch (error) { next(error); }
});

app.post('/coordinator/fixtures', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const stageId = Number(request.body.stage_id);
    const venueId = Number(request.body.venue_id);
    const startAt = request.body.start_at ? String(request.body.start_at).replace('T', ' ') : null;
    if (!stageId || !venueId || !startAt) {
      throw { errno: 1644, sqlMessage: 'Please select a stage, a venue, and a valid first match start date and time.' };
    }
    await pool.execute('CALL sp_generate_group_fixtures(?, ?, ?)', [stageId, venueId, startAt]);
    response.redirect('/coordinator');
  } catch (error) {
    response.status(400).send(renderPage(request, 'Fixture generation rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.post('/coordinator/matches', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const [stageRows] = await pool.execute(
      `SELECT sp.is_team_sport FROM stage st
       JOIN \`event\` e ON e.event_id = st.event_id
       JOIN sport sp ON sp.sport_id = e.sport_id
       WHERE st.stage_id = ?`,
      [Number(request.body.stage_id)]
    );
    if (!stageRows[0] || !stageRows[0].is_team_sport) {
      throw { errno: 1644, sqlMessage: 'Individual events use heats and individual results, not home and away teams.' };
    }
    const startsAt = request.body.starts_at ? String(request.body.starts_at).replace('T', ' ') : null;
    await pool.execute(
      `INSERT INTO \`match\` (stage_id, venue_id, home_team_id, away_team_id, starts_at, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [Number(request.body.stage_id), Number(request.body.venue_id), Number(request.body.home_team_id), Number(request.body.away_team_id), startsAt, Number(request.body.duration_minutes)]
    );
    response.redirect('/coordinator');
  } catch (error) {
    response.status(400).send(renderPage(request, 'Match rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.get('/coordinator/matches/:id', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const [matches] = await pool.execute(
      `SELECT m.*, home.name AS home_team, away.name AS away_team,
              st.name AS stage_name, e.name AS event_name, sp.name AS sport_name
       FROM \`match\` m
       JOIN stage st ON st.stage_id = m.stage_id
       JOIN \`event\` e ON e.event_id = st.event_id
       JOIN sport sp ON sp.sport_id = e.sport_id
       JOIN team home ON home.team_id = m.home_team_id
       JOIN team away ON away.team_id = m.away_team_id
       WHERE m.match_id = ?`,
      [Number(request.params.id)]
    );
    const match = matches[0];
    if (!match) return response.status(404).send(renderPage(request, 'Match not found', '<p>No such match.</p>'));
    const [venues] = await pool.query('SELECT venue_id AS id, name AS label FROM venue ORDER BY name');
    const statusOptions = [{ id: 'scheduled', label: 'Scheduled — not started' }, { id: 'live', label: 'Live — in progress' }, { id: 'completed', label: 'Completed — winner recorded' }, { id: 'cancelled', label: 'Cancelled' }];
    const resultText = match.status === 'completed'
      ? (match.home_score > match.away_score ? 'Home team wins' : match.away_score > match.home_score ? 'Away team wins' : 'Draw')
      : 'Result appears when the match is completed';
    const scoreSection = match.status === 'completed'
      ? `<section class="card score-card locked-card"><div class="section-heading"><div><p class="eyebrow">Final result</p><h2>Match locked</h2></div><span class="locked-pill">Completed</span></div><p>This match has been completed and its result is protected from accidental edits.</p><div class="locked-score"><span>${escapeHtml(match.home_team)}</span><strong>${escapeHtml(match.home_score)} – ${escapeHtml(match.away_score)}</strong><span>${escapeHtml(match.away_team)}</span></div></section>`
      : `<section class="card score-card"><div class="section-heading"><div><p class="eyebrow">Step 1</p><h2>Score and final result</h2></div><span class="muted">Enter the final scores, then choose Completed.</span></div>${renderChoiceForm(request, `/coordinator/matches/${match.match_id}/score`, [
          ['home_score', 'Home score', 'number'], ['away_score', 'Away score', 'number'], ['status', 'Match status', statusOptions]
        ], 'Save match result', match)}</section>`;
    response.send(renderPage(request, `Manage match ${match.match_id}`, `
      <section class="score-hero"><div><p class="eyebrow">${escapeHtml(match.sport_name)} · ${escapeHtml(match.event_name)} · ${escapeHtml(match.stage_name)} · Match ${match.match_id} · ${escapeHtml(match.status)}</p><h2>${escapeHtml(match.home_team)} <span>vs</span> ${escapeHtml(match.away_team)}</h2><strong>${escapeHtml(resultText)}</strong></div><div class="score-hero-numbers"><b>${escapeHtml(match.home_score)}</b><span>–</span><b>${escapeHtml(match.away_score)}</b></div></section>
      ${scoreSection}
      ${match.status === 'completed' ? '' : `<section class="card score-card"><div class="section-heading"><div><p class="eyebrow">Optional</p><h2>Reschedule match</h2></div></div>${renderChoiceForm(request, `/coordinator/matches/${match.match_id}/reschedule`, [
        ['venue_id', 'Venue', venues], ['starts_at', 'Start time', 'datetime-local'], ['duration_minutes', 'Duration minutes', 'number']
      ], 'Reschedule', match)}</section>`}
      <p><a href="/coordinator">Back to coordinator dashboard</a></p>`));
  } catch (error) { next(error); }
});

app.post('/coordinator/matches/:id/score', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    await pool.execute('UPDATE `match` SET home_score = ?, away_score = ?, status = ? WHERE match_id = ?', [Number(request.body.home_score), Number(request.body.away_score), request.body.status, Number(request.params.id)]);
    response.redirect(`/coordinator/matches/${request.params.id}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Score update rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.post('/coordinator/matches/:id/reschedule', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const startsAt = request.body.starts_at ? String(request.body.starts_at).replace('T', ' ') : null;
    await pool.execute('UPDATE `match` SET venue_id = ?, starts_at = ?, duration_minutes = ? WHERE match_id = ?', [Number(request.body.venue_id), startsAt, Number(request.body.duration_minutes), Number(request.params.id)]);
    response.redirect(`/coordinator/matches/${request.params.id}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Reschedule rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.post('/coordinator/advance', requireRole('coordinator', 'admin'), async (request, response, next) => {
  try {
    const startAt = request.body.start_at ? String(request.body.start_at).replace('T', ' ') : null;
    await pool.execute('CALL sp_advance_knockout(?, ?, ?, ?)', [Number(request.body.source_stage_id), Number(request.body.target_stage_id), Number(request.body.venue_id), startAt]);
    response.redirect('/coordinator');
  } catch (error) {
    response.status(400).send(renderPage(request, 'Knockout advancement rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

async function handleAwardsAssign(request, response, next) {
  try {
    const eventId = Number(request.body.event_id);
    const stageId = Number(request.body.final_stage_id);
    const awardedAt = request.body.awarded_at ? String(request.body.awarded_at).slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!eventId || !stageId) {
      throw { errno: 1644, sqlMessage: 'Please select both an event and its deciding stage.' };
    }

    const [stageRows] = await pool.execute(
      `SELECT st.stage_id, st.name AS stage_name, st.stage_type, e.name AS event_name
       FROM stage st JOIN \`event\` e ON e.event_id = st.event_id
       WHERE st.stage_id = ? AND st.event_id = ?`,
      [stageId, eventId]
    );
    const stage = stageRows[0];
    if (!stage) {
      throw { errno: 1644, sqlMessage: 'The selected stage does not belong to the selected event.' };
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let awardsAssigned = 0;

      if (stage.stage_type === 'final' || stage.stage_type === 'knockout') {
        const [matches] = await connection.execute(
          `SELECT match_id, home_team_id, away_team_id, home_score, away_score
           FROM \`match\`
           WHERE stage_id = ? AND status = 'completed' AND home_score <> away_score
           ORDER BY match_id DESC LIMIT 1`,
          [stageId]
        );
        const finalMatch = matches[0];
        if (!finalMatch) {
          throw { errno: 1644, sqlMessage: `Stage "${stage.stage_name}" has no completed match with a decisive winner. Record the final score in Match Control before awarding.` };
        }

        // Execute stored procedure to assign final medals
        await connection.execute('CALL sp_assign_awards(?, ?, ?)', [eventId, stageId, awardedAt]);
        awardsAssigned = 2;
      } else {
        // Group or league stage: award based on points table standings
        const [standings] = await connection.execute(
          `SELECT team_id, team_name, points_position
           FROM v_points_table
           WHERE event_id = ? AND stage_id = ?
           ORDER BY points_position ASC, points DESC, goal_difference DESC`,
          [eventId, stageId]
        );

        if (standings.length < 2) {
          throw { errno: 1644, sqlMessage: `Group "${stage.stage_name}" requires at least 2 teams with completed match standings in the points table.` };
        }

        await connection.execute(`DELETE FROM award WHERE event_id = ? AND award_type IN ('gold', 'silver', 'bronze')`, [eventId]);
        await connection.execute(
          `INSERT INTO award (event_id, team_id, award_type, award_rank, awarded_at) VALUES (?, ?, 'gold', 1, ?)`,
          [eventId, standings[0].team_id, awardedAt]
        );
        await connection.execute(
          `INSERT INTO award (event_id, team_id, award_type, award_rank, awarded_at) VALUES (?, ?, 'silver', 2, ?)`,
          [eventId, standings[1].team_id, awardedAt]
        );
        awardsAssigned = 2;

        if (standings.length >= 3) {
          await connection.execute(
            `INSERT INTO award (event_id, team_id, award_type, award_rank, awarded_at) VALUES (?, ?, 'bronze', 3, ?)`,
            [eventId, standings[2].team_id, awardedAt]
          );
          awardsAssigned = 3;
        }
      }

      await connection.commit();
      response.redirect(`/coordinator?message=${encodeURIComponent('✓ Successfully assigned ' + awardsAssigned + ' championship medals for ' + stage.event_name + '!')}&tone=success`);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    response.status(400).send(renderPage(request, 'Award assignment rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p><p><a class="button button-secondary" href="/coordinator">← Back to match control</a></p>`));
  }
}

async function handleAwardsReset(request, response, next) {
  try {
    const eventId = Number(request.body.event_id);
    if (!eventId) throw { errno: 1644, sqlMessage: 'Please select an event to clear awards.' };
    const [eventRows] = await pool.execute('SELECT name FROM `event` WHERE event_id = ?', [eventId]);
    const event = eventRows[0];
    await pool.execute('DELETE FROM award WHERE event_id = ?', [eventId]);
    response.redirect(`/coordinator?message=${encodeURIComponent('Cleared all medals for ' + (event?.name || 'event') + '.')}&tone=info`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Clear awards rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p><p><a class="button button-secondary" href="/coordinator">← Back to match control</a></p>`));
  }
}

app.post('/coordinator/awards', requireRole('coordinator', 'admin'), handleAwardsAssign);
app.post('/coordinator/awards/reset', requireRole('coordinator', 'admin'), handleAwardsReset);
app.post('/admin/awards', requireRole('coordinator', 'admin'), handleAwardsAssign);
app.post('/admin/awards/reset', requireRole('coordinator', 'admin'), handleAwardsReset);

app.get('/admin', requireRole('admin'), async (request, response, next) => {
  try {
    const resourceEntries = Object.entries(ADMIN_RESOURCES);
    const countRows = await Promise.all(resourceEntries.map(async ([key, resource]) => {
      const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${resource.table}\``);
      return [key, Number(rows[0].total)];
    }));
    const counts = Object.fromEntries(countRows);
    const cards = resourceEntries.map(([key, resource]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const icon = label.slice(0, 1);
      return `<a class="admin-tile" href="/admin/${escapeHtml(key)}"><span class="admin-tile-icon">${escapeHtml(icon)}</span><span class="admin-tile-copy"><strong>${escapeHtml(label)}</strong><small>Manage ${escapeHtml(resource.table.replace('_', ' '))}</small></span><span class="admin-tile-count">${escapeHtml(counts[key])}</span><span class="admin-tile-arrow" aria-hidden="true">→</span></a>`;
    }).join('');
    response.send(renderPage(request, 'Admin dashboard', `<section class="admin-welcome"><div><p class="eyebrow">Administration</p><h2>Keep the tournament moving.</h2><p>Manage competition data, participants, and official results from one place.</p></div><div class="admin-welcome-mark" aria-hidden="true">CS</div></section><section class="admin-section"><div class="section-heading"><div><p class="eyebrow">Data management</p><h2>Management areas</h2></div><span class="muted">${resourceEntries.length} areas</span></div><div class="admin-grid">${cards}</div></section><p class="muted">Match scores, completion status, knockout advancement, and award assignment are now managed from <a href="/coordinator">Match control</a>.</p>`, { subtitle: 'Manage tournament data and competition operations.' }));
  } catch (error) { next(error); }
});

app.get('/admin/:resource', requireRole('admin'), async (request, response, next) => {
  try {
    const resource = ADMIN_RESOURCES[request.params.resource];
    if (!resource) return response.status(404).send(renderPage(request, 'Not found', '<p>Unknown admin resource.</p>'));
    const [rows] = await pool.query(`SELECT * FROM \`${resource.table}\` ORDER BY ${resource.primaryKey} DESC LIMIT 100`);
    const displayRows = await decorateAdminRows(request.params.resource, rows);
    const columns = resource.fields.filter(([name]) => name !== 'password').map(([name, label]) => ({ name, label }));
    const form = await renderAdminForm(request, request.params.resource, `/admin/${request.params.resource}`, 'Create');
    response.send(renderPage(request, `Manage ${request.params.resource}`, form +
      renderTable(columns, displayRows, (row, index) => {
        const pk = rows[index][resource.primaryKey];
        const eventHubLink = request.params.resource === 'events' ? `<a href="/events/${pk}" style="margin-right: 0.5rem; font-weight: 600;">View Hub</a>` : '';
        return `<td>${eventHubLink}<a href="/admin/${request.params.resource}/${pk}">Edit</a>
        <form method="post" action="/admin/${request.params.resource}/${pk}/delete" class="inline">${renderFormToken(request)}<button type="submit">Delete</button></form></td>`;
      })));
  } catch (error) { next(error); }
});

app.get('/admin/:resource/:id', requireRole('admin'), async (request, response, next) => {
  try {
    const resource = ADMIN_RESOURCES[request.params.resource];
    if (!resource) return response.status(404).send(renderPage(request, 'Not found', '<p>Unknown admin resource.</p>'));
    const [rows] = await pool.execute(`SELECT * FROM \`${resource.table}\` WHERE ${resource.primaryKey} = ?`, [Number(request.params.id)]);
    if (!rows[0]) return response.status(404).send(renderPage(request, 'Not found', '<p>Record not found.</p>'));
    response.send(renderPage(request, `Edit ${request.params.resource}`, await renderAdminForm(request, request.params.resource, `/admin/${request.params.resource}/${request.params.id}`, 'Save', rows[0])));
  } catch (error) { next(error); }
});

app.post('/admin/:resource', requireRole('admin'), async (request, response, next) => {
  await adminSave(request, response, next, false);
});

app.post('/admin/:resource/:id', requireRole('admin'), async (request, response, next) => {
  await adminSave(request, response, next, true);
});

async function adminSave(request, response, next, editing) {
  try {
    const resource = ADMIN_RESOURCES[request.params.resource];
    if (!resource) return response.status(404).send(renderPage(request, 'Not found', '<p>Unknown admin resource.</p>'));
    let teamDepartmentId = resource.table === 'team' ? parseOptionalInteger(request.body.department_id) : null;
    const teamCaptainId = resource.table === 'team' ? parseOptionalInteger(request.body.captain_id) : null;
    if (resource.table === 'team' && teamCaptainId) {
      const [captains] = await pool.execute('SELECT department_id FROM student WHERE student_id = ?', [teamCaptainId]);
      if (!captains[0]) {
        const error = { errno: 1452 };
        throw error;
      }
      if (teamDepartmentId && Number(captains[0].department_id) !== teamDepartmentId) {
        const error = { errno: 1644, sqlMessage: 'The captain must belong to the selected department.' };
        throw error;
      }
      teamDepartmentId ||= Number(captains[0].department_id);
    }
    const values = [];
    const assignments = [];
    const columns = [];
    for (const [name] of resource.fields) {
      if (name === 'password') continue;
      let value = name === 'department_id' && resource.table === 'team' ? teamDepartmentId : request.body[name];
      if (name.endsWith('_id')) value = parseOptionalInteger(value);
      if (value === '' || Number.isNaN(value)) value = null;
      if (editing) {
        assignments.push(`\`${name}\` = ?`);
      } else {
        columns.push(`\`${name}\``);
      }
      values.push(value);
    }
    if (resource.table === 'app_user' && request.body.password) {
      const hash = await bcrypt.hash(request.body.password, 12);
      if (editing) {
        assignments.push('password_hash = ?');
      } else {
        columns.push('`password_hash`');
      }
      values.push(hash);
    } else if (!editing && resource.table === 'app_user') {
      return response.status(400).send(renderPage(request, 'Invalid user', '<p>A password is required when creating a user.</p>'));
    }
    if (resource.table === 'team') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        let teamId;
        if (editing) {
          teamId = Number(request.params.id);
          await connection.execute(`UPDATE \`${resource.table}\` SET ${assignments.join(', ')} WHERE ${resource.primaryKey} = ?`, [...values, teamId]);
        } else {
          const placeholders = columns.map(() => '?').join(', ');
          const [result] = await connection.execute(`INSERT INTO \`${resource.table}\` (${columns.join(', ')}) VALUES (${placeholders})`, values);
          teamId = result.insertId;
        }
        if (teamCaptainId) {
          await connection.execute(
            `INSERT INTO team_member (team_id, student_id, jersey_number)
             SELECT ?, ?, COALESCE(MAX(existing.jersey_number) + 1, 0)
             FROM team_member existing
             WHERE existing.team_id = ?
             ON DUPLICATE KEY UPDATE team_id = VALUES(team_id)`,
            [teamId, teamCaptainId, teamId]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else if (editing) {
      await pool.execute(`UPDATE \`${resource.table}\` SET ${assignments.join(', ')} WHERE ${resource.primaryKey} = ?`, [...values, Number(request.params.id)]);
    } else {
      const placeholders = columns.map(() => '?').join(', ');
      const [result] = await pool.execute(`INSERT INTO \`${resource.table}\` (${columns.join(', ')}) VALUES (${placeholders})`, values);
      if (resource.table === 'event') {
        return response.redirect(`/admin/events/${result.insertId}/setup`);
      }
    }
    response.redirect(`/admin/${request.params.resource}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Admin operation rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
}

app.get('/admin/events/:id/setup', requireRole('admin'), async (request, response, next) => {
    try {
      const eventId = Number(request.params.id);
      const [eventRows] = await pool.execute(
        `SELECT e.event_id, e.name, e.format, e.gender_category, s.name AS sport_name, s.is_team_sport,
                t.name AS tournament_name
         FROM \`event\` e
         JOIN sport s ON s.sport_id = e.sport_id
         JOIN tournament t ON t.tournament_id = e.tournament_id
         WHERE e.event_id = ?`,
        [eventId]
      );
      const event = eventRows[0];
      if (!event) return response.status(404).send(renderPage(request, 'Event not found', '<p>No such event exists.</p>'));
      const isTeamSport = Boolean(event.is_team_sport);
      const [teams] = await pool.execute(
        `SELECT t.team_id, t.name AS team_name, d.name AS department_name,
                EXISTS (SELECT 1 FROM registration r WHERE r.event_id = ? AND r.team_id = t.team_id) AS registered
         FROM team t JOIN department d ON d.department_id = t.department_id
         ORDER BY registered DESC, d.name, t.name`,
        [eventId]
      );
      const [stages] = await pool.execute(
        `SELECT st.stage_id, st.name AS stage_name, st.stage_type, st.stage_order,
                COUNT(m.match_id) AS match_count
         FROM stage st LEFT JOIN \`match\` m ON m.stage_id = st.stage_id
         WHERE st.event_id = ?
         GROUP BY st.stage_id, st.name, st.stage_type, st.stage_order
         ORDER BY st.stage_order`,
        [eventId]
      );
      const [matches] = await pool.execute(
        `SELECT st.name AS stage_name, home.name AS home_team, away.name AS away_team,
                m.starts_at, m.status, m.home_score, m.away_score
         FROM \`match\` m
         JOIN stage st ON st.stage_id = m.stage_id
         JOIN team home ON home.team_id = m.home_team_id
         JOIN team away ON away.team_id = m.away_team_id
         WHERE st.event_id = ?
         ORDER BY st.stage_order, m.starts_at`,
        [eventId]
      );
      const [entrants] = await pool.execute(
        `SELECT r.registration_id, s.full_name, s.roll_number, d.name AS department_name
         FROM registration r
         JOIN student s ON s.student_id = r.student_id
         JOIN department d ON d.department_id = s.department_id
         WHERE r.event_id = ? AND r.student_id IS NOT NULL
         ORDER BY s.full_name`,
        [eventId]
      );
      const [students] = await pool.execute(
        `SELECT s.student_id, s.full_name, s.roll_number, d.name AS department_name,
                EXISTS (SELECT 1 FROM registration r WHERE r.event_id = ? AND r.student_id = s.student_id) AS registered
         FROM student s
         JOIN department d ON d.department_id = s.department_id
         ORDER BY registered DESC, s.full_name`,
        [eventId]
      );
      const [individualResults] = await pool.execute(
        `SELECT ir.stage_id, ir.result_value, ir.result_unit, ir.result_rank,
                s.full_name, s.roll_number
         FROM individual_result ir
         JOIN registration r ON r.registration_id = ir.registration_id
         JOIN student s ON s.student_id = r.student_id
         WHERE r.event_id = ?
         ORDER BY ir.stage_id, ir.result_rank, s.full_name`,
        [eventId]
      );
      const [venues] = await pool.query('SELECT venue_id AS id, name AS label FROM venue ORDER BY name');
      const teamOptions = teams.map((team) => `<label class="team-pick ${team.registered ? 'is-selected' : ''}"><input type="checkbox" name="team_ids" value="${team.team_id}"${team.registered ? ' checked' : ''}><span><strong>${escapeHtml(team.team_name)}</strong><small>${escapeHtml(team.department_name)}</small></span></label>`).join('');
      const studentOptions = students.map((student) => `<label class="team-pick ${student.registered ? 'is-selected' : ''}"><input type="checkbox" name="student_ids" value="${student.student_id}"${student.registered ? ' checked' : ''}><span><strong>${escapeHtml(student.full_name)}</strong><small>${escapeHtml(student.roll_number)} · ${escapeHtml(student.department_name)}</small></span></label>`).join('');
      const stageCards = stages.map((stage) => `<div class="setup-stage"><div><span class="eyebrow">${escapeHtml(stage.stage_type)}</span><h3>${escapeHtml(stage.stage_name)}</h3></div><strong>${isTeamSport ? `${escapeHtml(stage.match_count)} matches` : 'Record individual results'}</strong></div>`).join('');
      const heatOptions = stages.filter((stage) => stage.stage_type === 'heat').map((stage) => ({ id: stage.stage_id, label: stage.stage_name }));
      const registeredStudentOptions = entrants.map((entrant) => ({ id: entrant.registration_id, label: `${entrant.full_name} · ${entrant.roll_number}` }));
      const progression = isTeamSport ? 'Teams → groups → matches → knockout → final result' : 'Athletes → heats → individual results → rankings → medals';
      const competitionSetup = isTeamSport
        ? `<section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Step 1</p><h2>Teams in this event</h2></div><span class="muted">${teams.filter((team) => team.registered).length} selected</span></div><p class="muted">Select the department teams that will compete. Saving this list registers them for the event.</p><form method="post" action="/admin/events/${eventId}/teams"><div class="team-pick-grid">${teamOptions || '<p class="muted">Create teams first from the Teams admin area.</p>'}</div>${renderFormToken(request)}<button type="submit">Save participating teams</button></form></section>
          <section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Step 2</p><h2>Create group and matches</h2></div></div><p class="muted">The system creates round-robin matches. Home and away teams are used only because this is a team sport.</p>${renderChoiceForm(request, `/admin/events/${eventId}/fixtures`, [['stage_name', 'Group name', 'text'], ['venue_id', 'Venue', venues], ['start_at', 'First match start', 'datetime-local']], 'Create group and generate matches')}</section>`
        : `<section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Step 1</p><h2>Register students</h2></div><span class="muted">${entrants.length} selected</span></div><p class="muted">Select students for this event. A student may be registered in multiple different events; this list only changes registrations for <strong>${escapeHtml(event.name)}</strong>.</p><form method="post" action="/admin/events/${eventId}/students"><div class="team-pick-grid">${studentOptions || '<p class="muted">Create students first from the Students admin area.</p>'}</div>${renderFormToken(request)}<button type="submit">Save registered students</button></form><div class="entrant-grid">${entrants.map((entrant) => `<div class="entrant-card"><strong>${escapeHtml(entrant.full_name)}</strong><span>${escapeHtml(entrant.roll_number)}</span><small>${escapeHtml(entrant.department_name)}</small></div>`).join('') || '<p class="muted">No students registered yet.</p>'}</div></section>
          <section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Step 2</p><h2>Create a heat</h2></div></div><p class="muted">Create a heat stage for the registered athletes. There are no home or away teams in this event.</p>${renderChoiceForm(request, `/admin/events/${eventId}/heats`, [['heat_name', 'Heat name', 'text']], 'Create heat')}</section>
          <section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Step 3</p><h2>Record an individual result</h2></div></div><p class="muted">Record a time, distance, or points for one registered student in one heat.</p>${renderChoiceForm(request, `/admin/events/${eventId}/results`, [['stage_id', 'Heat', heatOptions], ['registration_id', 'Student', registeredStudentOptions], ['venue_id', 'Venue', venues], ['result_value', 'Result value', 'number'], ['result_unit', 'Unit', [{ id: 'seconds', label: 'Seconds' }, { id: 'metres', label: 'Metres' }, { id: 'points', label: 'Points' }]], ['result_rank', 'Rank', 'number']], 'Save individual result')}</section>`;
      response.send(renderPage(request, `Set up ${event.name}`, `
        <section class="setup-hero"><div><p class="eyebrow">${escapeHtml(event.tournament_name)} · ${escapeHtml(event.sport_name)}</p><h2>${escapeHtml(event.name)}</h2><p class="muted">Progression: ${escapeHtml(progression)}</p></div><span class="setup-format">${escapeHtml(event.format.replace('_', ' '))}</span></section>
        <div class="setup-steps"><span class="active"><b>1</b> ${isTeamSport ? 'Add teams' : 'Register athletes'}</span><span><b>2</b> ${isTeamSport ? 'Create groups and fixtures' : 'Run heats and results'}</span><span><b>3</b> Publish final rankings</span></div>
        ${competitionSetup}
        <section class="card setup-card"><div class="section-heading"><div><p class="eyebrow">Competition map</p><h2>${isTeamSport ? 'Groups and matches' : 'Heats and individual results'}</h2></div></div>${stageCards || emptyState(isTeamSport ? 'No groups yet' : 'No heats yet', isTeamSport ? 'Save participating teams, then create the first group to generate matches.' : 'Create a heat, then record each athlete result.')} ${isTeamSport && matches.length ? `<div class="setup-match-list">${matches.map((match) => `<div class="setup-match"><span>${escapeHtml(match.stage_name)}</span><strong>${escapeHtml(match.home_team)} <em>${match.status === 'completed' || match.status === 'live' ? `${match.home_score} – ${match.away_score}` : 'VS'}</em> ${escapeHtml(match.away_team)}</strong><small>${escapeHtml(formatDateTime(match.starts_at))} · ${escapeHtml(match.status)}</small></div>`).join('')}</div>` : ''} ${!isTeamSport && individualResults.length ? `<div class="setup-match-list">${individualResults.map((result) => `<div class="setup-match"><span>Result</span><strong>${escapeHtml(result.full_name)} <em>${escapeHtml(result.result_value)} ${escapeHtml(result.result_unit)}</em></strong><small>Rank ${escapeHtml(result.result_rank || '—')}</small></div>`).join('')}</div>` : ''}</section>
        <p><a href="/admin/events">Back to events</a> · <a href="/coordinator">Open match control</a></p>
      `, { subtitle: 'A guided setup for teams, groups, fixtures, and results.' }));
    } catch (error) { next(error); }
  });

app.post('/admin/events/:id/teams', requireRole('admin'), async (request, response, next) => {
    const connection = await pool.getConnection();
    try {
      const eventId = Number(request.params.id);
      const [eventRows] = await connection.execute('SELECT s.is_team_sport FROM `event` e JOIN sport s ON s.sport_id = e.sport_id WHERE e.event_id = ?', [eventId]);
      if (!eventRows[0] || !eventRows[0].is_team_sport) throw { errno: 1644, sqlMessage: 'Individual events must register students, not teams.' };
      const rawTeamIds = request.body.team_ids ?? request.body['team_ids[]'] ?? [];
      const teamIds = [...new Set((Array.isArray(rawTeamIds) ? rawTeamIds : [rawTeamIds]).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
      if (teamIds.length < 2) {
        throw { errno: 1644, sqlMessage: 'Please select at least 2 teams to register for this team event.' };
      }
      await connection.beginTransaction();
      await connection.execute('DELETE FROM registration WHERE event_id = ? AND team_id IS NOT NULL', [eventId]);
      for (const teamId of teamIds) {
        await connection.execute('INSERT INTO registration (event_id, team_id, status) VALUES (?, ?, \'approved\')', [eventId, teamId]);
      }
      await connection.commit();
      response.redirect(`/admin/events/${eventId}/setup`);
    } catch (error) {
      await connection.rollback();
      response.status(400).send(renderPage(request, 'Team selection rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
    } finally {
      connection.release();
    }
  });

app.post('/admin/events/:id/students', requireRole('admin'), async (request, response, next) => {
    const connection = await pool.getConnection();
    try {
      const eventId = Number(request.params.id);
      const [eventRows] = await connection.execute(
        `SELECT s.is_team_sport FROM \`event\` e
         JOIN sport s ON s.sport_id = e.sport_id
         WHERE e.event_id = ?`,
        [eventId]
      );
      if (!eventRows[0] || eventRows[0].is_team_sport) {
        throw { errno: 1644, sqlMessage: 'Team events register teams; individual events register students.' };
      }
      const rawStudentIds = request.body.student_ids ?? request.body['student_ids[]'] ?? [];
      const studentIds = [...new Set((Array.isArray(rawStudentIds) ? rawStudentIds : [rawStudentIds]).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
      if (studentIds.length < 1) {
        throw { errno: 1644, sqlMessage: 'Please select at least 1 student to register for this event.' };
      }
      await connection.beginTransaction();
      await connection.execute('DELETE FROM registration WHERE event_id = ? AND student_id IS NOT NULL', [eventId]);
      for (const studentId of studentIds) {
        await connection.execute('INSERT INTO registration (event_id, student_id, status) VALUES (?, ?, \'approved\')', [eventId, studentId]);
      }
      await connection.commit();
      response.redirect(`/admin/events/${eventId}/setup`);
    } catch (error) {
      await connection.rollback();
      response.status(400).send(renderPage(request, 'Student registration rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
    } finally {
      connection.release();
    }
  });

app.post('/admin/events/:id/heats', requireRole('admin'), async (request, response, next) => {
  try {
    const eventId = Number(request.params.id);
    const [sports] = await pool.execute(
      `SELECT s.is_team_sport FROM \`event\` e JOIN sport s ON s.sport_id = e.sport_id WHERE e.event_id = ?`,
      [eventId]
    );
    if (!sports[0] || sports[0].is_team_sport) throw { errno: 1644, sqlMessage: 'Heats are only available for individual events.' };
    const [orders] = await pool.execute('SELECT COALESCE(MAX(stage_order), 0) + 1 AS next_order FROM stage WHERE event_id = ?', [eventId]);
    await pool.execute(
      `INSERT INTO stage (event_id, stage_type, stage_order, name) VALUES (?, 'heat', ?, ?)`,
      [eventId, Number(orders[0].next_order), String(request.body.heat_name || 'Heat').trim()]
    );
    response.redirect(`/admin/events/${eventId}/setup`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Heat creation rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.post('/admin/events/:id/results', requireRole('admin'), async (request, response, next) => {
  try {
    const eventId = Number(request.params.id);
    const [registrations] = await pool.execute(
      `SELECT r.registration_id
       FROM registration r JOIN \`event\` e ON e.event_id = r.event_id
       JOIN sport s ON s.sport_id = e.sport_id
       WHERE r.registration_id = ? AND r.event_id = ? AND r.student_id IS NOT NULL AND s.is_team_sport = FALSE`,
      [Number(request.body.registration_id), eventId]
    );
    if (!registrations[0]) throw { errno: 1644, sqlMessage: 'The selected student is not registered for this individual event.' };
    await pool.execute(
      `INSERT INTO individual_result
        (registration_id, stage_id, venue_id, result_value, result_unit, result_rank)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE venue_id = VALUES(venue_id), result_value = VALUES(result_value),
         result_unit = VALUES(result_unit), result_rank = VALUES(result_rank)`,
      [Number(request.body.registration_id), Number(request.body.stage_id), Number(request.body.venue_id), Number(request.body.result_value), request.body.result_unit, Number(request.body.result_rank)]
    );
    response.redirect(`/admin/events/${eventId}/setup`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Individual result rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.post('/admin/events/:id/fixtures', requireRole('admin'), async (request, response, next) => {
    const connection = await pool.getConnection();
    try {
      const eventId = Number(request.params.id);
      const [eventRows] = await connection.execute('SELECT s.is_team_sport FROM `event` e JOIN sport s ON s.sport_id = e.sport_id WHERE e.event_id = ?', [eventId]);
      if (!eventRows[0] || !eventRows[0].is_team_sport) throw { errno: 1644, sqlMessage: 'Individual events use heats and individual results, not team fixtures.' };
      const venueId = Number(request.body.venue_id);
      const startAt = request.body.start_at ? String(request.body.start_at).replace('T', ' ') : null;
      if (!venueId || !startAt) {
        throw { errno: 1644, sqlMessage: 'Please select a venue and a valid first match start date and time.' };
      }
      const [regRows] = await connection.execute(
        "SELECT COUNT(*) AS team_count FROM registration WHERE event_id = ? AND team_id IS NOT NULL AND status = 'approved'",
        [eventId]
      );
      if (!regRows[0] || regRows[0].team_count < 2) {
        throw { errno: 1644, sqlMessage: 'At least 2 approved teams must be registered for this event before generating fixtures.' };
      }
      const [existing] = await connection.execute(
        "SELECT st.stage_id, COUNT(m.match_id) AS match_count FROM stage st LEFT JOIN `match` m ON m.stage_id = st.stage_id WHERE st.event_id = ? AND st.stage_type = 'group' GROUP BY st.stage_id LIMIT 1",
        [eventId]
      );
      await connection.beginTransaction();
      let stageId;
      if (existing[0]) {
        if (existing[0].match_count > 0) {
          throw { errno: 1644, sqlMessage: 'This event already has a group with matches generated. Open the setup page to review its matches.' };
        }
        stageId = existing[0].stage_id;
      } else {
        const [stage] = await connection.execute(
          "INSERT INTO stage (event_id, stage_type, stage_order, name) VALUES (?, 'group', 1, ?)",
          [eventId, String(request.body.stage_name || 'Group A').trim()]
        );
        stageId = stage.insertId;
      }
      await connection.query('CALL sp_generate_group_fixtures(?, ?, ?)', [stageId, venueId, startAt]);
      await connection.commit();
      response.redirect(`/admin/events/${eventId}/setup`);
    } catch (error) {
      await connection.rollback();
      response.status(400).send(renderPage(request, 'Fixture setup rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
    } finally {
      connection.release();
    }
});

app.post('/admin/:resource/:id/delete', requireRole('admin'), async (request, response, next) => {
  try {
    const resource = ADMIN_RESOURCES[request.params.resource];
    if (!resource) return response.status(404).send(renderPage(request, 'Not found', '<p>Unknown admin resource.</p>'));
    await pool.execute(`DELETE FROM \`${resource.table}\` WHERE ${resource.primaryKey} = ?`, [Number(request.params.id)]);
    response.redirect(`/admin/${request.params.resource}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Delete rejected', `<p>${escapeHtml(humanDatabaseError(error))}</p>`));
  }
});

app.use((error, request, response, _next) => {
  console.error(`Request failed: ${error.code || error.name || 'unknown error'}`);
  response.status(500).send(renderPage(request, 'Operation failed', '<p>The operation could not be completed. Check the server log for the error code.</p>'));
});

const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(port, () => console.log(`Campus Sports app listening on port ${port}`));
}

module.exports = { app, pool, ADMIN_RESOURCES };
