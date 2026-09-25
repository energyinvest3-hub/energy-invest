export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export const projectStatus: Record<string, string> = {
  available: "Disponível",
  active: "Ativo",
  finished: "Finalizado",
  sold_out: "Esgotado",
  paused: "Pausado",
};
