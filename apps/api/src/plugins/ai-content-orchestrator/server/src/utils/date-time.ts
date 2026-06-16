const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-CA'
): Intl.DateTimeFormat => {
  const key = `${locale}:${timeZone}:${JSON.stringify(options)}`;
  const cached = dateFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  dateFormatterCache.set(key, formatter);
  return formatter;
};

export const formatDateInZone = (date: Date, timeZone: string): string => {
  const formatter = getFormatter(
    timeZone,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
    'en-CA'
  );

  return formatter.format(date);
};

export const formatTimeInZone = (date: Date, timeZone: string): string => {
  const formatter = getFormatter(timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(date);
};

export const formatDateTimeLabel = (date: Date, timeZone: string): string => {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date);
};

export const getLocalDateParts = (
  date: Date,
  timeZone: string
): { year: number; month: number; day: number } => {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return Number(part?.value ?? 0);
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
};

export const getLocalWeekday = (date: Date, timeZone: string): number => {
  const formatter = getFormatter(
    timeZone,
    {
      weekday: 'short',
    },
    'en-US'
  );

  const day = formatter.format(date);

  switch (day) {
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    case 'Sun':
      return 7;
    default:
      return 1;
  }
};

export const addDaysToDateString = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split('-').map((value) => Number(value));
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
};

export const diffDays = (startDate: string, endDate: string): number => {
  const parse = (value: string): number => {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return Date.UTC(year, month - 1, day, 12, 0, 0);
  };

  const diff = parse(endDate) - parse(startDate);

  return Math.floor(diff / 86_400_000);
};

export const getIsoWeekStartDateString = (date: Date, timeZone: string): string => {
  const localDate = formatDateInZone(date, timeZone);
  const weekday = getLocalWeekday(date, timeZone);

  return addDaysToDateString(localDate, -(weekday - 1));
};

export const getMonthStartDateString = (date: Date, timeZone: string): string => {
  const { year, month } = getLocalDateParts(date, timeZone);

  return `${year}-${String(month).padStart(2, '0')}-01`;
};

export const toMinuteSlot = (date: Date): string => {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000).toISOString();
};

export const isWithinMs = (from: Date, to: Date, windowMs: number): boolean => {
  const delta = to.getTime() - from.getTime();
  return delta >= 0 && delta <= windowMs;
};

export const clampNumber = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

// Offset (local - UTC) in milliseconds for a given instant in a time zone.
const getZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = getFormatter(
    timeZone,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    },
    'en-US'
  );

  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  // Some runtimes emit '24' for midnight when hour12 is false.
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - date.getTime();
};

// UTC instant (ISO string) corresponding to local midnight of `date` in `timeZone`.
// Aligns daily budget/usage windows with the workflow business day instead of UTC.
export const startOfDayInZoneIso = (date: Date, timeZone: string): string => {
  const { year, month, day } = getLocalDateParts(date, timeZone);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = getZoneOffsetMs(new Date(localMidnightAsUtc), timeZone);

  return new Date(localMidnightAsUtc - offset).toISOString();
};
