# Viva Questions

## DBMS and relational design

1. **Why is this an RDBMS project?**  
   It stores related facts in normalized relations connected by primary and foreign keys, then uses SQL, views, constraints, triggers, and routines.
2. **Why is the schema the main product?**  
   Tournament integrity, eligibility, standings, scheduling, and score consistency belong in the database so every client sees the same rules.
3. **Why use 17 tables?**  
   The blueprint covers the required entities while remaining within the 13–20 table target.
4. **Why are standings a view?**  
   They are derived from match results, so a view avoids stale duplicated standings data.

## Keys and integrity

5. **What is the difference between a primary key and a candidate key?**  
   A candidate key can uniquely identify a row; the chosen candidate becomes the primary key. For example, `student_id` is primary while `roll_number` is an alternate candidate key.
6. **Why does `team_member` use a composite key?**  
   A student can occur only once in a particular team, so `(team_id, student_id)` identifies one membership.
7. **Why are there two nullable foreign keys in `registration`?**  
   A normal FK cannot point to either `student` or `team`. Two real FKs plus an exactly-one CHECK preserve referential integrity.
8. **Why are some deletes restricted?**  
   Historical registrations, matches, awards, and participants should not disappear accidentally. Child-only facts such as team membership can cascade.
9. **Why are `result_rank` and `award_rank` used instead of `rank`?**  
   `RANK` is reserved by MySQL 8.0 window-function syntax.

## Normalization

10. **What problem does 1NF solve?**  
    It removes repeating groups and list-valued fields, such as a list of players inside one match row.
11. **What does 2NF add?**  
    It removes partial dependencies on part of a composite key. Team and student facts are not stored in `team_member`.
12. **What does 3NF prevent?**  
    It prevents non-key attributes from depending transitively on another non-key attribute.
13. **What is the deliberate denormalization?**  
    Match scores are stored on `match` while `match_event` preserves the scoring audit trail. A trigger keeps inserted goal scores synchronized.

## ACID and relational algebra

14. **How is atomicity demonstrated?**  
    The transaction inserts a match and its goal event together before COMMIT.
15. **How is rollback demonstrated?**  
    A registration status update is made inside a transaction and then rolled back; the original status remains.
16. **What is referential integrity?**  
    A foreign-key value must refer to an existing parent row or be NULL when optional.
17. **What does selection mean in relational algebra?**  
    Selection (`σ`) filters rows by a predicate.
18. **What does projection mean?**  
    Projection (`π`) chooses columns.
19. **Why use a join?**  
    A join combines related rows, such as students with their departments.
20. **What does set difference show in this project?**  
    It can find students who are not registered for athletics.

## Database logic and app

21. **Why use a trigger for venue clashes?**  
    Any client inserting a match must obey the overlap rule, not only the web app.
22. **Why use a stored procedure for fixtures?**  
    Round-robin generation is database logic and can be called consistently by different clients.
23. **What does the app do?**  
    It reads the four views and calls a procedure; it does not calculate standings or bypass constraints.
24. **Why should the app not use root?**  
    The runtime uses the separate `campus_app` account with only project CRUD and EXECUTE privileges; `campus_dev` is reserved for SQL validation.

## Web security and application roles

25. **How does login work?**  
    The app loads the selected `app_user` row with a parameterized query and verifies the submitted password against its bcrypt hash. Plain passwords are never stored.
26. **Where is session state stored?**  
    Express server-side sessions hold the authenticated user ID, username, role, and optional student ID. The browser receives only an HTTP-only session cookie.
27. **How are roles enforced?**  
    Middleware checks the session role on every protected route. Hiding a link is only a usability feature; authorization is enforced before the handler runs.
28. **Why is CSRF protection needed?**  
    A browser automatically sends session cookies, so every POST form includes a random session token that must match before the write is accepted.
29. **Why does the app call database rules instead of repeating them in JavaScript?**  
    Eligibility, venue clashes, score synchronization, and locking must also protect Workbench and future clients. The app displays database rejection messages rather than replacing those rules.
30. **How are SQL injection and XSS addressed?**  
    Values use mysql2 placeholders, dynamic identifiers come only from a static allowlist, and rendered values are HTML-escaped.
31. **What does least privilege mean here?**  
    The running app uses `campus_app` on `campus_sports`; it never uses root or the SQL-validation account.
