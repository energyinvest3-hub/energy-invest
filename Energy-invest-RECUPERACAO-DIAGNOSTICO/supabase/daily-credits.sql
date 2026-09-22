-- Daily project credit schedule.
-- Credits are created at purchase time and become due exactly every 24 hours from the purchase timestamp.
-- pg_cron processes due credits every minute, so wallet availability can lag the exact anniversary by up to ~1 minute.

update public.solar_projects
set duration_days = 10,
    daily_projected_return = round((investment_amount * return_multiplier) / 10, 2),
    end_date = start_date + interval '10 days';

update public.user_projects up
set ends_at = up.started_at + interval '10 days'
where up.status='active';

-- Existing active holdings are backfilled with a 10-credit schedule.
delete from public.project_credits pc
using public.user_projects up
where pc.user_project_id=up.id
  and up.status='active'
  and pc.status='pending';

-- The live project also uses public.purchase_solar_project to create one pending credit
-- for each 24-hour anniversary and private.process_due_project_credits to settle them.
-- See the production migration daily_24h_project_credits_ten_day_terms.
