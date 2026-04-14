/* =========================================================
   GET USER TIMEZONE
========================================================= */
export function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/* =========================================================
   FORMAT LOCAL TIME
========================================================= */
export function formatLocalTime(date: string | Date) {
  const timeZone = getUserTimeZone();

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/* =========================================================
   FORMAT FOR INPUT datetime-local
========================================================= */
export function toLocalInput(date: string | Date | null | undefined) {
  if (!date) return "";

  const d = new Date(date);

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
