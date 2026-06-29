'use client';
import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import ko from '@/messages/ko';
import en from '@/messages/en';
import ru from '@/messages/ru';

const messages = { ko, en, ru };

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useT() {
  const locale = useContext(LocaleContext);
  return messages[locale];
}
