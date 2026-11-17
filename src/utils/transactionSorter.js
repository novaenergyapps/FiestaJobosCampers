/**
 * Extracts a numeric key and normalized label from a camperNumber string
 * Examples:
 *   "Camper 30" -> { num: 30, suffix: "", display: "Camper 30" }
 *   "5"         -> { num: 5,  suffix: "", display: "Camper 5" }
 *   "#12A"      -> { num: 12, suffix: "a", display: "Camper 12A" }
 */
export function parseCamperKey(camperStr = '') {
  const raw = String(camperStr || '').trim();
  if (!raw) {
    return {
      num: Number.MAX_SAFE_INTEGER,
      suffix: '',
      rawLower: '',
      display: 'S/N'
    };
  }

  const match = raw.match(/(\d+)\s*([A-Za-z]*)/);
  if (match) {
    const num = parseInt(match[1], 10);
    const suffix = (match[2] || '').toLowerCase();
    const cleanNumPart = `${num}${match[2] ? match[2].toUpperCase() : ''}`;
    const display = /camper|lote/i.test(raw) ? raw : `Camper ${cleanNumPart}`;
    return {
      num,
      suffix,
      rawLower: raw.toLowerCase(),
      display
    };
  }

  return {
    num: Number.MAX_SAFE_INTEGER - 1,
    suffix: raw.toLowerCase(),
    rawLower: raw.toLowerCase(),
    display: raw
  };
}

/**
 * Parses a transaction date string (e.g. "2026-11-16" or "11/16/2026") into a comparable timestamp (ms)
 */
export function parseDateMs(dateStr = '', fallbackMs = 0) {
  const s = String(dateStr || '').trim();
  if (!s) return fallbackMs || 0;

  // Standard ISO local date: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // US date: MM/DD/YYYY
  const usMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10) - 1;
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return fallbackMs || 0;
}

/**
 * Formats a YYYY-MM-DD date string into DD/MM/YYYY or readable short date for reports
 */
export function formatShortDate(dateStr = '') {
  const s = String(dateStr || '').trim();
  if (!s) return '—';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mIdx = parseInt(m, 10) - 1;
    return `${d}/${months[mIdx] || m}/${y}`;
  }
  return s;
}

/**
 * Formats current date in Spanish for the report header
 */
export function getFormattedTodaySpanish() {
  const now = new Date();
  return new Intl.DateTimeFormat('es-PR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(now);
}

/**
 * Sorts deposit transactions by Camper Number in ascending order
 */
export function sortDepositsByCamperAsc(deposits = []) {
  return [...deposits].sort((a, b) => {
    const keyA = parseCamperKey(a.camperNumber);
    const keyB = parseCamperKey(b.camperNumber);

    if (keyA.num !== keyB.num) {
      return keyA.num - keyB.num;
    }
    if (keyA.suffix !== keyB.suffix) {
      return keyA.suffix.localeCompare(keyB.suffix, 'es', { numeric: true });
    }
    const dateA = parseDateMs(a.date, a.createdAtMs);
    const dateB = parseDateMs(b.date, b.createdAtMs);
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

/**
 * Sorts expense transactions by Date in ascending chronological order (or descending if specified)
 */
export function sortExpensesByDate(expenses = [], direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...expenses].sort((a, b) => {
    const dateA = parseDateMs(a.date, a.createdAtMs);
    const dateB = parseDateMs(b.date, b.createdAtMs);
    if (dateA !== dateB) {
      return (dateA - dateB) * factor;
    }
    const createdA = Number(a.createdAtMs) || 0;
    const createdB = Number(b.createdAtMs) || 0;
    if (createdA !== createdB) {
      return (createdA - createdB) * factor;
    }
    return String(a.paidTo || '').localeCompare(String(b.paidTo || ''), 'es');
  });
}
