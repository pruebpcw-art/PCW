/* =====================================================================
   PCW — JS/theme.js
   Modo claro / oscuro (clase ThemeManager).

   - Se carga en el <head> SIN defer: aplica el tema antes de que la
     página se dibuje, así no hay un "destello" blanco al recargar.
   - Tema inicial: el que el visitante eligió antes (localStorage);
     si nunca eligió, el del sistema operativo.
   - Crea el botón luna / sol dentro del menú.
   - Los colores del modo oscuro están en CSS/style.css (sección 18).
   ===================================================================== */

(() => {
  'use strict';

  class ThemeManager {
    static STORAGE_KEY = 'pcw-theme';
    static BAR_COLORS = { light: '#031B3D', dark: '#0B1220' };   // barra del navegador en celulares
    static ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    static ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

    constructor() {
      this.systemDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.button = null;
    }

    /** Tema actual: 'light' o 'dark' */
    get current() {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    init() {
      this.apply(this.getInitialTheme());   // inmediato, antes de dibujar

      // Si el visitante no eligió un tema, sigue los cambios del sistema
      this.systemDark.addEventListener('change', (e) => {
        if (!this.getSaved()) this.apply(e.matches ? 'dark' : 'light');
      });

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.createButton());
      } else {
        this.createButton();
      }
    }

    getSaved() {
      try { return localStorage.getItem(ThemeManager.STORAGE_KEY); } catch { return null; }
    }

    save(theme) {
      try { localStorage.setItem(ThemeManager.STORAGE_KEY, theme); } catch { /* sin almacenamiento */ }
    }

    getInitialTheme() {
      const saved = this.getSaved();
      if (saved === 'dark' || saved === 'light') return saved;
      return this.systemDark.matches ? 'dark' : 'light';
    }

    apply(theme) {
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', ThemeManager.BAR_COLORS[theme]);
      this.updateButton();
    }

    toggle() {
      const next = this.current === 'dark' ? 'light' : 'dark';
      this.save(next);
      this.apply(next);
    }

    createButton() {
      if (document.getElementById('themeToggle')) return;
      this.button = document.createElement('button');
      this.button.type = 'button';
      this.button.id = 'themeToggle';
      this.button.className = 'theme-toggle';
      this.button.addEventListener('click', () => this.toggle());

      const container = document.querySelector('.nav') || document.querySelector('.header__inner');
      container?.appendChild(this.button);
      this.updateButton();
    }

    updateButton() {
      if (!this.button) return;
      const isDark = this.current === 'dark';
      this.button.innerHTML = isDark ? ThemeManager.ICON_SUN : ThemeManager.ICON_MOON;   // muestra el modo al que se cambia
      this.button.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
      this.button.setAttribute('aria-pressed', String(isDark));
    }
  }

  window.PCW = window.PCW || {};
  window.PCW.theme = new ThemeManager();
  window.PCW.theme.init();
})();