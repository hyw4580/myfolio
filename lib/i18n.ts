import { cookies } from 'next/headers';
import ko from '@/messages/ko';
import en from '@/messages/en';
import ru from '@/messages/ru';

export type Locale = 'ko' | 'en' | 'ru';

const messages = { ko, en, ru };

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const val = c.get('locale')?.value;
  return (val === 'ko' || val === 'en' || val === 'ru') ? val : 'en';
}

export function getT(locale: Locale) {
  return messages[locale];
}
