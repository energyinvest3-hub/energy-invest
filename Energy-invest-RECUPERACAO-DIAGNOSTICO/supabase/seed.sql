-- Catalog aligned with the production Supabase project.
-- Multipliers are projections configured for display and are not guarantees.
insert into public.solar_projects
(name,description,image_url,state,city,investment_amount,daily_projected_return,duration_days,available_units,max_units_per_user,status,start_date,end_date,return_multiplier)
select
  name, description, image_url, state, city, investment_amount,
  round((investment_amount * return_multiplier) / duration_days, 2),
  duration_days, available_units, max_units_per_user, status,
  now(), now() + make_interval(days => duration_days), return_multiplier
from (values
('Solar Start Campinas','Projeto solar nacional de entrada. A projeção exibida depende do desempenho e das distribuições efetivamente registradas.','/solar-1.jpg','SP','Campinas',50::numeric,1.50::numeric,5,220,8,'available'),
('Solar Vale','Projeto solar nacional de curto prazo. A projeção exibida depende do desempenho e das distribuições efetivamente registradas.','/solar-2.jpg','SP','São José dos Campos',89,1.60,7,200,8,'available'),
('Solar Rio Residencial','Projeto solar residencial no Rio de Janeiro. Projeções não constituem garantia de rendimento.','/solar-3.jpg','RJ','Rio de Janeiro',180,1.70,7,180,8,'available'),
('Solar Minas Flex','Projeto solar nacional de médio porte. Projeções não constituem garantia de rendimento.','/solar-4.png','MG','Uberlândia',230,1.80,10,160,8,'available'),
('Solar Nordeste','Projeto solar no Nordeste brasileiro. Projeções não constituem garantia de rendimento.','/solar-5.png','CE','Fortaleza',320,1.90,10,150,8,'available'),
('Solar Bahia Prime','Projeto solar nacional em região de alta incidência solar. Projeções não constituem garantia de rendimento.','/solar-9.png','BA','Juazeiro',490,2.00,12,130,8,'available'),
('Solar Paraná Pro','Projeto solar nacional de porte intermediário. Projeções não constituem garantia de rendimento.','/solar-8.png','PR','Cascavel',690,2.10,15,110,8,'available'),
('Solar Goiás Max','Projeto solar nacional premium. Projeções não constituem garantia de rendimento.','/solar-4.png','GO','Goiânia',890,2.20,15,90,8,'available'),
('Solar Pernambuco Plus','Projeto solar nacional premium. Projeções não constituem garantia de rendimento.','/solar-6.png','PE','Recife',1290,2.30,20,75,8,'available'),
('Solar Paulista Industrial','Projeto solar nacional industrial. Projeções não constituem garantia de rendimento.','/solar-6.png','SP','Ribeirão Preto',1790,2.40,25,60,8,'available'),
('Solar Sul Premium','Projeto solar nacional de maior porte. Projeções não constituem garantia de rendimento.','/solar-11.png','RS','Santa Maria',2390,2.50,30,45,8,'available'),
('Solar Brasil Ultra','Projeto solar nacional de alto ticket. Projeções não constituem garantia de rendimento.','/solar-10.png','MG','Belo Horizonte',2990,2.50,35,35,8,'available'),
('Texas Solar International','Projeto internacional. A projeção máxima do período é configurada no plano e não constitui garantia.','/solar-7.png','EUA','Texas',3490,3.00,30,40,5,'available'),
('Lisboa Solar International','Projeto internacional. A projeção máxima do período é configurada no plano e não constitui garantia.','/solar-8.png','Europa','Lisboa',4290,3.10,35,36,5,'available'),
('Nevada Solar Utility','Projeto internacional de maior porte. A projeção máxima do período não constitui garantia.','/solar-5.png','EUA','Nevada',5790,3.20,40,32,5,'available'),
('Andaluzia Solar Prime','Projeto internacional de maior porte. A projeção máxima do período não constitui garantia.','/solar-9.png','Europa','Sevilha',7490,3.30,45,28,5,'available'),
('Ningxia Solar Grid','Projeto internacional de maior porte. A projeção máxima do período não constitui garantia.','/solar-10.png','China','Ningxia',8990,3.40,50,24,5,'available'),
('California Solar Grid','Projeto internacional premium. A projeção máxima do período não constitui garantia.','/solar-12.png','EUA','Califórnia',10900,3.50,60,20,5,'available'),
('Madrid Solar Prime','Projeto internacional premium. A projeção máxima do período não constitui garantia.','/solar-11.png','Europa','Madri',13900,3.60,70,18,5,'available'),
('Arizona Solar Industrial','Projeto internacional industrial. A projeção máxima do período não constitui garantia.','/solar-7.png','EUA','Arizona',16900,3.70,75,16,5,'available'),
('Shanghai Solar Industrial','Projeto internacional industrial. A projeção máxima do período não constitui garantia.','/solar-6.png','China','Xangai',21900,3.80,90,14,5,'available'),
('Portugal Solar Institutional','Projeto internacional institucional. A projeção máxima do período não constitui garantia.','/solar-8.png','Europa','Porto',29900,3.90,100,12,5,'available'),
('Texas Solar Ultra','Projeto internacional de alto ticket. A projeção máxima do período não constitui garantia.','/solar-7.png','EUA','Austin',39900,4.00,120,10,5,'available'),
('China Solar Mega','Projeto internacional de alto ticket. A projeção máxima do período não constitui garantia.','/solar-10.png','China','Gansu',49900,4.00,150,8,5,'available')
) as catalog(name,description,image_url,state,city,investment_amount,return_multiplier,duration_days,available_units,max_units_per_user,status);


-- normalize all project terms to 10 days
update public.solar_projects
set duration_days=10,
    daily_projected_return=round((investment_amount*return_multiplier)/10,2),
    end_date=start_date+interval '10 days';

-- live multiplier normalization
update public.solar_projects set return_multiplier = case name
  when 'Solar Start Campinas' then 4.0
  when 'Solar Vale' then 4.0
  when 'Solar Rio Residencial' then 4.0
  when 'Solar Minas Flex' then 4.0
  when 'Solar Nordeste' then 4.0
  when 'Solar Bahia Prime' then 2.0
  when 'Solar Paraná Pro' then 2.0
  when 'Solar Goiás Max' then 2.0
  when 'Solar Pernambuco Plus' then 2.0
  when 'Solar Paulista Industrial' then 2.5
  when 'Solar Sul Premium' then 2.5
  when 'Solar Brasil Ultra' then 2.5
  when 'Texas Solar International' then 3.0
  when 'Lisboa Solar International' then 3.0
  when 'Nevada Solar Utility' then 3.0
  when 'Andaluzia Solar Prime' then 3.3
  when 'Ningxia Solar Grid' then 3.5
  when 'California Solar Grid' then 3.5
  when 'Madrid Solar Prime' then 4.0
  when 'Arizona Solar Industrial' then 4.0
  when 'Shanghai Solar Industrial' then 3.0
  when 'Portugal Solar Institutional' then 4.0
  when 'Texas Solar Ultra' then 4.0
  when 'China Solar Mega' then 4.0
  else return_multiplier end;

update public.solar_projects
set duration_days=10,
    daily_projected_return=round((investment_amount*return_multiplier)/10,2),
    end_date=start_date+interval '10 days';
