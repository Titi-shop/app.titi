export function toLocalInput(date?: string | null) {
  if (!date) return "";

  const d = new Date(date);
  const offset = d.getTimezoneOffset();

  const local = new Date(d.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
}

export function toUTCFromInput(value: string) {
  if (!value) return null;

  return new Date(value).toISOString();
}

export function formatDisplayTime(date?: string | null) {
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}
