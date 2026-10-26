import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import spanish from './es.json';

type Language = 'en' | 'es';
type LanguageValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageValue | null>(null);
const translations: Record<string, string> = spanish;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('orbit-language') === 'es' ? 'es' : 'en'; }
    catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('orbit-language', language); } catch { /* Storage may be disabled. */ }
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => language === 'es' ? translations[text] ?? text : text }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage requires LanguageProvider');
  return value;
}
