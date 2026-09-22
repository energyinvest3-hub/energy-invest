import type { SolarProject } from "./types";
import { getProjectImage } from "./project-images";

const seeds = [
  ["solar-start-campinas", "Solar Start Campinas", "Campinas", "SP", 50, 4.0, 10, 220, "available", true],
  ["solar-vale", "Solar Vale", "São José dos Campos", "SP", 89, 4.0, 10, 200, "available", true],
  ["solar-rio-residencial", "Solar Rio Residencial", "Rio de Janeiro", "RJ", 180, 4.0, 10, 180, "available", true],
  ["solar-minas-flex", "Solar Minas Flex", "Uberlândia", "MG", 230, 4.0, 10, 160, "available", false],
  ["solar-nordeste", "Solar Nordeste", "Fortaleza", "CE", 320, 4.0, 10, 150, "available", false],
  ["solar-bahia-prime", "Solar Bahia Prime", "Juazeiro", "BA", 490, 2.0, 10, 130, "available", true],
  ["solar-parana-pro", "Solar Paraná Pro", "Cascavel", "PR", 690, 2.0, 10, 110, "available", false],
  ["solar-goias-max", "Solar Goiás Max", "Goiânia", "GO", 890, 2.0, 10, 90, "available", true],
  ["solar-pernambuco-plus", "Solar Pernambuco Plus", "Recife", "PE", 1290, 2.0, 10, 75, "available", false],
  ["solar-paulista-industrial", "Solar Paulista Industrial", "Ribeirão Preto", "SP", 1790, 2.5, 10, 60, "available", true],
  ["solar-sul-premium", "Solar Sul Premium", "Santa Maria", "RS", 2390, 2.5, 10, 45, "available", false],
  ["solar-brasil-ultra", "Solar Brasil Ultra", "Belo Horizonte", "MG", 2990, 2.5, 10, 35, "available", true],
  ["texas-solar-international", "Texas Solar International", "Texas", "EUA", 3490, 3.0, 10, 40, "available", true],
  ["lisboa-solar-international", "Lisboa Solar International", "Lisboa", "Europa", 4290, 3.0, 10, 36, "available", true],
  ["nevada-solar-utility", "Nevada Solar Utility", "Nevada", "EUA", 5790, 3.0, 10, 32, "available", true],
  ["andaluzia-solar-prime", "Andaluzia Solar Prime", "Sevilha", "Europa", 7490, 3.3, 10, 28, "available", true],
  ["ningxia-solar-grid", "Ningxia Solar Grid", "Ningxia", "China", 8990, 3.5, 10, 24, "available", true],
  ["california-solar-grid", "California Solar Grid", "Califórnia", "EUA", 10900, 3.5, 10, 20, "available", true],
  ["madrid-solar-prime", "Madrid Solar Prime", "Madri", "Europa", 13900, 4.0, 10, 18, "available", true],
  ["arizona-solar-industrial", "Arizona Solar Industrial", "Arizona", "EUA", 16900, 4.0, 10, 16, "available", true],
  ["shanghai-solar-industrial", "Shanghai Solar Industrial", "Xangai", "China", 21900, 3.0, 10, 14, "available", true],
  ["portugal-solar-institutional", "Portugal Solar Institutional", "Porto", "Europa", 29900, 4.0, 10, 12, "available", true],
  ["texas-solar-ultra", "Texas Solar Ultra", "Austin", "EUA", 39900, 4.0, 10, 10, "available", true],
  ["china-solar-mega", "China Solar Mega", "Gansu", "China", 49900, 4.0, 10, 8, "available", true],
] as const;

export const demoProjects: SolarProject[] = seeds.map((s, i) => {
  const projected = s[4] * s[5];
  const international = ["Europa", "EUA", "China"].includes(s[3]);
  return {
    id: s[0],
    name: s[1],
    city: s[2],
    state: s[3],
    investmentAmount: s[4],
    returnMultiplier: s[5],
    international,
    dailyProjectedReturn: projected / s[6],
    durationDays: s[6],
    projectedTotalReturn: projected,
    availableUnits: s[7],
    status: s[8],
    isNew: s[9],
    maxUnitsPerUser: international ? 5 : 8,
    image: getProjectImage(s[1], i),
    description: international
      ? "Projeto solar internacional com programação de créditos exibida diretamente na plataforma durante o período contratado."
      : "Projeto solar nacional com período, valores e programação de créditos acompanhados diretamente pela plataforma.",
    startDate: "2026-09-22T12:00:00Z",
    endDate: new Date(Date.UTC(2026, 8, 22 + s[6], 12)).toISOString(),
  };
});
