/* PCW — JS/outlet.js
   Catálogo del Outlet (sección #outlet).

   Clases:
     SampleOutletSource → DATOS TEMPORALES de ejemplo (etapa 1)
     ApiOutletSource    → datos reales: /api/outlet/productos (Excel de OneDrive)
     ProductModal       → ventana "Ver detalles"
     OutletCatalog      → tarjetas, filtros, búsqueda, orden y sincronización

   - No escribe productos en el HTML: todo se genera aquí.
   - Oculta automáticamente los productos sin existencias.
   - Calcula el porcentaje de descuento con los precios.
   - No usa credenciales: solo consulta a tu servidor Node.js, que lee
     el Excel sincronizado por OneDrive (ExcelJS).
   - Columnas del Excel: se reconocen sin importar mayúsculas, tildes
     ni espacios (ver COLUMNAS más abajo).*/

  // IIFE: encapsula todo el catálogo para no crear variables globales en la página.
  // La función se ejecuta inmediatamente después de ser declarada.
(() => {
  'use strict';

  /* CONFIGURACIÓN */
  // CONFIG reúne los valores que controlan el origen de datos, las rutas, los tiempos y la presentación del catálogo.
  const CONFIG = {
    // 'api' = Excel de OneDrive a través del servidor Node.js · 'ejemplo' = datos temporales
    SOURCE: 'api',

    // Servidor Node.js. Si la página la entrega el propio servidor (localhost:3000
    // o el sitio publicado) se usa la misma dirección; con Live Server (5500) o
    // doble clic se usa http://localhost:3000.
    SERVER_URL: (location.protocol.startsWith('http') && !['5500', '5501'].includes(location.port))
      ? ''                              // página servida por Node (localhost:3000 o el dominio publicado)
      : 'http://localhost:3000',        // Live Server o archivo abierto con doble clic
    PRODUCTS_PATH: '/api/outlet/productos',
    IMAGES_PATH: '/api/outlet/imagenes/',
    SYNC_INTERVAL_MS: 60000,         // cada cuánto se revisan cambios (solo en modo 'api')
    REQUEST_TIMEOUT_MS: 15000,
    WHATSAPP_NUMBER: '50687231636',  // botón "Consultar por WhatsApp" de la ventana de detalles
    LOW_STOCK: 2,                    // con esta cantidad o menos: "Últimas unidades"
    SEARCH_DELAY_MS: 200,
  };

  // CATEGORY_LABELS convierte las claves internas de categoría en textos legibles para las personas.
  const CATEGORY_LABELS = {
    laptops: 'Laptops',
    computadoras: 'Computadoras',
    componentes: 'Componentes',
    accesorios: 'Accesorios',
    camaras: 'Cámaras',
    redes: 'Redes',
  };

  // MESSAGES centraliza los textos mostrados cuando no hay productos, no hay coincidencias o ocurre un error.
  const MESSAGES = {
    empty: 'En este momento no hay productos en oferta. Vuelve pronto o visítanos en tienda.',
    noResults: 'No encontramos productos con ese filtro o búsqueda.',
    error: 'No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.',
  };


  /* Utilidades */
  // formatCRC recibe un valor numérico y lo presenta como moneda en colones costarricenses.
  const formatCRC = (value) =>
    '₡' + String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // normalizeText convierte un texto a minúsculas y elimina tildes para facilitar comparaciones y búsquedas.
  const normalizeText = (text) =>
    String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // discountOf calcula el porcentaje de descuento solo cuando la oferta es menor que el precio original.
  const discountOf = (original, offer) =>
    original > 0 && offer > 0 && offer < original ? Math.round((1 - offer / original) * 100) : 0;

  /** Dibujo genérico por categoría (se usa si el producto no tiene foto) */
  // placeholderImage genera una imagen SVG de respaldo según la categoría del producto.
  const placeholderImage = (category) => {
    // icons contiene los dibujos SVG utilizados como imagen genérica para cada categoría.
    const icons = {
      laptops: '<rect x="70" y="60" width="160" height="100" rx="8"/><path d="M50 175h200l-15 15H65z"/>',
      computadoras: '<rect x="110" y="40" width="80" height="150" rx="8"/><circle cx="150" cy="70" r="8"/><path d="M125 160h50"/>',
      componentes: '<rect x="60" y="80" width="180" height="70" rx="8"/><circle cx="110" cy="115" r="22"/><circle cx="190" cy="115" r="22"/>',
      accesorios: '<path d="M90 120a60 60 0 0 1 120 0v40h-25v-40M90 120v40h25v-40"/>',
      camaras: '<circle cx="150" cy="105" r="45"/><circle cx="150" cy="105" r="18"/><path d="M150 150v35M120 185h60"/>',
      redes: '<rect x="50" y="95" width="200" height="45" rx="6"/><path d="M75 117h10M100 117h10M125 117h10M150 117h10M175 117h10"/>',
    };
    // svg compone el fondo y el icono de la categoría en una única imagen SVG.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 225"><rect width="300" height="225" fill="#F1F5F9"/>' +
      '<g fill="none" stroke="#94A3B8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
      (icons[category] || icons.accesorios) + '</g></svg>';
    // Se devuelve el SVG codificado como una URL que puede asignarse directamente a img.src.
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };


  /*DATOS TEMPORALES — SOLO PARA LA ETAPA 1 (diseño)
     Se reemplazan por el inventario de OneDrive en la etapa 3.*/
  // SampleOutletSource simula una fuente de datos para probar el diseño sin depender del servidor.
  class SampleOutletSource {
    // load obtiene la lista temporal de productos de ejemplo.
    async load() {
      // sample contiene registros representativos con los mismos campos que usarán los datos reales.
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
      // Se añade el campo imagen vacío para que el renderizado use la imagen de respaldo.
      return sample.map((p) => ({ ...p, imagen: '' }));
    }
  }


  /*Datos reales — Excel de OneDrive a través del servidor Node.js
     El navegador NUNCA ve rutas del sistema, claves ni tokens: solo
     consulta tu servidor.*/

  /* Nombres de columna aceptados para cada dato (en el orden en que se buscan).
     Si tu Excel usa otro nombre, agrégalo aquí. */
  // COLUMNAS relaciona cada campo interno con los posibles encabezados que puede tener el Excel.
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

  // ApiOutletSource obtiene y adapta los productos entregados por el endpoint del servidor Node.js.
  class ApiOutletSource {
    // constructor guarda la configuración y construye la URL completa del servicio de productos.
    constructor(config) {
      this.config = config;
      this.url = config.SERVER_URL + config.PRODUCTS_PATH;
    }

    // load solicita los datos, aplica un tiempo máximo, valida la respuesta y transforma cada fila.
    async load() {
      // controller permite cancelar la solicitud si supera el tiempo establecido.
      const controller = new AbortController();
      // timer activa la cancelación automática de la solicitud cuando vence REQUEST_TIMEOUT_MS.
      const timer = setTimeout(() => controller.abort(), this.config.REQUEST_TIMEOUT_MS);
      try {
        // fetch consulta el endpoint sin utilizar datos almacenados en caché.
        const response = await fetch(this.url, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.success === false) {
          throw new Error(data?.mensaje || `HTTP ${response.status}`);
        }
        // filas admite tanto una respuesta que sea un arreglo como una respuesta con propiedad productos.
        const filas = Array.isArray(data) ? data : (data.productos || []);
        return filas.map((fila) => this.mapRow(fila)).filter(Boolean);
      } finally {
        clearTimeout(timer);
      }
    }

    // mapRow convierte una fila con nombres de columnas del Excel en el modelo interno del catálogo.
    /** Convierte una fila del Excel al formato que usan las tarjetas */
    mapRow(fila) {
      // get busca un campo usando todos los nombres de columna permitidos para ese dato.
      const get = (campo) => ApiOutletSource.pick(fila, COLUMNAS[campo]);

      // Filas marcadas como no visibles (Activo = No / Falso / 0)
      const activo = get('activo');
      if (activo !== undefined && /^(no|false|falso|0|n)$/i.test(String(activo).trim())) return null;

      // stockValor conserva el valor original para distinguir entre cero, vacío y ausencia de columna.
      const stockValor = get('stock');
      // El objeto retornado contiene la estructura uniforme que consumen las tarjetas y la ventana modal.
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
    // imageUrl transforma el nombre de una imagen en una URL pública del servidor o conserva una URL externa.
    imageUrl(valor) {
      const archivo = String(valor || '').trim();
      if (!archivo) return '';
      if (/^https?:\/\//i.test(archivo)) return archivo;               // ya es un enlace completo
      const nombre = archivo.split(/[\\/]/).pop();                      // solo el nombre del archivo
      return this.config.SERVER_URL + this.config.IMAGES_PATH + encodeURIComponent(nombre);
    }

    /** Busca una columna sin importar mayúsculas, tildes ni espacios */
    // pick localiza el primer encabezado equivalente, ignorando mayúsculas, tildes, espacios y guiones.
    static pick(fila, nombres) {
      // limpiar prepara las claves para compararlas aunque el Excel use formatos diferentes.
      const limpiar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '');
      const claves = Object.keys(fila);
      for (const nombre of nombres) {
        const clave = claves.find((k) => limpiar(k) === limpiar(nombre));
        if (clave !== undefined && fila[clave] !== null && fila[clave] !== '') return fila[clave];
      }
      return undefined;
    }

    /** 196000 · "₡196.000" · "196,000" → 196000 */
    // toNumber extrae los dígitos de precios o cantidades y los convierte a un número entero.
    static toNumber(valor) {
      if (typeof valor === 'number') return Math.round(valor);
      const digitos = String(valor ?? '').replace(/[^\d]/g, '');
      return digitos ? Number(digitos) : 0;
    }
  }


  /* ProductModal — ventana "Ver detalles"*/
  // ProductModal administra la ventana de detalles de un producto y sus acciones asociadas.
  class ProductModal {
    // constructor enlaza el elemento dialog, su contenido y los eventos de apertura/cierre.
    constructor(dialog, config) {
      // dialog es el elemento HTML que funciona como ventana modal.
      this.dialog = dialog;
      // body es el contenedor donde se inserta dinámicamente el contenido del producto.
      this.body = dialog.querySelector('[data-pcwo-modal-body]');
      this.config = config;
      // lastFocus permite devolver el foco al elemento que abrió la ventana.
      this.lastFocus = null;

      dialog.querySelector('[data-pcwo-close]')?.addEventListener('click', () => this.close());
      // Clic fuera de la ventana: cerrar
      dialog.addEventListener('click', (e) => { if (e.target === dialog) this.close(); });
      dialog.addEventListener('close', () => this.lastFocus?.focus());
    }

    // open prepara y muestra los detalles del producto seleccionado.
    open(product) {
      this.lastFocus = document.activeElement;
      this.body.replaceChildren(this.build(product));
      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
    }

    // close cierra la ventana usando la API de dialog cuando está disponible.
    close() {
      if (typeof this.dialog.close === 'function') this.dialog.close();
      else this.dialog.removeAttribute('open');
    }

    // whatsappLink construye un enlace de consulta con el producto y su precio para WhatsApp.
    whatsappLink(p) {
      const number = String(this.config.WHATSAPP_NUMBER || '').replace(/\D/g, '');
      if (number.length < 8) return '';
      const text = `Hola PCW, me interesa el producto del Outlet: ${p.nombre}` +
        (p.marca ? ` (${p.marca})` : '') + ` a ${formatCRC(p.precioOferta)} [código ${p.id}]. ¿Está disponible?`;
      return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }

    // build crea la estructura visual del modal: imagen/media, información, precios, stock, especificaciones y CTA.
    // media agrupa la imagen principal y la insignia de descuento del producto.
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

      // info agrupa la categoría, el título, la descripción, los precios, el stock y las especificaciones.
      const info = document.createElement('div');
      info.className = 'pcwo-modal__info';
      // La plantilla HTML define los elementos internos que luego se completan con textContent.
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

      // specs es la lista donde se muestran marca, código y unidades disponibles cuando existen.
      const specs = info.querySelector('.pcwo-modal__specs');
      [['Marca', p.marca], ['Código', p.id], ['Unidades disponibles', p.stock]].forEach(([label, value]) => {
        if (value === undefined || value === null || value === '') return;
        const li = document.createElement('li');
        li.innerHTML = '<span></span><strong></strong>';
        li.firstChild.textContent = label;
        li.lastChild.textContent = value;
        specs.append(li);
      });

      // cta representa el enlace de contacto; se elimina si no puede construirse una URL válida.
      const cta = info.querySelector('.pcwo-modal__cta');
      const link = this.whatsappLink(p);
      if (link) cta.href = link; else cta.remove();

      // El fragmento reúne las dos grandes secciones del modal y las inserta como una sola operación.
      wrap.append(media, info);
      return wrap;
    }
  }


  /* OutletCatalog — tarjetas, filtros, búsqueda, orden y sincronización*/
  // OutletCatalog coordina el estado, los eventos, la carga, los filtros y el renderizado del catálogo.
  class OutletCatalog {
    // constructor recibe el contenedor del catálogo, la fuente de datos y la configuración general.
    constructor(root, source, config) {
      // root es el elemento principal de la sección #outlet.
      this.root = root;
      // source abstrae si los datos vienen del ejemplo temporal o de la API.
      this.source = source;
      this.config = config;
      // products almacena los productos normalizados y visibles en el catálogo.
      this.products = [];
      // signature identifica la última respuesta dibujada para evitar renderizados innecesarios.
      this.signature = '';
      // filter guarda la categoría seleccionada por el usuario.
      this.filter = 'todos';
      // query guarda el texto normalizado introducido en el buscador.
      this.query = '';
      // sort indica el criterio actual de ordenamiento.
      this.sort = 'recientes';
      // timer controla la sincronización automática periódica con la API.
      this.timer = null;
      // searchTimer controla el retraso de búsqueda para no renderizar en cada pulsación.
      this.searchTimer = null;

      // els centraliza las referencias a todos los elementos HTML que utiliza el catálogo.
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

      // dialog busca la ventana modal declarada dentro de la sección del catálogo.
      const dialog = root.querySelector('[data-pcwo-modal]');
      this.modal = dialog ? new ProductModal(dialog, config) : null;
    }

    // init prepara imágenes y eventos, muestra esqueletos, carga datos y activa la sincronización.
    async init() {
      if (!this.els.grid) return console.error('[Outlet PCW] Falta [data-pcwo-grid] en el HTML.');
      this.setupBannerImage();
      this.bindEvents();
      this.renderSkeletons(4);
      await this.sync();
      this.startAutoSync();
    }

    /* --- Imagen del banner: si no existe, se oculta --- */
    // setupBannerImage oculta el contenedor del banner cuando la imagen no existe o no puede cargarse.
    setupBannerImage() {
      const img = this.els.bannerImg;
      if (!img) return;
      // hide aplica la clase visual que representa un banner vacío.
      const hide = () => img.parentElement.classList.add('is-empty');
      if (img.complete && img.naturalWidth === 0) hide();
      img.addEventListener('error', hide, { once: true });
    }

    /* --- Eventos --- */
    // bindEvents conecta botones, buscador, selector de orden, reintento, modal y cambios de visibilidad.
    bindEvents() {
      // Cada botón de categoría actualiza el filtro al recibir un clic.
      this.els.filters.forEach((btn) =>
        btn.addEventListener('click', () => this.setFilter(btn.dataset.pcwoFilter)));

      // El buscador espera unos milisegundos antes de aplicar el texto y volver a dibujar.
      this.els.search?.addEventListener('input', (e) => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.query = normalizeText(e.target.value.trim());
          this.render();
        }, this.config.SEARCH_DELAY_MS);
      });

      // El selector de orden actualiza el criterio y vuelve a renderizar los productos.
      this.els.sort?.addEventListener('change', (e) => {
        this.sort = e.target.value;
        this.render();
      });

      // El botón de reintento vuelve a solicitar los datos después de un error.
      this.els.retry?.addEventListener('click', () => this.sync());

      // "Ver detalles" (delegación: sirve para las tarjetas creadas después)
      // La delegación de eventos permite abrir detalles de tarjetas creadas dinámicamente.
      this.els.grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pcwo-details]');
        if (!btn || !this.modal) return;
        const product = this.products.find((p) => p.id === btn.dataset.pcwoDetails);
        if (product) this.modal.open(product);
      });

      // La sincronización automática se detiene cuando la pestaña queda oculta y se reanuda al volver.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stopAutoSync(); else this.startAutoSync();
      });
    }

    /* --- Datos --- */
    // sync carga los datos, los normaliza, elimina agotados, detecta cambios y actualiza la vista.
    async sync() {
      try {
        // raw contiene los registros recibidos desde la fuente configurada.
        const raw = await this.source.load();
        // products conserva únicamente productos válidos y con existencias, o con stock desconocido.
        const products = raw.map((p) => this.normalize(p)).filter((p) => p && (p.stock === null || p.stock > 0));
        // signature serializa el resultado para comparar si hubo cambios desde la última carga.
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

    // normalize valida y convierte los campos externos al formato común usado por toda la interfaz.
    normalize(p) {
      if (!p || !p.nombre) return null;
      // precioOriginal representa el precio anterior o regular del producto.
      const precioOriginal = Number(p.precioOriginal) || 0;
      // precioOferta representa el precio actual mostrado como oferta.
      const precioOferta = Number(p.precioOferta) || precioOriginal;
      // El objeto retornado reúne los datos listos para filtros, tarjetas y modal.
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

    // startAutoSync inicia consultas periódicas solo en modo API y mientras la página esté visible.
    startAutoSync() {
      if (this.config.SOURCE !== 'api' || this.timer || document.hidden) return;
      this.timer = setInterval(() => this.sync(), this.config.SYNC_INTERVAL_MS);
    }

    // stopAutoSync cancela el intervalo de sincronización automática y libera su referencia.
    stopAutoSync() {
      clearInterval(this.timer);
      this.timer = null;
    }

    /* --- Filtros, búsqueda y orden --- */
    // setFilter actualiza la categoría activa, los estados ARIA de los botones y la lista mostrada.
    setFilter(key) {
      this.filter = key;
      this.els.filters.forEach((btn) => {
        const active = btn.dataset.pcwoFilter === key;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      this.render();
    }

    // visibleProducts calcula la lista filtrada por categoría y texto, y luego la ordena.
    get visibleProducts() {
      // list comienza con todos los productos y se va reduciendo según los criterios seleccionados.
      let list = this.products;
      if (this.filter !== 'todos') list = list.filter((p) => p.categoria === this.filter);
      if (this.query) {
        list = list.filter((p) => normalizeText(`${p.nombre} ${p.marca}`).includes(this.query));
      }
      // sorters contiene las funciones de comparación para cada opción del selector de orden.
      const sorters = {
        recientes: (a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso),
        'precio-asc': (a, b) => a.precioOferta - b.precioOferta,
        'precio-desc': (a, b) => b.precioOferta - a.precioOferta,
        descuento: (a, b) => b.descuento - a.descuento,
      };
      return [...list].sort(sorters[this.sort] || sorters.recientes);
    }

    /* --- Renderizado --- */
    // render decide qué mensaje mostrar y genera las tarjetas de los productos visibles.
    render() {
      if (!this.products.length) return this.showMessage(MESSAGES.empty, false);

      const list = this.visibleProducts;
      if (!list.length) return this.showMessage(MESSAGES.noResults, false);

      this.hideMessage();
      // fragment agrupa las tarjetas fuera del DOM para insertarlas de forma eficiente.
      const fragment = document.createDocumentFragment();
      list.forEach((p, i) => fragment.append(this.buildCard(p, i)));
      this.els.grid.replaceChildren(fragment);

      if (this.els.status) {
        this.els.status.textContent = list.length === 1 ? '1 producto en oferta' : `${list.length} productos en oferta`;
      }
    }

    // buildCard construye una tarjeta completa: contenedor li, media, imagen, precios, stock y botón.
    buildCard(p, index) {
      // li es el elemento raíz de cada producto dentro de la lista del catálogo.
      const li = document.createElement('li');
      li.className = 'pcwo-product';
      li.style.animationDelay = `${Math.min(index, 8) * 50}ms`;
      // La plantilla divide la tarjeta en media (imagen) y body (información y acción).
      // El div pcwo-product__media contiene la imagen y la insignia de descuento.
      // El div pcwo-product__body contiene categoría, nombre, precios, stock y botón de detalles.
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
      // img representa la imagen del producto y usa un dibujo genérico como respaldo.
      const img = li.querySelector('img');
      img.src = p.imagen || placeholderImage(p.categoria);
      img.alt = p.nombre;
      img.addEventListener('error', () => { img.src = placeholderImage(p.categoria); }, { once: true });

      // Etiqueta de descuento
      // La insignia se crea solo cuando existe un porcentaje de descuento positivo.
      if (p.descuento > 0) {
        const badge = document.createElement('span');
        badge.className = 'pcwo-product__badge';
        badge.textContent = `-${p.descuento}%`;
        badge.setAttribute('aria-label', `${p.descuento}% de descuento`);
        li.querySelector('.pcwo-product__media').prepend(badge);
      }

      // Se completan los textos de categoría y nombre sin interpretar contenido externo como HTML.
      li.querySelector('.pcwo-product__category').textContent = CATEGORY_LABELS[p.categoria] || p.categoriaTexto || p.categoria;
      li.querySelector('.pcwo-product__name').textContent = p.nombre;

      // old muestra el precio anterior únicamente cuando el producto tiene descuento.
      const old = li.querySelector('.pcwo-product__old');
      if (p.descuento > 0) {
        old.textContent = formatCRC(p.precioOriginal);
        old.setAttribute('aria-label', `Precio anterior ${formatCRC(p.precioOriginal)}`);
      } else {
        old.remove();
      }
      li.querySelector('.pcwo-product__price').textContent = formatCRC(p.precioOferta);

      // fillStock aplica el mensaje y la clase visual correspondientes al inventario.
      OutletCatalog.fillStock(li.querySelector('.pcwo-product__stock'), p, this.config);

      const btn = li.querySelector('.pcwo-product__btn');
      btn.dataset.pcwoDetails = p.id;
      btn.setAttribute('aria-label', `Ver detalles de ${p.nombre}`);
      return li;
    }

    // fillStock indica si hay stock normal o si quedan pocas unidades según LOW_STOCK.
    static fillStock(el, p, config) {
      const low = p.stock !== null && p.stock <= config.LOW_STOCK;
      el.textContent = low ? 'Últimas unidades' : 'En stock';
      el.classList.toggle('pcwo-product__stock--ultimas', low);
    }

    // renderSkeletons pinta tarjetas provisionales mientras se espera la respuesta de datos.
    renderSkeletons(count) {
      // card es la plantilla visual de una tarjeta de carga, sin datos reales ni interacción.
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

    // showMessage limpia la cuadrícula, oculta los productos y presenta un mensaje opcionalmente reintentable.
    showMessage(text, withRetry) {
      this.els.grid.replaceChildren();
      this.els.grid.hidden = true;
      if (this.els.emptyText) this.els.emptyText.textContent = text;
      if (this.els.retry) this.els.retry.hidden = !withRetry;
      if (this.els.empty) this.els.empty.hidden = false;
      if (this.els.status) this.els.status.textContent = text;
    }

    // hideMessage vuelve a mostrar la cuadrícula y oculta el estado vacío o de error.
    hideMessage() {
      this.els.grid.hidden = false;
      if (this.els.empty) this.els.empty.hidden = true;
    }
  }


  /*  ARRANQUE  */
  // El arranque espera a que exista el DOM, localiza #outlet, elige la fuente y crea el catálogo.
  document.addEventListener('DOMContentLoaded', () => {
    // root es la sección HTML que contiene todos los elementos del catálogo Outlet.
    const root = document.getElementById('outlet');
    if (!root) return;
    // source selecciona entre la API real y los datos de ejemplo según CONFIG.SOURCE.
    const source = CONFIG.SOURCE === 'api'
      ? new ApiOutletSource(CONFIG)
      : new SampleOutletSource();
    // Se instancia el controlador y se inicia toda la carga y configuración de la interfaz.
    new OutletCatalog(root, source, CONFIG).init();
  });
})();