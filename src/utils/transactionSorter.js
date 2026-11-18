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

/**
 * Returns { adults, children, total } for a deposit record.
 * Backwards-compatible with older records that only stored `peopleCount` (all counted as adults, 0 children).
 */
export function getDepositAttendance(tx = {}) {
  const hasExplicitAdults =
    tx.adultsCount !== undefined && tx.adultsCount !== null && tx.adultsCount !== '';
  const hasExplicitChildren =
    tx.childrenCount !== undefined && tx.childrenCount !== null && tx.childrenCount !== '';

  const children = hasExplicitChildren ? Math.max(0, parseInt(tx.childrenCount, 10) || 0) : 0;
  const adults = hasExplicitAdults
    ? Math.max(0, parseInt(tx.adultsCount, 10) || 0)
    : Math.max(0, (parseInt(tx.peopleCount, 10) || 1) - children);

  const total = adults + children || Math.max(1, parseInt(tx.peopleCount, 10) || 1);
  return { adults, children, total };
}

/**
 * Infers the breakdown of Adults ($35) and Children ($20) from the paid amount and optional total people count.
 * - If amount is an exact multiple of $35 (and matches totalPeople if provided), returns requiresChildrenReview = false.
 * - Otherwise (e.g. $90 for 2 adults + 1 child, $110 for 2 adults + 2 children, $130 for 2 adults + 3 children, etc.),
 *   returns requiresChildrenReview = true and pre-fills the best matching (adults, children) suggestion so the Admin can confirm or edit any number of children.
 */
export function inferAdultsAndChildren(amountVal, totalPeopleVal) {
  const amount = Number(amountVal) || 0;
  const totalPeople = Number(totalPeopleVal) || 0;

  if (amount <= 0) {
    return {
      adults: totalPeople > 0 ? totalPeople : 1,
      children: 0,
      matchedExact: false,
      requiresChildrenReview: false
    };
  }

  const isMultipleOf35 = Math.abs(amount % 35) < 0.01;
  const expectedAdultsAt35 = Math.round(amount / 35);

  // Pure adults case: e.g. $35 (1p), $70 (2p), $105 (3p), $140 (4p)
  if (isMultipleOf35 && (!totalPeople || totalPeople === expectedAdultsAt35)) {
    return {
      adults: expectedAdultsAt35,
      children: 0,
      matchedExact: true,
      requiresChildrenReview: false
    };
  }

  // Not an exact multiple of $35 (or people count differs from amount / 35) -> includes children ($20 each)
  const validCombinations = [];
  for (let a = 0; a <= 50; a += 1) {
    for (let c = 0; c <= 50; c += 1) {
      if (a === 0 && c === 0) continue;
      if (Math.abs(a * 35 + c * 20 - amount) < 0.01) {
        validCombinations.push({ adults: a, children: c, total: a + c });
      }
    }
  }

  // 1. If the message specified total people (e.g. "3 personas" with $90, or "4 personas" with $110), match exact total
  if (totalPeople > 0) {
    const exactPeopleMatch = validCombinations.find((comb) => comb.total === totalPeople);
    if (exactPeopleMatch) {
      return {
        adults: exactPeopleMatch.adults,
        children: exactPeopleMatch.children,
        matchedExact: true,
        requiresChildrenReview: true
      };
    }
  }

  // 2. Otherwise pick the combination with at least 1 adult (preferring more adults / fewer children)
  const withAdults = validCombinations
    .filter((comb) => comb.adults >= 1)
    .sort((x, y) => y.adults - x.adults);

  if (withAdults.length > 0) {
    return {
      adults: withAdults[0].adults,
      children: withAdults[0].children,
      matchedExact: true,
      requiresChildrenReview: true
    };
  }

  if (validCombinations.length > 0) {
    return {
      adults: validCombinations[0].adults,
      children: validCombinations[0].children,
      matchedExact: true,
      requiresChildrenReview: true
    };
  }

  // 3. Fallback when amount doesn't match a standard $35/$20 combination: let Admin enter manually
  return {
    adults: totalPeople > 0 ? totalPeople : 1,
    children: 0,
    matchedExact: false,
    requiresChildrenReview: true
  };
}

