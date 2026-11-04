/*PCW — JS/script.js
   Interacciones generales del sitio, organizadas en clases.

   Clases:
     MobileMenu      → menú hamburguesa (abrir, cerrar, Escape)
     HeaderScroll    → sombra del header y botón "volver arriba"
     SmoothScroll    → desplazamiento suave al usar enlaces #seccion
     ActiveNav       → marca en el menú la sección visible
     RevealOnScroll  → animación de entrada de los elementos .reveal
     ServiceCards    → tarjetas de Servicios (toque y teclado)
     ImageFallbacks  → fondo azul cuando una imagen no carga
     FooterYear      → año actual en el copyright
     App             → crea e inicia todo lo anterior*/

  // IIFE que encapsula las interacciones del sitio para evitar contaminar el ámbito global.
(() => {
  'use strict';

  // $ busca el primer elemento que coincide con un selector CSS dentro del ámbito indicado.
  const $ = (selector, scope = document) => scope.querySelector(selector);
  // $$ obtiene todos los elementos coincidentes y los convierte en un arreglo para poder iterarlos.
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  // prefersReducedMotion detecta si el usuario solicitó reducir las animaciones del sistema.
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /*  Menú hamburguesa */
  // MobileMenu controla el menú hamburguesa en pantallas pequeñas.
  class MobileMenu {
    // constructor localiza el botón del menú y el elemento de navegación mediante sus selectores.
    constructor(buttonSelector = '#hamburger', navSelector = '#nav') {
      // button representa el control que abre o cierra el menú.
      this.button = $(buttonSelector);
      // nav representa el contenedor HTML de los enlaces de navegación.
      this.nav = $(navSelector);
    }

    // isOpen informa si el atributo aria-expanded indica que el menú está abierto.
    get isOpen() {
      return this.button?.getAttribute('aria-expanded') === 'true';
    }

    // init registra los eventos de clic, selección de enlaces, Escape y cambio de tamaño.
    init() {
      if (!this.button || !this.nav) return;

      // El botón alterna el estado abierto/cerrado del menú al recibir un clic.
      this.button.addEventListener('click', () => this.setOpen(!this.isOpen));

      // Cerrar al elegir un enlace del menú
      // Cada enlace cierra el menú después de seleccionar una sección.
      $$('a', this.nav).forEach((link) => link.addEventListener('click', () => this.setOpen(false)));

      // Cerrar con Escape
      // Este listener permite cerrar el menú con la tecla Escape y devuelve el foco al botón.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.setOpen(false);
          this.button.focus();
        }
      });

      // Cerrar si la pantalla se agranda a tamaño computadora
      // En una pantalla de escritorio el menú móvil se cierra automáticamente.
      window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
        if (e.matches) this.setOpen(false);
      });
    }

    // setOpen actualiza el estado accesible, las etiquetas y las clases visuales del menú.
    setOpen(open) {
      // aria-expanded comunica a lectores de pantalla si el menú está abierto.
      this.button.setAttribute('aria-expanded', String(open));
      this.button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      // is-open muestra u oculta visualmente la navegación mediante CSS.
      this.nav.classList.toggle('is-open', open);
      // menu-open permite aplicar estilos al cuerpo mientras el menú está desplegado.
      document.body.classList.toggle('menu-open', open);
    }
  }


  /* Header al hacer scroll + botón "volver arriba" */
  // HeaderScroll gestiona la apariencia del encabezado y el botón para volver al inicio.
  class HeaderScroll {
    // constructor obtiene las referencias del encabezado, el botón y el estado de actualización.
    constructor() {
      // header es el elemento superior cuya sombra cambia durante el desplazamiento.
      this.header = $('#header');
      // toTop es el botón que permite regresar al inicio de la página.
      this.toTop = $('#toTop');
      // ticking evita solicitar varias actualizaciones de animación al mismo tiempo.
      this.ticking = false;
    }

    // init conecta el evento de scroll y el clic del botón, y realiza una actualización inicial.
    init() {
      window.addEventListener('scroll', () => this.onScroll(), { passive: true });
      this.toTop?.addEventListener('click', () => this.scrollToTop());
      this.update();
    }

    // onScroll limita las actualizaciones del scroll a un ciclo de animación del navegador.
    onScroll() {
      if (this.ticking) return;
      this.ticking = true;
      requestAnimationFrame(() => this.update());
    }

    // update calcula la posición actual y ajusta las clases del header y del botón.
    update() {
      // y contiene la posición vertical actual de la ventana.
      const y = window.scrollY;
      this.header?.classList.toggle('is-scrolled', y > 40);
      this.toTop?.classList.toggle('is-visible', y > 600);
      this.ticking = false;
    }

    // scrollToTop desplaza la página al inicio respetando la preferencia de movimiento reducido.
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      // start representa la sección inicial y recibe el foco para mejorar la accesibilidad.
      const start = $('#inicio');
      if (start) {
        start.setAttribute('tabindex', '-1');
        start.focus({ preventScroll: true });
      }
    }
  }


  /*Desplazamiento suave para enlaces #seccion */
  // SmoothScroll transforma los enlaces internos #seccion en desplazamientos suaves.
  class SmoothScroll {
    // init registra un listener global para interceptar clics en enlaces internos.
    init() {
      document.addEventListener('click', (e) => this.onClick(e));
    }

    // onClick valida el enlace, calcula la posición de destino y actualiza el historial.
    onClick(e) {
      if (e.defaultPrevented) return;              // otro script ya manejó el clic (ej. el Outlet)
      // link es el enlace cuyo href comienza con # y apunta a una sección de la misma página.
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      // id conserva el identificador de la sección de destino.
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      // target es el elemento HTML al que debe desplazarse la página.
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      // headerHeight permite compensar la altura del encabezado fijo.
      const headerHeight = $('#header')?.offsetHeight ?? 0;
      // top es la posición final calculada para que la sección no quede oculta bajo el header.
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight + 1;
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      history.pushState(null, '', id);
    }
  }


  /* Menú activo según la sección visible */
  // ActiveNav marca en el menú la sección que actualmente se encuentra visible.
  class ActiveNav {
    // constructor recopila todos los enlaces de navegación que pueden recibir la clase activa.
    constructor() {
      // links contiene los enlaces .nav__link del menú.
      this.links = $$('.nav__link');
    }

    // init crea un IntersectionObserver y relaciona cada enlace con su sección correspondiente.
    init() {
      if (!('IntersectionObserver' in window)) return;
      // sections contiene las secciones existentes a las que apuntan los enlaces.
      const sections = this.links
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

      // observer detecta cuándo una sección entra en la zona visible definida por rootMargin.
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.setActive(entry.target.id);
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      sections.forEach((section) => observer.observe(section));
    }

    // setActive actualiza la clase visual y aria-current del enlace correspondiente.
    setActive(id) {
      // Cada enlace se compara con el id de la sección que acaba de entrar en pantalla.
      this.links.forEach((link) => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }


  /* Animación al aparecer en pantalla (.reveal) */
  // RevealOnScroll muestra gradualmente los elementos que tienen la clase .reveal.
  class RevealOnScroll {
    // init obtiene los elementos animables y decide si debe observarlos.
    init() {
      // items reúne los elementos que se animarán al entrar en el viewport.
      const items = $$('.reveal');

      // Si el usuario reduce el movimiento o el navegador no soporta el observer, se muestran de inmediato.
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        items.forEach((el) => el.classList.add('is-visible'));
        return;
      }

      // observer agrega is-visible cuando un elemento aparece y deja de observarlo después.
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

      // Cada elemento .reveal queda registrado para detectar su entrada en pantalla.
      items.forEach((el) => observer.observe(el));
    }
  }


  /*  Tarjetas de Servicios */
  // ServiceCards agrega interacción táctil y de teclado a las tarjetas de servicios.
  class ServiceCards {
    // init recorre todas las tarjetas y conecta sus eventos de interacción.
    init() {
      // Cada elemento .card representa una tarjeta de servicio visible en la página.
      $$('.card').forEach((card) => {
        // link es el enlace o flecha que conduce a la acción de la tarjeta.
        const link = $('.card__arrow', card);

        // Toque en celular: resalta la tarjeta tocada
        // touchstart marca la tarjeta tocada y desactiva las demás tarjetas activas.
        card.addEventListener('touchstart', () => {
          $$('.card.is-active').forEach((c) => c !== card && c.classList.remove('is-active'));
          card.classList.add('is-active');
        }, { passive: true });

        // Enter sobre la tarjeta enfocada abre su enlace de WhatsApp
        // keydown permite activar el enlace con Enter cuando la tarjeta tiene el foco.
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target === card && link) link.click();
        });
      });
    }
  }


  /*  Imágenes que no cargan */
  // ImageFallbacks aplica un estado visual cuando una imagen del sitio no puede cargarse.
  class ImageFallbacks {
    // init revisa las imágenes existentes y registra su evento de error.
    init() {
      // Las imágenes del Outlet manejan su propio respaldo (JS/outlet.js)
      // Se excluyen las imágenes de #outlet porque outlet.js administra sus propios respaldos.
      $$('img').filter((img) => !img.closest('#outlet')).forEach((img) => {
      // Una imagen ya fallida se marca de inmediato si tiene una fuente configurada.
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) this.markMissing(img);
        img.addEventListener('error', () => this.markMissing(img), { once: true });
      });
    }

    // markMissing agrega una clase al contenedor de la imagen para mostrar el fondo alternativo.
    markMissing(img) {
      img.parentElement?.classList.add('img-missing');
    }
  }


  /*  Año del copyright */
  // FooterYear mantiene actualizado el año mostrado en el copyright del pie de página.
  class FooterYear {
    // init localiza el elemento del año y escribe el año actual del sistema.
    init() {
      // year es el elemento HTML donde se inserta el año del copyright.
      const year = $('#year');
      if (year) year.textContent = new Date().getFullYear();
    }
  }


  /*  Aplicación */
  // App coordina la creación e inicialización de todos los módulos generales del sitio.
  class App {
    // constructor crea las instancias de cada módulo en el orden en que deben inicializarse.
    constructor() {
      // modules contiene todos los controladores independientes de la interfaz.
      this.modules = [
        new ImageFallbacks(),
        new MobileMenu(),
        new HeaderScroll(),
        new SmoothScroll(),
        new ActiveNav(),
        new RevealOnScroll(),
        new ServiceCards(),
        new FooterYear(),
      ];
    }

    // init ejecuta cada módulo y aísla sus errores para que uno no detenga a los demás.
    init() {
      // Se recorren los módulos y se llama a su método init común.
      this.modules.forEach((module) => {
        // try permite inicializar el módulo dentro de un bloque protegido.
        try {
          module.init();
          // error contiene la excepción producida por el módulo que no pudo inicializarse.
        } catch (error) {
          // Un módulo con error no detiene a los demás
          console.error(`[PCW] Error en ${module.constructor.name}:`, error);
        }
      });
    }
  }

  // Cuando el DOM está listo, se crea la aplicación y se inicializan todos sus módulos.
  document.addEventListener('DOMContentLoaded', () => new App().init());
})();
