const timeZone = "America/Sao_Paulo";

export const withdrawalWindowLabel =
  "de segunda a sexta, das 09:00 às 18:00";

export function isWithdrawalWindow(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const weekday =
    parts.find((part) => part.type === "weekday")?.value ?? "";

  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? "0",
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  const totalMinutes = hour * 60 + minute;

  return totalMinutes >= 9 * 60 && totalMinutes < 18 * 60;
}
