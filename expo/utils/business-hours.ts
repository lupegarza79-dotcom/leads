import { WORKING_HOURS, type WorkingHoursConfig } from '@/constants/config';

export function getWorkingHoursForDay(
  day: number,
  config: WorkingHoursConfig = WORKING_HOURS,
): { open: string; close: string } | null {
  return config[day] ?? null;
}

export function isWithinBusinessHours(
  date: Date = new Date(),
  config: WorkingHoursConfig = WORKING_HOURS,
): boolean {
  const dayConfig = getWorkingHoursForDay(date.getDay(), config);
  if (!dayConfig) return false;

  const [openH, openM] = dayConfig.open.split(':').map(Number);
  const [closeH, closeM] = dayConfig.close.split(':').map(Number);

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function getNextBusinessOpen(
  from: Date = new Date(),
  config: WorkingHoursConfig = WORKING_HOURS,
): Date {
  const result = new Date(from);

  for (let i = 0; i < 8; i++) {
    const dayConfig = getWorkingHoursForDay(result.getDay(), config);
    if (dayConfig) {
      const [openH, openM] = dayConfig.open.split(':').map(Number);
      const openTime = new Date(result);
      openTime.setHours(openH, openM, 0, 0);

      if (i === 0 && result < openTime) {
        return openTime;
      }
      if (i > 0) {
        result.setHours(openH, openM, 0, 0);
        return result;
      }

      const [closeH, closeM] = dayConfig.close.split(':').map(Number);
      const currentMinutes = result.getHours() * 60 + result.getMinutes();
      const closeMinutes = closeH * 60 + closeM;

      if (currentMinutes < closeMinutes) {
        return result;
      }
    }
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
  }

  return result;
}

export function addBusinessMinutes(
  from: Date,
  minutes: number,
  config: WorkingHoursConfig = WORKING_HOURS,
): Date {
  let remaining = minutes;
  let current = getNextBusinessOpen(from, config);

  while (remaining > 0) {
    const dayConfig = getWorkingHoursForDay(current.getDay(), config);
    if (!dayConfig) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      current = getNextBusinessOpen(current, config);
      continue;
    }

    const [closeH, closeM] = dayConfig.close.split(':').map(Number);
    const closeMinutes = closeH * 60 + closeM;
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    const minutesLeftToday = closeMinutes - currentMinutes;

    if (remaining <= minutesLeftToday) {
      current.setMinutes(current.getMinutes() + remaining);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      current = getNextBusinessOpen(current, config);
    }
  }

  return current;
}

export function addBusinessDays(
  from: Date,
  days: number,
  config: WorkingHoursConfig = WORKING_HOURS,
): Date {
  let remaining = days;
  const result = new Date(from);

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayConfig = getWorkingHoursForDay(result.getDay(), config);
    if (dayConfig) {
      remaining--;
    }
  }

  const dayConfig = getWorkingHoursForDay(result.getDay(), config);
  if (dayConfig) {
    const [openH, openM] = dayConfig.open.split(':').map(Number);
    result.setHours(openH, openM, 0, 0);
  }

  return result;
}

export function getBusinessMinutesBetween(
  start: Date,
  end: Date,
  config: WorkingHoursConfig = WORKING_HOURS,
): number {
  if (end <= start) return 0;

  let totalMinutes = 0;
  let current = getNextBusinessOpen(new Date(start), config);

  while (current < end) {
    const dayConfig = getWorkingHoursForDay(current.getDay(), config);
    if (!dayConfig) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const [closeH, closeM] = dayConfig.close.split(':').map(Number);
    const closeTime = new Date(current);
    closeTime.setHours(closeH, closeM, 0, 0);

    const effectiveEnd = end < closeTime ? end : closeTime;
    const minutesThisPeriod = Math.max(0, (effectiveEnd.getTime() - current.getTime()) / 60000);
    totalMinutes += minutesThisPeriod;

    current = new Date(closeTime);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
    current = getNextBusinessOpen(current, config);
  }

  return Math.round(totalMinutes);
}
