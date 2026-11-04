/* =====================================================================
   PCW — JS/proyectos.js
   Lógica de proyectos.html (independiente de index.html).

   Clases:
     LocalProjectsSource → datos de JS/proyectos-data.js (ejemplo)
     ApiProjectsSource   → datos del servidor Node.js (futuro: OneDrive)
     ProjectModal        → ventana de detalles con galería de fotos
     ProjectsGallery     → tarjetas, filtros y búsqueda
     PageHeader          → menú hamburguesa, sombra del header, año,
                           botón "volver arriba"

   - No usa JS/script.js: su menú activo busca secciones con "#" de la
     página principal y aquí los enlaces son "index.html#...".
   - Ningún secreto ni token en el navegador: el modo 'api' solo
     consulta a tu servidor.
   ===================================================================== */

(() => {
  'use strict';

  /* --------------------------- CONFIGURACIÓN --------------------------- */
  const CONFIG = {
    // 'local' = JS/proyectos-data.js · 'api' = servidor Node.js (cuando exista la ruta)
    SOURCE: 'local',
    API_URL: '/api/proyectos',
    REQUEST_TIMEOUT_MS: 15000,
    SEARCH_DELAY_MS: 150,
  };

  const CATEGORIES = {
    cctv: {
      label: 'CCTV',
      icon: '<path d="M3 7l12-3 2 6-12 3z"/><path d="M17 10l3-1M6 13v4H3M6 17h4"/>',
    },
    redes: {
      label: 'Instalaciones de redes',
      icon: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3h14v3"/>',
    },
    soporte: {
      label: 'Soporte técnico',
      icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    },
    infraestructura: {
      label: 'Infraestructura',
      icon: '<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="18" height="6" rx="1"/><path d="M7 6h.01M7 18h.01"/>',
    },
  };

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /** Imagen de respaldo si una foto no existe */
  const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><rect width="400" height="250" fill="#0D1B35"/>' +
    '<g fill="none" stroke="#38BDF8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".45">' +
    '<rect x="150" y="80" width="100" height="75" rx="8"/><circle cx="178" cy="105" r="8"/><path d="M158 147l28-24 20 16 16-12 20 20"/></g></svg>'
  );

  const normalize = (text) =>
    String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const iconSvg = (category) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${CATEGORIES[category]?.icon || ''}</svg>`;

  /** "2026-09-12" → "12 sep 2026" */
  const formatDate = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  const attachFallback = (img) =>
    img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });


  /* =====================================================================
     Fuentes de datos (misma forma de respuesta: arreglo de proyectos)
     ===================================================================== */
  class LocalProjectsSource {
    async load() {
      if (!Array.isArray(window.PCW_PROYECTOS)) {
        const error = new Error('No se cargó JS/proyectos-data.js. Revisa que el archivo exista con ese nombre exacto dentro de la carpeta JS y que esté enlazado ANTES de proyectos.js en proyectos.html.');
        error.visible = true;           // este mensaje sí se muestra en la página
        throw error;
      }
      if (!window.PCW_PROYECTOS.length) return [];
      return window.PCW_PROYECTOS;
    }
  }

  class ApiProjectsSource {
    constructor(url, timeoutMs) {
      this.url = url;
      this.timeoutMs = timeoutMs;
    }

    async load() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.url, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.success === false) throw new Error(data?.mensaje || `HTTP ${response.status}`);
        return Array.isArray(data) ? data : (data.proyectos || []);
      } finally {
        clearTimeout(timer);
      }
    }
  }


  /* =====================================================================
     ProjectModal — vista detallada con galería
     ===================================================================== */
  class ProjectModal {
    constructor(dialog, lightbox) {
      this.dialog = dialog;
      this.body = dialog.querySelector('[data-pcwp-modal-body]');
      this.lightbox = lightbox;
      this.lightboxImg = lightbox?.querySelector('[data-pcwp-lightbox-img]');
      this.project = null;
      this.index = 0;
      this.lastFocus = null;
      this.onClose = null;

      dialog.querySelectorAll('[data-pcwp-close]').forEach((btn) => btn.addEventListener('click', () => this.close()));
      dialog.addEventListener('click', (e) => { if (e.target === dialog) this.close(); });   // clic fuera
      dialog.addEventListener('close', () => {
        this.lastFocus?.focus();
        this.onClose?.();
      });
      // Flechas del teclado para cambiar de foto
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.showImage(this.index + 1);
        if (e.key === 'ArrowLeft') this.showImage(this.index - 1);
      });

      lightbox?.querySelector('[data-pcwp-lightbox-close]')?.addEventListener('click', () => lightbox.close());
      lightbox?.addEventListener('click', () => lightbox.close());
      // Flechas del teclado también en la foto ampliada
      lightbox?.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        this.showImage(this.index + (e.key === 'ArrowRight' ? 1 : -1));
        const main = this.body.querySelector('[data-pcwp-main]');
        if (main && this.lightboxImg) { this.lightboxImg.src = main.src; this.lightboxImg.alt = main.alt; }
      });
    }

    open(project) {
      this.project = project;
      this.index = 0;
      this.lastFocus = document.activeElement;
      this.body.replaceChildren(this.buildViewer(), this.buildInfo());
      this.showImage(0);
      this.dialog.showModal();
      this.dialog.querySelector('.pcwp-modal__back')?.focus();
    }

    close() {
      if (this.dialog.open) this.dialog.close();
    }

    /* --- Galería: foto grande, flechas y miniaturas --- */
    buildViewer() {
      const images = this.project.imagenes.length ? this.project.imagenes : [PLACEHOLDER];
      const viewer = document.createElement('div');
      viewer.className = 'pcwp-viewer';
      viewer.innerHTML = `
        <div class="pcwp-viewer__main">
          <img alt="" data-pcwp-main>
          <span class="pcwp-viewer__count" data-pcwp-count></span>
          <span class="pcwp-viewer__zoom" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>Ampliar
          </span>
        </div>`;

      const main = viewer.querySelector('[data-pcwp-main]');
      main.addEventListener('error', () => { main.src = PLACEHOLDER; });
      main.addEventListener('click', () => this.openLightbox());

      if (images.length > 1) {
        const box = viewer.querySelector('.pcwp-viewer__main');
        [['prev', -1, 'M15 6l-6 6 6 6', 'Foto anterior'], ['next', 1, 'M9 6l6 6-6 6', 'Foto siguiente']]
          .forEach(([name, step, path, label]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `pcwp-viewer__nav pcwp-viewer__nav--${name}`;
            btn.setAttribute('aria-label', label);
            btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
            btn.addEventListener('click', () => this.showImage(this.index + step));
            box.append(btn);
          });

        const thumbs = document.createElement('div');
        thumbs.className = 'pcwp-thumbs';
        thumbs.setAttribute('role', 'group');
        thumbs.setAttribute('aria-label', 'Fotos del proyecto');
        images.forEach((src, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pcwp-thumb';
          btn.setAttribute('aria-label', `Ver foto ${i + 1} de ${images.length}`);
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.loading = 'lazy';
          attachFallback(img);
          btn.append(img);
          btn.addEventListener('click', () => this.showImage(i));
          thumbs.append(btn);
        });
        viewer.append(thumbs);
      }
      return viewer;
    }

    showImage(i) {
      const images = this.project.imagenes.length ? this.project.imagenes : [PLACEHOLDER];
      this.index = (i + images.length) % images.length;
      const main = this.body.querySelector('[data-pcwp-main]');
      if (!main) return;
      main.src = images[this.index];
      main.alt = `${this.project.titulo} — foto ${this.index + 1} de ${images.length}`;
      const count = this.body.querySelector('[data-pcwp-count]');
      if (count) count.textContent = `${this.index + 1} / ${images.length}`;
      this.body.querySelectorAll('.pcwp-thumb').forEach((t, n) => {
        if (n === this.index) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
    }

    openLightbox() {
      if (!this.lightbox || !this.lightboxImg) return;
      const main = this.body.querySelector('[data-pcwp-main]');
      this.lightboxImg.src = main.src;
      this.lightboxImg.alt = main.alt;
      this.lightbox.showModal();
    }

    /* --- Información: título, categoría, descripción, listas, resultado --- */
    buildInfo() {
      const p = this.project;
      const info = document.createElement('div');
      info.className = 'pcwp-info';

      const tag = document.createElement('span');
      tag.className = 'pcwp-tag';
      tag.style.justifySelf = 'start';
      tag.innerHTML = iconSvg(p.categoria) + '<span></span>';
      tag.lastChild.textContent = CATEGORIES[p.categoria]?.label || p.categoria;

      const title = document.createElement('h2');
      title.className = 'pcwp-info__title';
      title.id = 'pcwp-modal-title';
      title.textContent = p.titulo;
      info.append(tag, title);

      if (p.fecha && formatDate(p.fecha)) {
        const time = document.createElement('time');
        time.className = 'pcwp-info__date';
        time.dateTime = p.fecha;
        time.textContent = formatDate(p.fecha);
        info.append(time);
      }

      if (p.descripcion) {
        const desc = document.createElement('p');
        desc.className = 'pcwp-info__desc';
        desc.textContent = p.descripcion;
        info.append(desc);
      }

      // Bloques que solo aparecen si tienen datos
      const addList = (heading, items, className) => {
        if (!items.length) return;
        const block = document.createElement('section');
        block.className = 'pcwp-info__block';
        const h = document.createElement('h3');
        h.textContent = heading;
        const ul = document.createElement('ul');
        ul.className = className;
        items.forEach((text) => {
          const li = document.createElement('li');
          li.textContent = text;
          ul.append(li);
        });
        block.append(h, ul);
        info.append(block);
      };
      addList('Trabajos realizados', p.trabajos, 'pcwp-info__list');
      addList('Tecnologías y equipos', p.tecnologias, 'pcwp-chips');

      if (p.resultado) {                  // solo con datos reales
        const block = document.createElement('section');
        block.className = 'pcwp-info__block';
        block.innerHTML = '<h3>Resultado</h3><p class="pcwp-info__result"></p>';
        block.querySelector('p').textContent = p.resultado;
        info.append(block);
      }
      return info;
    }
  }


  /* =====================================================================
     ProjectsGallery — tarjetas, filtros y búsqueda
     ===================================================================== */
  class ProjectsGallery {
    constructor(root, source, modal, config) {
      this.root = root;
      this.source = source;
      this.modal = modal;
      this.config = config;
      this.projects = [];
      this.filter = 'todos';
      this.query = '';
      this.searchTimer = null;

      this.els = {
        grid: root.querySelector('[data-pcwp-grid]'),
        filters: [...root.querySelectorAll('[data-pcwp-filter]')],
        search: root.querySelector('[data-pcwp-search]'),
        status: root.querySelector('[data-pcwp-status]'),
        empty: root.querySelector('[data-pcwp-empty]'),
        emptyText: root.querySelector('[data-pcwp-empty-text]'),
        reset: root.querySelector('[data-pcwp-reset]'),
      };
    }

    async init() {
      this.bindEvents();
      try {
        const raw = await this.source.load();
        this.projects = raw.map((p) => ProjectsGallery.normalizeProject(p)).filter(Boolean)
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        this.render();
        this.openFromUrl();
      } catch (error) {
        console.error('[Proyectos PCW] Error al cargar los proyectos:', error);
        this.showMessage(error.visible
          ? error.message
          : `No pudimos mostrar los proyectos (${error.message}). Revisa la consola con F12.`, false);
      }
    }

    /** Valida y completa cada proyecto (los datos pueden venir de un Excel o de OneDrive) */
    static normalizeProject(p) {
      if (!p || !p.titulo) return null;
      const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/\n|;/)).map((s) => String(s).trim()).filter(Boolean);
      return {
        id: String(p.id || normalize(p.titulo).replace(/[^a-z0-9]+/g, '-')),
        categoria: normalize(p.categoria).replace(/\s+/g, ''),
        titulo: String(p.titulo),
        resumen: String(p.resumen || ''),
        descripcion: String(p.descripcion || ''),
        trabajos: list(p.trabajos),
        tecnologias: list(p.tecnologias),
        resultado: String(p.resultado || '').trim(),
        imagenes: list(p.imagenes),
        fecha: String(p.fecha || ''),
      };
    }

    bindEvents() {
      this.els.filters.forEach((btn) =>
        btn.addEventListener('click', () => this.setFilter(btn.dataset.pcwpFilter)));

      this.els.search?.addEventListener('input', (e) => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.query = normalize(e.target.value.trim());
          this.render();
        }, this.config.SEARCH_DELAY_MS);
      });

      this.els.reset?.addEventListener('click', () => {
        if (this.els.search) this.els.search.value = '';
        this.query = '';
        this.setFilter('todos');
      });

      // Abrir detalles (delegación: sirve para todas las tarjetas)
      this.els.grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pcwp-open]');
        if (!btn) return;
        const project = this.projects.find((p) => p.id === btn.dataset.pcwpOpen);
        if (project) this.openProject(project);
      });

      // Al cerrar la ventana se quita el proyecto de la dirección
      if (this.modal) this.modal.onClose = () => {
        if (location.hash.startsWith('#proyecto-')) history.replaceState(null, '', location.pathname + location.search);
      };
      window.addEventListener('hashchange', () => this.openFromUrl());
    }

    setFilter(key) {
      this.filter = key;
      this.els.filters.forEach((btn) => {
        const active = btn.dataset.pcwpFilter === key;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      this.render();
    }

    /** Filtro y búsqueda funcionan juntos */
    get visibleProjects() {
      return this.projects.filter((p) => {
        if (this.filter !== 'todos' && p.categoria !== this.filter) return false;
        if (!this.query) return true;
        const haystack = normalize([p.titulo, CATEGORIES[p.categoria]?.label, p.resumen, p.descripcion].join(' '));
        return haystack.includes(this.query);
      });
    }

    render() {
      const list = this.visibleProjects;
      if (!this.projects.length) return this.showMessage('Aún no hay proyectos publicados.', false);
      if (!list.length) return this.showMessage('No encontramos proyectos con ese filtro o búsqueda.', true);

      this.els.empty.hidden = true;
      this.els.grid.hidden = false;
      const fragment = document.createDocumentFragment();
      list.forEach((p, i) => fragment.append(this.buildCard(p, i)));
      this.els.grid.replaceChildren(fragment);
      if (this.els.status) {
        this.els.status.textContent = list.length === 1 ? '1 proyecto' : `${list.length} proyectos`;
      }
    }

    buildCard(p, i) {
      const li = document.createElement('li');
      li.className = 'pcwp-card';
      li.style.animationDelay = `${Math.min(i, 8) * 60}ms`;
      li.innerHTML = `
        <div class="pcwp-card__media">
          <img alt="" loading="lazy" decoding="async">
          <span class="pcwp-tag">${iconSvg(p.categoria)}<span></span></span>
        </div>
        <div class="pcwp-card__body">
          <h3 class="pcwp-card__title"></h3>
          <p class="pcwp-card__text"></p>
          <time class="pcwp-card__date"></time>
          <button type="button" class="pcwp-card__btn">${ARROW}</button>
        </div>`;

      const img = li.querySelector('img');
      img.src = p.imagenes[0] || PLACEHOLDER;
      img.alt = p.titulo;
      attachFallback(img);

      li.querySelector('.pcwp-tag > span').textContent = CATEGORIES[p.categoria]?.label || p.categoria;
      li.querySelector('.pcwp-card__title').textContent = p.titulo;
      li.querySelector('.pcwp-card__text').textContent = p.resumen;
      const date = li.querySelector('.pcwp-card__date');
      if (p.fecha && formatDate(p.fecha)) { date.dateTime = p.fecha; date.textContent = formatDate(p.fecha); }
      else date.remove();

      const btn = li.querySelector('.pcwp-card__btn');
      btn.dataset.pcwpOpen = p.id;
      btn.setAttribute('aria-label', `Ver detalles del proyecto: ${p.titulo}`);
      return li;
    }

    showMessage(text, withReset) {
      this.els.grid.replaceChildren();
      this.els.grid.hidden = true;
      this.els.emptyText.textContent = text;
      this.els.reset.hidden = !withReset;
      this.els.empty.hidden = false;
      if (this.els.status) this.els.status.textContent = text;
    }

    /* --- Enlace directo a un proyecto: proyectos.html#proyecto-ID --- */
    openProject(project) {
      if (!this.modal) return;
      history.replaceState(null, '', `#proyecto-${encodeURIComponent(project.id)}`);
      this.modal.open(project);
    }

    openFromUrl() {
      const match = location.hash.match(/^#proyecto-(.+)$/);
      if (!match || !this.modal || this.modal.dialog.open) return;
      const project = this.projects.find((p) => p.id === decodeURIComponent(match[1]));
      if (project) this.modal.open(project);
    }
  }


  /* =====================================================================
     PageHeader — comportamiento del header en esta página
     ===================================================================== */
  class PageHeader {
    init() {
      const header = document.getElementById('header');
      const toTop = document.getElementById('toTop');
      const hamburger = document.getElementById('hamburger');
      const nav = document.getElementById('nav');

      // Sombra del header y botón "volver arriba" al bajar
      const onScroll = () => {
        const y = window.scrollY;
        header?.classList.toggle('is-scrolled', y > 40);
        toTop?.classList.toggle('is-visible', y > 600);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

      // Menú hamburguesa (celular)
      if (hamburger && nav) {
        const setOpen = (open) => {
          hamburger.setAttribute('aria-expanded', String(open));
          hamburger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
          nav.classList.toggle('is-open', open);
          document.body.classList.toggle('menu-open', open);
        };
        hamburger.addEventListener('click', () => setOpen(hamburger.getAttribute('aria-expanded') !== 'true'));
        nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); hamburger.focus(); }
        });
        window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
      }

      // Año del footer
      const year = document.getElementById('year');
      if (year) year.textContent = new Date().getFullYear();
    }
  }


  /* ============================ ARRANQUE ============================ */
  document.addEventListener('DOMContentLoaded', () => {
    new PageHeader().init();
    console.info('[Proyectos PCW] Datos cargados:', Array.isArray(window.PCW_PROYECTOS)
      ? `${window.PCW_PROYECTOS.length} proyectos`
      : 'NO (falta JS/proyectos-data.js)');

    const root = document.getElementById('galeria');
    if (!root) return;
    const dialog = document.querySelector('[data-pcwp-modal]');
    const lightbox = document.querySelector('[data-pcwp-lightbox]');
    const modal = dialog ? new ProjectModal(dialog, lightbox) : null;
    const source = CONFIG.SOURCE === 'api'
      ? new ApiProjectsSource(CONFIG.API_URL, CONFIG.REQUEST_TIMEOUT_MS)
      : new LocalProjectsSource();
    new ProjectsGallery(root, source, modal, CONFIG).init();
  });
})();