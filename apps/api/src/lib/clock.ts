import { todayInIstanbul } from '@santiye/shared';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** İş günü: Europe/Istanbul'a göre bugün. */
export function businessToday(clock: Clock): string {
  return todayInIstanbul(clock.now());
}
