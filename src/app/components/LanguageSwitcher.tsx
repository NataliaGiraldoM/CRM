import { Languages } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'en' ? 'es' : 'en';
  return (
    <button type="button" className="orbit-language-switch" onClick={() => setLanguage(nextLanguage)}
      aria-label={language === 'en' ? 'Cambiar a español' : 'Switch to English'} lang={nextLanguage}>
      <Languages size={18} aria-hidden="true" />
      <span>{language === 'en' ? 'Español' : 'English'}</span>
    </button>
  );
}
