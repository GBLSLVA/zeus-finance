export const shiftMonthKey = (monthKey, offset) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const monthBounds = monthKey => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start:`${monthKey}-01`,
    end:`${monthKey}-${String(lastDay).padStart(2,'0')}`,
  };
};

export const effectiveIncomeEnd = entry =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0,10) || entry.activeFrom : null);

export const effectiveRecurringEnd = entry =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0,10) || entry.activeFrom : null);

export const moneyText = value =>
  Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});

export const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const normalizeInsightName = value =>
  String(value ?? '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');

export const normalizeQuestion = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g,' ')
    .trim();
