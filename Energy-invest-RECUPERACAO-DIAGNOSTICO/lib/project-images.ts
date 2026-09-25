const projectImageMap: Record<string, string> = {
  "Solar Start Campinas": "/solar-1.jpg",
  "Solar Vale": "/solar-2.jpg",
  "Solar Rio Residencial": "/solar-3.jpg",
  "Solar Minas Flex": "/solar-4.png",
  "Solar Nordeste": "/solar-5.png",
  "Solar Bahia Prime": "/solar-9.png",
  "Solar Paraná Pro": "/solar-8.png",
  "Solar Goiás Max": "/solar-4.png",
  "Solar Pernambuco Plus": "/solar-6.png",
  "Solar Paulista Industrial": "/solar-6.png",
  "Solar Sul Premium": "/solar-11.png",
  "Solar Brasil Ultra": "/solar-10.png",
  "Texas Solar International": "/solar-7.png",
  "Lisboa Solar International": "/solar-8.png",
  "Nevada Solar Utility": "/solar-5.png",
  "Andaluzia Solar Prime": "/solar-9.png",
  "Ningxia Solar Grid": "/solar-10.png",
  "California Solar Grid": "/solar-12.png",
  "Madrid Solar Prime": "/solar-11.png",
  "Arizona Solar Industrial": "/solar-7.png",
  "Shanghai Solar Industrial": "/solar-6.png",
  "Portugal Solar Institutional": "/solar-8.png",
  "Texas Solar Ultra": "/solar-7.png",
  "China Solar Mega": "/solar-10.png",
};

const fallbackImages = [
  "/solar-1.jpg", "/solar-2.jpg", "/solar-3.jpg", "/solar-4.png",
  "/solar-5.png", "/solar-6.png", "/solar-7.png", "/solar-8.png",
  "/solar-9.png", "/solar-10.png", "/solar-11.png", "/solar-12.png",
];

export function getProjectImage(name: string, index = 0) {
  return projectImageMap[name] ?? fallbackImages[index % fallbackImages.length];
}
