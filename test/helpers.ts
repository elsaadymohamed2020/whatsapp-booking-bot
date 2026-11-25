import type { BusinessHours } from '../src/config';

export const HOURS: BusinessHours = {
  timezone: 'Africa/Cairo',
  days: [1, 2, 3, 4, 5],
  open: '09:00',
  close: '17:00',
  minLeadMinutes: 60,
  horizonDays: 14,
};
