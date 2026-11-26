import type { Service } from './types';

/** Demo catalog (an Egyptian salon). In production this would live in the database and be editable by the owner. */
export const SERVICES: readonly Service[] = [
  { id: 'consultation', name: 'Consultation', nameAr: 'استشارة', durationMinutes: 30, price: 'EGP 300', priceAr: '300 جنيه' },
  { id: 'haircut', name: 'Haircut', nameAr: 'قص شعر', durationMinutes: 45, price: 'EGP 200', priceAr: '200 جنيه' },
  { id: 'blowdry', name: 'Blow-dry', nameAr: 'سيشوار', durationMinutes: 45, price: 'EGP 150', priceAr: '150 جنيه' },
  { id: 'color', name: 'Hair color', nameAr: 'صبغة', durationMinutes: 90, price: 'EGP 600', priceAr: '600 جنيه' },
  { id: 'keratin', name: 'Keratin treatment', nameAr: 'كيراتين', durationMinutes: 120, price: 'EGP 1200', priceAr: '1200 جنيه' },
  { id: 'manicure', name: 'Manicure', nameAr: 'مانيكير', durationMinutes: 60, price: 'EGP 250', priceAr: '250 جنيه' },
];

export function findService(id: string | undefined, services: readonly Service[] = SERVICES) {
  return services.find((s) => s.id === id);
}
