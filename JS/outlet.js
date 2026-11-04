/* =====================================================================
   PCW — JS/outlet.js
   Catálogo del Outlet (sección #outlet).

   Clases:
     SampleOutletSource → ⚠️ DATOS TEMPORALES de ejemplo (etapa 1)
     ApiOutletSource    → datos reales: /api/outlet/productos (Excel de OneDrive)
     ProductModal       → ventana "Ver detalles"
     OutletCatalog      → tarjetas, filtros, búsqueda, orden y sincronización

   - No escribe productos en el HTML: todo se genera aquí.
   - Oculta automáticamente los productos sin existencias.
   - Calcula el porcentaje de descuento con los precios.
   - No usa credenciales: solo consulta a tu servidor Node.js, que lee
     el Excel sincronizado por OneDrive (ExcelJS).
   - Columnas del Excel: se reconocen sin importar mayúsculas, tildes
     ni espacios (ver COLUMNAS más abajo).
   ===================================================================== */

(() => {
  'use strict';

  /* --------------------------- CONFIGURACIÓN --------------------------- */
  const CONFIG = {
    // 'api' = Excel de OneDrive a través del servidor Node.js · 'ejemplo' = datos temporales
    SOURCE: 'api',

    // Servidor Node.js que entrega los productos (Render).
    // La página puede estar en IONOS (pcwcr.com) y el servidor en Render:
    //   · página en pcwcr.com u otro dominio → usa el servidor de Render
    //   · página servida por el propio servidor (Render o localhost:3000) → misma dirección
    //   · Live Server (5500) o doble clic → servidor local http://localhost:3000
    // Si cambias de servidor, edita solo API_SERVER.
    API_SERVER: 'https://pagina-server-h7mf.onrender.com',
    get SERVER_URL() {
      const { hostname, port, protocol } = location;
      const esLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      if (hostname.endsWith('onrender.com')) return '';             // la página la entrega Render
      if (esLocal && port === '3000') return '';                     // la página la entrega Node en tu PC
      if (esLocal || protocol === 'file:') return 'http://localhost:3000';
      return this.API_SERVER;                                        // pcwcr.com (IONOS) u otro dominio
    },
    PRODUCTS_PATH: '/api/outlet/productos',
    IMAGES_PATH: '/api/outlet/imagenes/',
    SYNC_INTERVAL_MS: 60000,         // cada cuánto se revisan cambios (solo en modo 'api')
    REQUEST_TIMEOUT_MS: 60000,       // 60 s: el plan gratuito de Render tarda en "despertar"
    WHATSAPP_NUMBER: '50687231636',  // botón "Consultar por WhatsApp" de la ventana de detalles
    LOW_STOCK: 2,                    // con esta cantidad o menos: "Últimas unidades"
    SEARCH_DELAY_MS: 200,
  };

  const CATEGORY_LABELS = {
    laptops: 'Laptops',
    computadoras: 'Computadoras',
    componentes: 'Componentes',
    accesorios: 'Accesorios',
    camaras: 'Cámaras',
    redes: 'Redes',
  };

  const MESSAGES = {
    empty: 'En este momento no hay productos en oferta. Vuelve pronto o visítanos en tienda.',
    noResults: 'No encontramos productos con ese filtro o búsqueda.',
    error: 'No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.',
  };


  /* =====================================================================
     Utilidades
     ===================================================================== */
  const formatCRC = (value) =>
    '₡' + String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const normalizeText = (text) =>
    String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const discountOf = (original, offer) =>
    original > 0 && offer > 0 && offer < original ? Math.round((1 - offer / original) * 100) : 0;

  /** Dibujo genérico por categoría (se usa si el producto no tiene foto) */
  const placeholderImage = (category) => {
    const icons = {
      laptops: '<rect x="70" y="60" width="160" height="100" rx="8"/><path d="M50 175h200l-15 15H65z"/>',
      computadoras: '<rect x="110" y="40" width="80" height="150" rx="8"/><circle cx="150" cy="70" r="8"/><path d="M125 160h50"/>',
      componentes: '<rect x="60" y="80" width="180" height="70" rx="8"/><circle cx="110" cy="115" r="22"/><circle cx="190" cy="115" r="22"/>',
      accesorios: '<path d="M90 120a60 60 0 0 1 120 0v40h-25v-40M90 120v40h25v-40"/>',
      camaras: '<circle cx="150" cy="105" r="45"/><circle cx="150" cy="105" r="18"/><path d="M150 150v35M120 185h60"/>',
      redes: '<rect x="50" y="95" width="200" height="45" rx="6"/><path d="M75 117h10M100 117h10M125 117h10M150 117h10M175 117h10"/>',
    };
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 225"><rect width="300" height="225" fill="#F1F5F9"/>' +
      '<g fill="none" stroke="#94A3B8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
      (icons[category] || icons.accesorios) + '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };


  /* =====================================================================
     ⚠️ DATOS TEMPORALES — SOLO PARA LA ETAPA 1 (diseño)
     Se reemplazan por el inventario de OneDrive en la etapa 3.
     ===================================================================== */
  class SampleOutletSource {
    async load() {
      const sample = [
        { id: 'EJEMPLO-001', nombre: 'Laptop HP 15"', marca: 'HP', categoria: 'laptops', precioOriginal: 280000, precioOferta: 196000, stock: 4, fechaIngreso: '2026-10-15', descripcion: 'Laptop de 15.6" ideal para oficina y estudio. Producto de ejemplo.' },
        { id: 'EJEMPLO-002', nombre: 'PC Dell OptiPlex', marca: 'Dell', categoria: 'computadoras', precioOriginal: 320000, precioOferta: 240000, stock: 3, fechaIngreso: '2026-10-14', descripcion: 'Computadora de escritorio compacta para empresas. Producto de ejemplo.' },
        { id: 'EJEMPLO-003', nombre: 'Tarjeta de video RTX 3060', marca: 'NVIDIA', categoria: 'componentes', precioOriginal: 280000, precioOferta: 168000, stock: 2, fechaIngreso: '2026-10-13', descripcion: 'Tarjeta gráfica de 12 GB para diseño y videojuegos. Producto de ejemplo.' },
        { id: 'EJEMPLO-004', nombre: 'Cámara de seguridad 4MP', marca: 'Dahua', categoria: 'camaras', precioOriginal: 85000, precioOferta: 55000, stock: 6, fechaIngreso: '2026-10-12', descripcion: 'Cámara IP de 4 MP con visión nocturna. Producto de ejemplo.' },
        { id: 'EJEMPLO-005', nombre: 'UPS 1000VA', marca: 'Forza', categoria: 'accesorios', precioOriginal: 120000, precioOferta: 96000, stock: 5, fechaIngreso: '2026-10-11', descripcion: 'Respaldo de energía para equipos de oficina. Producto de ejemplo.' },
        { id: 'EJEMPLO-006', nombre: 'Monitor 24" Full HD', marca: 'LG', categoria: 'accesorios', precioOriginal: 96000, precioOferta: 72000, stock: 1, fechaIngreso: '2026-10-10', descripcion: 'Monitor IPS de 24 pulgadas, resolución 1920×1080. Producto de ejemplo.' },
        { id: 'EJEMPLO-007', nombre: 'Switch Ruijie 24 puertos', marca: 'Ruijie', categoria: 'redes', precioOriginal: 150000, precioOferta: 105000, stock: 3, fechaIngreso: '2026-10-09', descripcion: 'Switch administrable de 24 puertos Gigabit. Producto de ejemplo.' },
        { id: 'EJEMPLO-008', nombre: 'Router Wi-Fi 6', marca: 'Ruijie', categoria: 'redes', precioOriginal: 65000, precioOferta: 45500, stock: 0, fechaIngreso: '2026-10-08', descripcion: 'Agotado: no debe aparecer en el catálogo. Producto de ejemplo.' },
      ];
      return sample.map((p) => ({ ...p, imagen: '' }));
    }
  }


  /* =====================================================================
     Datos reales — Excel de OneDrive a través del servidor Node.js
     El navegador NUNCA ve rutas del sistema, claves ni tokens: solo
     consulta tu servidor.
     ===================================================================== */

  /* Nombres de columna aceptados para cada dato (en el orden en que se buscan).
     Si tu Excel usa otro nombre, agrégalo aquí. */
  const COLUMNAS = {
    id:             ['ID', 'Codigo', 'Código', 'SKU'],
    nombre:         ['Nombre', 'Productos', 'Producto', 'Nombre Producto', 'Descripcion Corta'],
    marca:          ['Marca', 'Fabricante'],
    categoria:      ['Categoria', 'Categoría'],
    descripcion:    ['Descripcion', 'Descripción', 'Detalle', 'Detalles'],
    precioOriginal: ['Precio Original', 'Precio Normal', 'Precio Anterior', 'Precio Regular', 'Precio'],
    precioOferta:   ['Precio Oferta', 'Precio Nuevo', 'Precio Outlet', 'Precio Descuento', 'Oferta', 'Precio Final'],
    stock:          ['Stock', 'Cantidad', 'Existencias', 'Unidades', 'Inventario'],
    imagen:         ['Imagen', 'Foto', 'Imagen Archivo', 'Archivo Imagen', 'Imagenes'],
    activo:         ['Activo', 'Visible', 'Publicar', 'Mostrar', 'Disponible'],
    fechaIngreso:   ['Fecha Ingreso', 'Fecha', 'Fecha de Ingreso', 'Ingreso'],
  };

  class ApiOutletSource {
    constructor(config) {
      this.config = config;
      this.url = config.SERVER_URL + config.PRODUCTS_PATH;
    }

    async load() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(this.url, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.success === false) {
          throw new Error(data?.mensaje || `HTTP ${response.status}`);
        }
        const filas = Array.isArray(data) ? data : (data.productos || []);
        return filas.map((fila) => this.mapRow(fila)).filter(Boolean);
      } finally {
        clearTimeout(timer);
      }
    }

    /** Convierte una fila del Excel al formato que usan las tarjetas */
    mapRow(fila) {
      const get = (campo) => ApiOutletSource.pick(fila, COLUMNAS[campo]);

      // Filas marcadas como no visibles (Activo = No / Falso / 0)
      const activo = get('activo');
      if (activo !== undefined && /^(no|false|falso|0|n)$/i.test(String(activo).trim())) return null;

      const stockValor = get('stock');
      return {
        id: String(get('id') ?? get('nombre') ?? ''),
        nombre: get('nombre'),
        marca: get('marca') || '',
        categoria: get('categoria') || '',
        descripcion: get('descripcion') || '',
        precioOriginal: ApiOutletSource.toNumber(get('precioOriginal')),
        precioOferta: ApiOutletSource.toNumber(get('precioOferta')),
        // Sin columna de stock: null (se muestra "En stock" y no se indican unidades)
        stock: stockValor === undefined || stockValor === '' ? null : ApiOutletSource.toNumber(stockValor),
        imagen: this.imageUrl(get('imagen')),
        fechaIngreso: String(get('fechaIngreso') || ''),
      };
    }

    /** "laptop-hp.png" → http://localhost:3000/api/outlet/imagenes/laptop-hp.png */
    imageUrl(valor) {
      const archivo = String(valor || '').trim();
      if (!archivo) return '';
      if (/^https?:\/\//i.test(archivo)) return archivo;               // ya es un enlace completo
      const nombre = archivo.split(/[\\/]/).pop();                      // solo el nombre del archivo
      return this.config.SERVER_URL + this.config.IMAGES_PATH + encodeURIComponent(nombre);
    }

    /** Busca una columna sin importar mayúsculas, tildes ni espacios */
    static pick(fila, nombres) {
      const limpiar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '');
      const claves = Object.keys(fila);
      for (const nombre of nombres) {
        const clave = claves.find((k) => limpiar(k) === limpiar(nombre));
        if (clave !== undefined && fila[clave] !== null && fila[clave] !== '') return fila[clave];
      }
      return undefined;
    }

    /** 196000 · "₡196.000" · "196,000" → 196000 */
    static toNumber(valor) {
      if (typeof valor === 'number') return Math.round(valor);
      const digitos = String(valor ?? '').replace(/[^\d]/g, '');
      return digitos ? Number(digitos) : 0;
    }
  }


  /* =====================================================================
     ProductModal — ventana "Ver detalles"
     ===================================================================== */
  class ProductModal {
    constructor(dialog, config) {
      this.dialog = dialog;
      this.body = dialog.querySelector('[data-pcwo-modal-body]');
      this.config = config;
      this.lastFocus = null;

      dialog.querySelector('[data-pcwo-close]')?.addEventListener('click', () => this.close());
      // Clic fuera de la ventana: cerrar
      dialog.addEventListener('click', (e) => { if (e.target === dialog) this.close(); });
      dialog.addEventListener('close', () => this.lastFocus?.focus());
    }

    open(product) {
      this.lastFocus = document.activeElement;
      this.body.replaceChildren(this.build(product));
      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
    }

    close() {
      if (typeof this.dialog.close === 'function') this.dialog.close();
      else this.dialog.removeAttribute('open');
    }

    whatsappLink(p) {
      const number = String(this.config.WHATSAPP_NUMBER || '').replace(/\D/g, '');
      if (number.length < 8) return '';
      const text = `Hola PCW, me interesa el producto del Outlet: ${p.nombre}` +
        (p.marca ? ` (${p.marca})` : '') + ` a ${formatCRC(p.precioOferta)} [código ${p.id}]. ¿Está disponible?`;
      return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }

    build(p) {
      const wrap = document.createDocumentFragment();

      const media = document.createElement('div');
      media.className = 'pcwo-modal__media';
      const img = document.createElement('img');
      img.src = p.imagen || placeholderImage(p.categoria);
      img.alt = p.nombre;
      img.addEventListener('error', () => { img.src = placeholderImage(p.categoria); }, { once: true });
      media.append(img);
      if (p.descuento > 0) {
        const badge = document.createElement('span');
        badge.className = 'pcwo-product__badge';
        badge.textContent = `-${p.descuento}%`;
        media.append(badge);
      }

      const info = document.createElement('div');
      info.className = 'pcwo-modal__info';
      info.innerHTML = `
        <span class="pcwo-product__category"></span>
        <h3 class="pcwo-modal__title" id="pcwo-modal-title"></h3>
        <p class="pcwo-modal__desc"></p>
        <div class="pcwo-product__prices">
          <span class="pcwo-product__old"></span>
          <strong class="pcwo-product__price"></strong>
        </div>
        <span class="pcwo-modal__save"></span>
        <span class="pcwo-product__stock"></span>
        <ul class="pcwo-modal__specs"></ul>
        <a class="pcwo-modal__cta" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.4 12c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1c0 1.2.9 2.4 1 2.6.1.2 1.8 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2z"/></svg>
          <span>Consultar por WhatsApp</span>
        </a>`;

      // Los textos se colocan con textContent (seguro aunque vengan del Excel)
      info.querySelector('.pcwo-product__category').textContent = CATEGORY_LABELS[p.categoria] || p.categoriaTexto || p.categoria;
      info.querySelector('.pcwo-modal__title').textContent = p.nombre;
      const desc = info.querySelector('.pcwo-modal__desc');
      if (p.descripcion) desc.textContent = p.descripcion; else desc.remove();
      const old = info.querySelector('.pcwo-product__old');
      if (p.descuento > 0) old.textContent = formatCRC(p.precioOriginal); else old.remove();
      info.querySelector('.pcwo-product__price').textContent = formatCRC(p.precioOferta);
      const save = info.querySelector('.pcwo-modal__save');
      if (p.descuento > 0) save.textContent = `Ahorras ${formatCRC(p.precioOriginal - p.precioOferta)} (${p.descuento}%)`;
      else save.remove();
      OutletCatalog.fillStock(info.querySelector('.pcwo-product__stock'), p, this.config);

      const specs = info.querySelector('.pcwo-modal__specs');
      [['Marca', p.marca], ['Código', p.id], ['Unidades disponibles', p.stock]].forEach(([label, value]) => {
        if (value === undefined || value === null || value === '') return;
        const li = document.createElement('li');
        li.innerHTML = '<span></span><strong></strong>';
        li.firstChild.textContent = label;
        li.lastChild.textContent = value;
        specs.append(li);
      });

      const cta = info.querySelector('.pcwo-modal__cta');
      const link = this.whatsappLink(p);
      if (link) cta.href = link; else cta.remove();

      wrap.append(media, info);
      return wrap;
    }
  }


  /* =====================================================================
     OutletCatalog — tarjetas, filtros, búsqueda, orden y sincronización
     ===================================================================== */
  class OutletCatalog {
    constructor(root, source, config) {
      this.root = root;
      this.source = source;
      this.config = config;
      this.products = [];
      this.signature = '';
      this.filter = 'todos';
      this.query = '';
      this.sort = 'recientes';
      this.timer = null;
      this.searchTimer = null;

      this.els = {
        grid: root.querySelector('[data-pcwo-grid]'),
        filters: [...root.querySelectorAll('[data-pcwo-filter]')],
        search: root.querySelector('[data-pcwo-search]'),
        sort: root.querySelector('[data-pcwo-sort]'),
        status: root.querySelector('[data-pcwo-status]'),
        empty: root.querySelector('[data-pcwo-empty]'),
        emptyText: root.querySelector('[data-pcwo-empty-text]'),
        retry: root.querySelector('[data-pcwo-retry]'),
        bannerImg: root.querySelector('[data-pcwo-banner-img]'),
      };

      const dialog = root.querySelector('[data-pcwo-modal]');
      this.modal = dialog ? new ProductModal(dialog, config) : null;
    }

    async init() {
      if (!this.els.grid) return console.error('[Outlet PCW] Falta [data-pcwo-grid] en el HTML.');
      this.setupBannerImage();
      this.bindEvents();
      this.renderSkeletons(4);
      await this.sync();
      this.startAutoSync();
    }

    /* --- Imagen del banner: si no existe, se oculta --- */
    setupBannerImage() {
      const img = this.els.bannerImg;
      if (!img) return;
      const hide = () => img.parentElement.classList.add('is-empty');
      if (img.complete && img.naturalWidth === 0) hide();
      img.addEventListener('error', hide, { once: true });
    }

    /* --- Eventos --- */
    bindEvents() {
      this.els.filters.forEach((btn) =>
        btn.addEventListener('click', () => this.setFilter(btn.dataset.pcwoFilter)));

      this.els.search?.addEventListener('input', (e) => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.query = normalizeText(e.target.value.trim());
          this.render();
        }, this.config.SEARCH_DELAY_MS);
      });

      this.els.sort?.addEventListener('change', (e) => {
        this.sort = e.target.value;
        this.render();
      });

      this.els.retry?.addEventListener('click', () => this.sync());

      // "Ver detalles" (delegación: sirve para las tarjetas creadas después)
      this.els.grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pcwo-details]');
        if (!btn || !this.modal) return;
        const product = this.products.find((p) => p.id === btn.dataset.pcwoDetails);
        if (product) this.modal.open(product);
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stopAutoSync(); else this.startAutoSync();
      });
    }

    /* --- Datos --- */
    async sync() {
      try {
        const raw = await this.source.load();
        const products = raw.map((p) => this.normalize(p)).filter((p) => p && (p.stock === null || p.stock > 0));
        const signature = JSON.stringify(products);
        if (signature === this.signature) return;      // sin cambios: no se vuelve a dibujar
        this.signature = signature;
        this.products = products;
        this.render();
      } catch (error) {
        console.error('[Outlet PCW] Error al cargar productos:', error);
        if (!this.products.length) this.showMessage(MESSAGES.error, true);
      }
    }

    normalize(p) {
      if (!p || !p.nombre) return null;
      const precioOriginal = Number(p.precioOriginal) || 0;
      const precioOferta = Number(p.precioOferta) || precioOriginal;
      return {
        id: String(p.id ?? p.nombre),
        nombre: String(p.nombre),
        marca: p.marca ? String(p.marca) : '',
        categoria: normalizeText(p.categoria).replace(/\s+/g, ''),
        categoriaTexto: p.categoria ? String(p.categoria) : '',       // nombre tal como está en el Excel
        descripcion: p.descripcion ? String(p.descripcion) : '',
        precioOriginal,
        precioOferta,
        descuento: discountOf(precioOriginal, precioOferta),   // se calcula automáticamente
        stock: p.stock === null || p.stock === undefined ? null : Number(p.stock),
        imagen: p.imagen ? String(p.imagen) : '',
        fechaIngreso: p.fechaIngreso ? String(p.fechaIngreso) : '',
      };
    }

    startAutoSync() {
      if (this.config.SOURCE !== 'api' || this.timer || document.hidden) return;
      this.timer = setInterval(() => this.sync(), this.config.SYNC_INTERVAL_MS);
    }

    stopAutoSync() {
      clearInterval(this.timer);
      this.timer = null;
    }

    /* --- Filtros, búsqueda y orden --- */
    setFilter(key) {
      this.filter = key;
      this.els.filters.forEach((btn) => {
        const active = btn.dataset.pcwoFilter === key;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      this.render();
    }

    get visibleProducts() {
      let list = this.products;
      if (this.filter !== 'todos') list = list.filter((p) => p.categoria === this.filter);
      if (this.query) {
        list = list.filter((p) => normalizeText(`${p.nombre} ${p.marca}`).includes(this.query));
      }
      const sorters = {
        recientes: (a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso),
        'precio-asc': (a, b) => a.precioOferta - b.precioOferta,
        'precio-desc': (a, b) => b.precioOferta - a.precioOferta,
        descuento: (a, b) => b.descuento - a.descuento,
      };
      return [...list].sort(sorters[this.sort] || sorters.recientes);
    }

    /* --- Renderizado --- */
    render() {
      if (!this.products.length) return this.showMessage(MESSAGES.empty, false);

      const list = this.visibleProducts;
      if (!list.length) return this.showMessage(MESSAGES.noResults, false);

      this.hideMessage();
      const fragment = document.createDocumentFragment();
      list.forEach((p, i) => fragment.append(this.buildCard(p, i)));
      this.els.grid.replaceChildren(fragment);

      if (this.els.status) {
        this.els.status.textContent = list.length === 1 ? '1 producto en oferta' : `${list.length} productos en oferta`;
      }
    }

    buildCard(p, index) {
      const li = document.createElement('li');
      li.className = 'pcwo-product';
      li.style.animationDelay = `${Math.min(index, 8) * 50}ms`;
      li.innerHTML = `
        <div class="pcwo-product__media">
          <img alt="" loading="lazy" decoding="async">
        </div>
        <div class="pcwo-product__body">
          <span class="pcwo-product__category"></span>
          <h4 class="pcwo-product__name"></h4>
          <div class="pcwo-product__prices">
            <span class="pcwo-product__old"></span>
            <strong class="pcwo-product__price"></strong>
          </div>
          <span class="pcwo-product__stock"></span>
          <button type="button" class="pcwo-product__btn">
            Ver detalles
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>`;

      // Imagen (con dibujo genérico si falta o falla)
      const img = li.querySelector('img');
      img.src = p.imagen || placeholderImage(p.categoria);
      img.alt = p.nombre;
      img.addEventListener('error', () => { img.src = placeholderImage(p.categoria); }, { once: true });

      // Etiqueta de descuento
      if (p.descuento > 0) {
        const badge = document.createElement('span');
        badge.className = 'pcwo-product__badge';
        badge.textContent = `-${p.descuento}%`;
        badge.setAttribute('aria-label', `${p.descuento}% de descuento`);
        li.querySelector('.pcwo-product__media').prepend(badge);
      }

      li.querySelector('.pcwo-product__category').textContent = CATEGORY_LABELS[p.categoria] || p.categoriaTexto || p.categoria;
      li.querySelector('.pcwo-product__name').textContent = p.nombre;

      const old = li.querySelector('.pcwo-product__old');
      if (p.descuento > 0) {
        old.textContent = formatCRC(p.precioOriginal);
        old.setAttribute('aria-label', `Precio anterior ${formatCRC(p.precioOriginal)}`);
      } else {
        old.remove();
      }
      li.querySelector('.pcwo-product__price').textContent = formatCRC(p.precioOferta);

      OutletCatalog.fillStock(li.querySelector('.pcwo-product__stock'), p, this.config);

      const btn = li.querySelector('.pcwo-product__btn');
      btn.dataset.pcwoDetails = p.id;
      btn.setAttribute('aria-label', `Ver detalles de ${p.nombre}`);
      return li;
    }

    static fillStock(el, p, config) {
      const low = p.stock !== null && p.stock <= config.LOW_STOCK;
      el.textContent = low ? 'Últimas unidades' : 'En stock';
      el.classList.toggle('pcwo-product__stock--ultimas', low);
    }

    renderSkeletons(count) {
      const card = `
        <li class="pcwo-product pcwo-product--skeleton" aria-hidden="true">
          <div class="pcwo-product__media"></div>
          <div class="pcwo-product__body">
            <span class="pcwo-skel"></span>
            <span class="pcwo-skel pcwo-skel--short"></span>
            <span class="pcwo-skel pcwo-skel--btn"></span>
          </div>
        </li>`;
      this.els.grid.innerHTML = card.repeat(count);
    }

    showMessage(text, withRetry) {
      this.els.grid.replaceChildren();
      this.els.grid.hidden = true;
      if (this.els.emptyText) this.els.emptyText.textContent = text;
      if (this.els.retry) this.els.retry.hidden = !withRetry;
      if (this.els.empty) this.els.empty.hidden = false;
      if (this.els.status) this.els.status.textContent = text;
    }

    hideMessage() {
      this.els.grid.hidden = false;
      if (this.els.empty) this.els.empty.hidden = true;
    }
  }


  /* ============================ ARRANQUE ============================ */
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('outlet');
    if (!root) return;
    const source = CONFIG.SOURCE === 'api'
      ? new ApiOutletSource(CONFIG)
      : new SampleOutletSource();
    new OutletCatalog(root, source, CONFIG).init();
  });
})();
