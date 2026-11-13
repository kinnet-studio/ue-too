import { createInputModeSwitcher } from '../input-mode';
import { applyTranslations, createLanguageSwitcher } from './index';

document.addEventListener('DOMContentLoaded', () => {
    const switcherTarget = document.getElementById('lang-switcher-container');
    if (switcherTarget) {
        createInputModeSwitcher(switcherTarget);
        createLanguageSwitcher(switcherTarget);
    }
    applyTranslations();
});
