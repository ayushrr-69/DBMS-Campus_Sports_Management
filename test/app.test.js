const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { app, pool } = require('../app/server');

const passwords = {
  admin: process.env.DEMO_ADMIN_PASSWORD,
  coordinator: process.env.DEMO_COORDINATOR_PASSWORD,
  player: process.env.DEMO_PLAYER_PASSWORD,
  viewer: process.env.DEMO_VIEWER_PASSWORD
};
const usernames = {
  admin: 'admin.demo',
  coordinator: 'coordinator.demo',
  player: 'player.demo',
  viewer: 'viewer.demo'
};

async function formToken(agent) {
  const response = await agent.get('/login');
  assert.equal(response.status, 200);
  const match = response.text.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, 'login form should contain a CSRF token');
  return match[1];
}

async function login(role) {
  assert.ok(passwords[role], `DEMO_${role.toUpperCase()}_PASSWORD must be configured`);
  const agent = request.agent(app);
  const token = await formToken(agent);
  const response = await agent.post('/login').type('form').send({
    _csrf: token,
    username: usernames[role],
    password: passwords[role],
    next: '/'
  });
  assert.equal(response.status, 302);
  return agent;
}

test.after(async () => {
  await pool.end();
});

test('login succeeds and invalid login is rejected', async () => {
  const agent = await login('viewer');
  const publicPage = await agent.get('/points');
  assert.equal(publicPage.status, 200);

  const invalidAgent = request.agent(app);
  const token = await formToken(invalidAgent);
  const response = await invalidAgent.post('/login').type('form').send({
    _csrf: token, username: usernames.viewer, password: 'definitely-not-the-password'
  });
  assert.equal(response.status, 401);
  assert.match(response.text, /Username or password is incorrect/);
});

test('role restrictions deny a viewer access to coordinator pages', async () => {
  const agent = await login('viewer');
  const response = await agent.get('/coordinator');
  assert.equal(response.status, 403);
  assert.match(response.text, /Access denied/);
});

test('participant accounts are view-only and cannot edit registrations', async () => {
  const agent = await login('player');
  const token = await formToken(agent);
  const dashboard = await agent.get('/player');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /view-only/i);
  const rejected = await agent.post('/player/registrations').type('form').send({
    _csrf: token, event_id: 3
  });
  assert.equal(rejected.status, 403);
  assert.match(rejected.text, /view-only|coordinators|administrators/i);
});

test('venue clash is shown as a human-readable coordinator error', async () => {
  const agent = await login('coordinator');
  const token = await formToken(agent);
  const response = await agent.post('/coordinator/matches').type('form').send({
    _csrf: token, stage_id: 1, venue_id: 1, home_team_id: 1, away_team_id: 2,
    starts_at: '2026-11-01T09:00', duration_minutes: 90
  });
  assert.equal(response.status, 400);
  assert.match(response.text, /venue|clash|database rejected/i);
});

test('score entry updates the points table', async () => {
  const agent = await login('coordinator');
  const [created] = await pool.execute(
    `INSERT INTO \`match\`
      (stage_id, venue_id, home_team_id, away_team_id, starts_at, duration_minutes, home_score, away_score, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'scheduled')`,
    [1, 1, 1, 2, '2027-01-01 09:00:00', 90]
  );
  const matchId = created.insertId;
  const before = await pool.query('SELECT points FROM v_points_table WHERE team_id = 1 AND stage_id = 1');
  const token = await formToken(agent);
  const response = await agent.post(`/coordinator/matches/${matchId}/score`).type('form').send({
    _csrf: token, home_score: 3, away_score: 0, status: 'completed'
  });
  assert.equal(response.status, 302);
  const after = await pool.query('SELECT points FROM v_points_table WHERE team_id = 1 AND stage_id = 1');
  assert.notDeepEqual(after[0], before[0]);
  await pool.execute('DELETE FROM `match` WHERE match_id = ?', [matchId]);
});

test('completed match remains locked', async () => {
  const agent = await login('coordinator');
  const token = await formToken(agent);
  const response = await agent.post('/coordinator/matches/1/score').type('form').send({
    _csrf: token, home_score: 9, away_score: 9, status: 'completed'
  });
  assert.equal(response.status, 400);
  assert.match(response.text, /completed|locked|database rejected/i);
});

test('assign awards supports knockout final and group standings, and permits reset', async () => {
  const agent = await login('coordinator');

  // Test coordinator can view award section on match control
  const coordPage = await agent.get('/coordinator');
  assert.equal(coordPage.status, 200);
  assert.match(coordPage.text, /Assign awards/);
  assert.match(coordPage.text, /action="\/coordinator\/awards"/);

  // Test assigning awards for Cricket11 (group stage)
  const token1 = await formToken(agent);
  const resCricket = await agent.post('/coordinator/awards').type('form').send({
    _csrf: token1,
    event_id: 5,
    final_stage_id: 9,
    awarded_at: '2026-10-19'
  });
  assert.equal(resCricket.status, 302);

  const [cricketAwards] = await pool.query('SELECT a.*, t.name AS team_name FROM award a JOIN team t ON t.team_id = a.team_id WHERE a.event_id = 5 ORDER BY a.award_rank');
  assert.equal(cricketAwards.length, 3);
  assert.equal(cricketAwards[0].award_type, 'gold');
  assert.equal(cricketAwards[0].team_name, 'Electrical Eagles');
  assert.equal(cricketAwards[1].award_type, 'silver');
  assert.equal(cricketAwards[1].team_name, 'CSE Strikers');
  assert.equal(cricketAwards[2].award_type, 'bronze');
  assert.equal(cricketAwards[2].team_name, 'Mechanical United');

  // Test assigning awards for Men Football (knockout final stage)
  const token2 = await formToken(agent);
  const resFootball = await agent.post('/coordinator/awards').type('form').send({
    _csrf: token2,
    event_id: 1,
    final_stage_id: 5,
    awarded_at: '2026-10-19'
  });
  assert.equal(resFootball.status, 302);

  const [footballAwards] = await pool.query('SELECT a.*, t.name AS team_name FROM award a JOIN team t ON t.team_id = a.team_id WHERE a.event_id = 1 ORDER BY a.award_rank');
  assert.equal(footballAwards.length, 2);
  assert.equal(footballAwards[0].award_type, 'gold');
  assert.equal(footballAwards[0].team_name, 'CSE Strikers');
  assert.equal(footballAwards[1].award_type, 'silver');
  assert.equal(footballAwards[1].team_name, 'CSE Challengers');

  // Test clearing awards
  const token3 = await formToken(agent);
  const resetRes = await agent.post('/coordinator/awards/reset').type('form').send({
    _csrf: token3,
    event_id: 5
  });
  assert.equal(resetRes.status, 302);
  const [cleared] = await pool.query('SELECT * FROM award WHERE event_id = 5');
  assert.equal(cleared.length, 0);

  // Restore Cricket awards for consistent demo data
  const token4 = await formToken(agent);
  await agent.post('/coordinator/awards').type('form').send({
    _csrf: token4,
    event_id: 5,
    final_stage_id: 9,
    awarded_at: '2026-10-19'
  });
});

test('coordinator can add student to a team roster and remove them, and cross-department addition is rejected', async () => {
  const agent = await login('coordinator');

  // Find a student in team 2's department (department 2) who is not yet in team 2
  const [sameDeptCandidates] = await pool.query(
    'SELECT student_id FROM student WHERE department_id = (SELECT department_id FROM team WHERE team_id = 2) AND student_id NOT IN (SELECT student_id FROM team_member WHERE team_id = 2) LIMIT 1'
  );
  assert.ok(sameDeptCandidates.length > 0, 'Should find at least one same-department student not in team 2');
  const validStudentId = sameDeptCandidates[0].student_id;

  // Find a student from a different department (e.g. CSE, department 1)
  const [diffDeptCandidates] = await pool.query(
    'SELECT student_id FROM student WHERE department_id <> (SELECT department_id FROM team WHERE team_id = 2) LIMIT 1'
  );
  assert.ok(diffDeptCandidates.length > 0, 'Should find at least one different-department student');
  const invalidStudentId = diffDeptCandidates[0].student_id;

  // 1. Cross-department attempt should be rejected with 400
  const token0 = await formToken(agent);
  const rejectRes = await agent.post('/teams/2/members').type('form').send({
    _csrf: token0,
    student_id: invalidStudentId,
    jersey_number: 99
  });
  assert.equal(rejectRes.status, 400);

  // 2. Same-department student should succeed
  const token1 = await formToken(agent);
  const addRes = await agent.post('/teams/2/members').type('form').send({
    _csrf: token1,
    student_id: validStudentId,
    jersey_number: 44
  });
  assert.equal(addRes.status, 302);

  const [added] = await pool.query('SELECT * FROM team_member WHERE team_id = 2 AND student_id = ?', [validStudentId]);
  assert.equal(added.length, 1);
  assert.equal(added[0].jersey_number, 44);

  // 3. Remove student
  const token2 = await formToken(agent);
  const remRes = await agent.post(`/teams/2/members/${validStudentId}/remove`).type('form').send({
    _csrf: token2
  });
  assert.equal(remRes.status, 302);

  const [removed] = await pool.query('SELECT * FROM team_member WHERE team_id = 2 AND student_id = ?', [validStudentId]);
  assert.equal(removed.length, 0);
});

