-- EnergyInvest — documento do titular da chave PIX no CashOut.
-- Necessário para validar telefone/e-mail/chave aleatória na PushinPay.
begin;

alter table public.withdrawals
  add column if not exists receiver_national_registration text;

alter table public.manual_pix_payouts
  add column if not exists receiver_national_registration text;

-- Para chave CPF/CNPJ já conseguimos recuperar o documento pela própria chave.
update public.withdrawals
set receiver_national_registration =
  regexp_replace(pix_key, '[^0-9]', '', 'g')
where receiver_national_registration is null
  and lower(trim(coalesce(pix_key_type, ''))) in (
    'cpf',
    'cnpj',
    'national_registration'
  )
  and length(regexp_replace(pix_key, '[^0-9]', '', 'g')) in (11,14);

commit;

select
  pix_key_type,
  count(*) filter (
    where receiver_national_registration is null
  ) as sem_documento_titular,
  count(*) as total_pendentes
from public.withdrawals
where status = 'pending'
group by pix_key_type
order by pix_key_type;
