import { HttpError } from '../http-error.mjs';

const appTimeZone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';

export const categories = ['Casa','Comida','Transporte','Lazer','Outros'];

export const text = (value, max = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, 'Texto inválido.');
  }
  return value.trim();
};

export const cents = (value, allowZero = false) => {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < (allowZero ? 0 : 0.01)
    || value > 100000000
  ) {
    throw new HttpError(400, 'Valor inválido.');
  }
  return Math.round(value * 100);
};

export const dateOnly = (value, {optional = false} = {}) => {
  if ((value === null || value === undefined || value === '') && optional) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Data inválida.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new HttpError(400, 'Data inválida.');
  }
  return value;
};

export const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: appTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

export const monthOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Mês inválido.');
  }
  const [year, month] = value.split('-').map(Number);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) {
    throw new HttpError(400, 'Mês inválido.');
  }
  return value;
};

export const normalizeIncome = row => ({
  id: row.id,
  name: row.name,
  type: row.type,
  value: row.amount / 100,
  recurrence: row.recurrence ?? (row.type === 'salary' ? 'monthly' : 'once'),
  activeFrom: row.active_from ?? row.received_at?.slice(0, 10),
  activeUntil: row.active_until ?? null,
  active: Boolean(row.active ?? 1),
  receivedAt: row.received_at,
  updatedAt: row.updated_at ?? row.received_at,
});

export const normalizeBudget = row => ({
  id: row.id,
  month: row.month,
  category: row.category,
  limit: row.limit_amount / 100,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
