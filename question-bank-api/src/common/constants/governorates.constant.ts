export const YEMEN_GOVERNORATES = [
  'أمانة العاصمة',
  'صنعاء',
  'عدن',
  'تعز',
  'إب',
  'الحديدة',
  'حضرموت',
  'ذمار',
  'عمران',
  'حجة',
  'صعدة',
  'المحويت',
  'ريمة',
  'المهرة',
  'مأرب',
  'الجوف',
  'شبوة',
  'أبين',
  'لحج',
  'الضالع',
  'البيضاء',
  'أرخبيل سقطرى',
] as const;

export type YemenGovernorate = (typeof YEMEN_GOVERNORATES)[number];

export function isValidYemenGovernorate(value: string | null | undefined): boolean {
  if (!value) return false;
  return YEMEN_GOVERNORATES.includes(value.trim() as YemenGovernorate);
}