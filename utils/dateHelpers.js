export function isWithinDays(date, days) {
  const now = new Date();
  const diff = now - new Date(date);
  return diff < days * 24 * 60 * 60 * 1000;
}

export function isSameDay(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function isThisWeek(date) {
  const now = new Date();
  const entryDate = new Date(date);
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  return entryDate >= startOfWeek;
}

export function isThisMonth(date) {
  const now = new Date();
  const entryDate = new Date(date);
  return (
    entryDate.getMonth() === now.getMonth() &&
    entryDate.getFullYear() === now.getFullYear()
  );
}
