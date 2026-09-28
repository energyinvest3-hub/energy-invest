-- EnergyInvest — corrige permissão para editar/criar projetos
-- A coluna return_multiplier foi adicionada depois do schema base,
-- mas não recebeu GRANT de INSERT/UPDATE para o role authenticated.
begin;

grant insert (return_multiplier)
on public.solar_projects
to authenticated;

grant update (return_multiplier)
on public.solar_projects
to authenticated;

commit;
