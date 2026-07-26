-- Base migration: verifies the migration pipeline (local push + CI) works end-to-end.
-- No application tables are created here — each table is created by the first
-- story that actually needs it (see Story 1.1 Dev Notes: Entity/Code Creation Timing).
-- RLS is enabled per-table, starting with Story 1.4's `profiles` migration, not here.
select 1;
