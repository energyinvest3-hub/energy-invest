-- Run only after schema.sql in the dedicated Supabase project.
-- Supabase Cron uses pg_cron and records each execution in cron.job_run_details.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'energyinvest-process-due-credits',
  '* * * * *',
  $$select private.process_due_project_credits(500);$$
);
