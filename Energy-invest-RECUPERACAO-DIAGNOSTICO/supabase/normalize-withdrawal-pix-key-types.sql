-- EnergyInvest — normaliza tipos de chave PIX de saques antigos.
begin;

update public.withdrawals
set pix_key_type =
  case
    when lower(trim(coalesce(pix_key_type, ''))) in (
      'cpf',
      'cnpj',
      'national_registration',
      'document',
      'taxid'
    ) then 'cpf'

    when lower(trim(coalesce(pix_key_type, ''))) = 'email'
      then 'email'

    when lower(trim(coalesce(pix_key_type, ''))) in (
      'phone',
      'telefone',
      'celular'
    ) then 'phone'

    when lower(trim(coalesce(pix_key_type, ''))) in (
      'random',
      'evp',
      'aleatoria',
      'aleatória'
    ) then 'random'

    else pix_key_type
  end
where status = 'pending';

commit;

select
  pix_key_type,
  count(*) as quantidade
from public.withdrawals
where status = 'pending'
group by pix_key_type
order by pix_key_type;
