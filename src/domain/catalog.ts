import type { Service } from './types';

/** Demo catalog. In production this would live in the database and be editable by the owner. */
export const SERVICES: readonly Service[] = [
  { id: 'consultation', name: 'Consultation', durationMinutes: 30, price: 'EGP 300' },
  { id: 'haircut', name: 'Haircut', durationMinutes: 45, price: 'EGP 200' },
  { id: 'full-session', name: 'Full session', durationMinutes: 60, price: 'EGP 450' },
];

export function findService(id: string | undefined, services: readonly Service[] = SERVICES) {
  return services.find((s) => s.id === id);
}
