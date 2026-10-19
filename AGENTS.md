# Campus Sports Tournament Management System

## Purpose

This is a college DBMS lab group project for a campus sports tournament management system. The database is the main product; the future Node.js/Express application is a thin layer over database views and procedures.

## Handoff reading order

1. `AGENTS.md`
2. `docs/handoff/STATUS.md`
3. `docs/handoff/TODO.md`
4. The current phase document in `docs/`
5. `docs/handoff/DECISIONS.md` and `docs/handoff/SCHEMA_NOTES.md`

## Fixed choices

- MySQL 8.0 Community Edition, installed locally, using InnoDB and `utf8mb4`
- Node.js with Express for the later web application
- Crow's-foot ER notation
- Group project with a required viva/oral defense
- Initial blueprint of 17 tables; ask before exceeding 20 tables
- Singular `snake_case` table names and `<table>_id` primary keys
- Never use MySQL 8.0 reserved words as table, column, or other SQL identifiers; choose explicit names such as `result_rank` instead of `rank`.
- The application connects with `APP_DB_USER`/`APP_DB_PASSWORD` as `campus_app`; `campus_dev` is reserved for SQL-file validation.
- Never commit `.env`, plaintext passwords, password hashes generated from known demo passwords, or session secrets.

## Non-negotiable workflow

- Phases 1 to 3 are documents only.
- Do not write SQL or application code until the user explicitly approves `docs/normalization.md`.
- Keep business rules in database constraints, triggers, views, functions, and procedures rather than app code.
- Test every SQL file on a clean MySQL instance and report errors honestly.
- Explain design decisions in plain language and record them in `docs/handoff/DECISIONS.md`.
- Any outside-repository action requires numbered Windows 11 instructions, a log entry in `MANUAL_STEPS.md`, and user confirmation.
- Update `docs/handoff/STATUS.md` and `docs/handoff/TODO.md` after every phase and before stopping.

## Current work

Read `docs/handoff/STATUS.md` for the current phase and exact next step. For a compact transfer summary, read `docs/handoff/NEXT_AGENT.md`.
