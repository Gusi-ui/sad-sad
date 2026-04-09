const pad2 = (value: number) => String(value).padStart(2, '0');

export const toYmd = (date: Date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
};

export const getIsoWeekKey = (date: Date) => {
  // ISO week date algorithm
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${pad2(weekNo)}`;
};

export const mondayOfIsoWeek = (weekKey: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const isoWeekStart = new Date(simple);
  if (dow <= 4) isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  return isoWeekStart;
};

export const datesOfIsoWeek = (weekKey: string) => {
  const monday = mondayOfIsoWeek(weekKey);
  if (!monday) return null;
  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
};

