import en from './en';
import zhTW from './zh-TW';
import DOMPurify from 'dompurify';

type Translations = typeof en;
type TranslationKey = keyof Translations;

const STORAGE_KEY = 'ue-too-examples-lang';

const locales: Record<string, Translations> = {
    en,
    'zh-TW': zhTW,
};

function getInitialLanguage(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in locales) return stored;
    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) return 'zh-TW';
    return 'en';
}

let currentLang = getInitialLanguage();

/**
 * Get the translated string for a key.
 */
export function t(key: TranslationKey): string {
    return locales[currentLang]?.[key] ?? locales['en'][key] ?? key;
}

/**
 * Get the current language code.
 */
export function getCurrentLanguage(): string {
    return currentLang;
}

/**
 * Set the language and persist to localStorage.
 */
export function setLanguage(lang: string): void {
    if (!(lang in locales)) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
}

/**
 * Get all available language codes.
 */
export function getAvailableLanguages(): string[] {
    return Object.keys(locales);
}

/**
 * Apply translations to all elements with data-i18n attributes.
 * - `data-i18n` sets textContent
 * - `data-i18n-title` sets the document title
 * - `data-i18n-placeholder` sets placeholder attribute
 * - `data-i18n-aria-label` sets the aria-label attribute
 * - `data-i18n-html` sets innerHTML (use sparingly)
 */
export function applyTranslations(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n') as TranslationKey;
        if (key) el.textContent = t(key);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html') as TranslationKey;
        if (key) el.innerHTML = DOMPurify.sanitize(t(key));
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title') as TranslationKey;
        if (key) document.title = t(key);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder') as TranslationKey;
        if (key) (el as HTMLInputElement).placeholder = t(key);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label') as TranslationKey;
        if (key) el.setAttribute('aria-label', t(key));
    });
}

/**
 * Create a language switcher button that toggles between available languages.
 * Appends itself to the target element.
 */
export function createLanguageSwitcher(target: HTMLElement): HTMLSelectElement {
    const select = document.createElement('select');
    select.id = 'lang-switcher';
    select.style.cssText =
        'padding: 4px 8px; border: 1px solid var(--c-border); border-radius: 4px; font-size: 13px; cursor: pointer; background: var(--c-bg); color: var(--c-text-1);';

    const labels: Record<string, string> = {
        en: 'English',
        'zh-TW': '繁體中文',
    };

    for (const lang of getAvailableLanguages()) {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = labels[lang] ?? lang;
        if (lang === currentLang) option.selected = true;
        select.appendChild(option);
    }

    select.addEventListener('change', () => {
        setLanguage(select.value);
        applyTranslations();
    });

    target.appendChild(select);
    return select;
}
