/* PCW — JS/hero-carousel.js
   Carrusel automático de banners en la sección Inicio (clase HeroCarousel).

   - Cambia de banner cada 6 s con transición fade.
   - Flechas, indicadores, botón de pausa, swipe táctil y teclado.
   - Avanza solo SIEMPRE, salvo cuando:
       · el visitante presiona el botón de pausa,
       · navega con el teclado (Tab) dentro del carrusel,
       · la pestaña del navegador no está visible.
   - Pasar el mouse por encima NO lo detiene.
   - Con "reducir movimiento" (Windows: Efectos de animación apagados)
     sigue cambiando, pero sin animaciones (lo controla el CSS).*/

/* Función autoejecutable (IIFE): aísla las variables y clases del ámbito global
   para evitar conflictos con otros scripts de la página */

(() => {
  /* Activa el modo estricto para prevenir errores comunes y asegurar un código más limpio y seguro */
  'use strict';

  /**
   * Clase principal que encapsula toda la funcionalidad del carrusel del Hero
   */
  class HeroCarousel {
    /* Constantes estáticas compartidas por todas las instancias */
    static DELAY_MS = 6000;           // tiempo entre banners (6 s)
    static SWIPE_THRESHOLD = 50;      // px mínimos para considerar swipe

    /**
     * Constructor: Inicializa las referencias a los elementos del DOM y el estado interno
     * @param {HTMLElement} root - Elemento raíz del carrusel (.hero-carousel)
     */
    constructor(root) {
      this.root = root;                                                   // Contenedor principal de la sección
      this.slides = [...root.querySelectorAll('.hero-carousel__slide')];  // Arreglo de todas las diapositivas
      this.dots = [...root.querySelectorAll('.hero-carousel__dot')];      // Arreglo de puntos de paginación
      this.prevBtn = root.querySelector('.hero-carousel__arrow--prev');   // Botón flecha anterior
      this.nextBtn = root.querySelector('.hero-carousel__arrow--next');   // Botón flecha siguiente
      this.pauseBtn = root.querySelector('.hero-carousel__pause');        // Botón de pausar / reanudar
      this.status = root.querySelector('#heroCarouselStatus');            // Región ARIA en vivo para lectores de pantalla

      // Encuentra el índice del banner activo inicial (o 0 por defecto)
      this.current = Math.max(0, this.slides.findIndex((s) => s.classList.contains('is-active')));
      this.timer = null;                 // Identificador del temporizador activo (setTimeout)
      this.focusPaused = false;          // Bandera: pausa mientras se navega con teclado dentro
      this.userStopped = false;          // Bandera: pausa manual con el botón ⏸
      this.touchStart = { x: 0, y: 0 };  // Coordenadas iniciales para medir gestos táctiles (swipe)
    }

    /**
     * Método de inicio: valida requisitos y arranca los eventos y el temporizador
     */
    init() {
      if (this.root.dataset.heroCarouselReady) return;   // Guard: evita iniciarlo dos veces por error
      if (this.slides.length < 2) {
        // Se requieren mínimo 2 banners para que un carrusel tenga sentido
        console.warn('[Hero PCW] Se necesitan al menos 2 banners (.hero-carousel__slide) para el carrusel.');
        return;
      }
      this.root.dataset.heroCarouselReady = 'true';     // Marca el elemento como inicializado
      // Transfiere el tiempo de espera al CSS mediante una variable para sincronizar animaciones
      this.root.style.setProperty('--hero-carousel-delay', `${HeroCarousel.DELAY_MS}ms`);

      this.bindEvents();               // Vincula todos los escuchadores de eventos
      this.render(this.current);       // Dibuja el estado inicial en pantalla
      this.restartTimer();             // Inicia la cuenta regresiva del primer cambio automático
      console.info(`[Hero PCW] Carrusel activo: ${this.slides.length} banners, cambio cada ${HeroCarousel.DELAY_MS / 1000} s.`);
    }

    /* --- Eventos --- */
    /**
     * Registra todos los escuchadores de eventos (clicks, teclado, accesibilidad, visibilidad y táctil)
     */
    bindEvents() {
      // Navegación con flechas (el parámetro true indica que fue una acción manual)
      this.prevBtn?.addEventListener('click', () => this.goTo(this.current - 1, true));
      this.nextBtn?.addEventListener('click', () => this.goTo(this.current + 1, true));
      // Clic en los puntos indicadores (dots)
      this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.goTo(i, true)));
      // Clic en el botón de reproducción / pausa
      this.pauseBtn?.addEventListener('click', () => this.togglePause());

      // Pausa solo al navegar con el TECLADO dentro del carrusel
      // (un clic con el mouse en una flecha no lo detiene)
      this.root.addEventListener('focusin', (e) => {
        // :focus-visible detecta solo navegación por teclado (Tab), ignorando clics de ratón
        if (e.target.matches(':focus-visible')) this.pause();
      });
      this.root.addEventListener('focusout', (e) => {
        // Si el foco sale completamente de los límites del carrusel, reanuda el movimiento
        if (!this.root.contains(e.relatedTarget)) this.resume();
      });

      // API Page Visibility: Si el usuario cambia de pestaña en el navegador, detiene el temporizador
      // para ahorrar batería y recursos; lo reanuda cuando vuelve a ver la pestaña
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { this.stopTimer(); this.updatePausedState(); }
        else this.restartTimer();
      });

      // Control por teclado mediante flechas izquierda y derecha cuando el foco está en el carrusel
      this.root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.goTo(this.current + 1, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.goTo(this.current - 1, true); }
      });

      // Eventos táctiles para dispositivos móviles (pantallas touch)
      this.root.addEventListener('touchstart', (e) => {
        // Registra las coordenadas iniciales donde el usuario tocó la pantalla
        this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true }); // passive: true mejora el rendimiento del scroll vertical
      this.root.addEventListener('touchend', (e) => this.onSwipe(e), { passive: true });
    }

    /**
     * Calcula la distancia del deslizamiento táctil y cambia de diapositiva si supera el umbral
     * @param {TouchEvent} e - Evento touchend
     */
    onSwipe(e) {
      const dx = e.changedTouches[0].clientX - this.touchStart.x; // Desplazamiento horizontal
      const dy = e.changedTouches[0].clientY - this.touchStart.y; // Desplazamiento vertical
      // Verifica que el deslizamiento horizontal supere el umbral (50px) y sea mayor que el vertical
      // para evitar cambiar de banner cuando el usuario solo intentaba hacer scroll vertical hacia abajo
      if (Math.abs(dx) > HeroCarousel.SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        this.goTo(dx < 0 ? this.current + 1 : this.current - 1, true);
      }
    }

    /* --- Mostrar un banner --- */
    /**
     * Actualiza las clases visuales y atributos de accesibilidad para mostrar la diapositiva activa
     * @param {number} index - Índice de la diapositiva que se debe mostrar
     * @param {boolean} announce - Si es true, notifica a los lectores de pantalla
     */
    render(index, announce = false) {
      // Itera por todas las diapositivas
      this.slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('is-active', active);           // Aplica la clase CSS que hace visible el banner
        slide.setAttribute('aria-hidden', String(!active));    // Oculta los inactivos a tecnologías de asistencia
        // inert desactiva completamente el banner inactivo (evita que enlaces o botones ocultos reciban foco con Tab)
        slide.inert = !active;            // los banners ocultos no reciben foco
      });

      // Actualiza el estado visual del indicador de paginación (dot) activo
      this.dots.forEach((dot, i) => {
        if (i === index) dot.setAttribute('aria-current', 'true'); // Marca el dot seleccionado
        else dot.removeAttribute('aria-current');
      });

      // Si fue una acción manual, anuncia el nombre del banner en la región en vivo para lectores de pantalla
      if (announce && this.status) {
        this.status.textContent = this.slides[index].getAttribute('aria-label') || '';
      }
    }

    /**
     * Navega hacia una diapositiva específica con cálculo circular infinito
     * @param {number} index - Índice objetivo (puede ser negativo o mayor al total)
     * @param {boolean} manual - True si fue accionado por el usuario (flechas, dot, swipe o teclado)
     */
    goTo(index, manual = false) {
      // Fórmula de módulo circular: garantiza volver al inicio al llegar al final y viceversa
      const next = (index + this.slides.length) % this.slides.length;
      if (next === this.current) return; // Si ya está en esa diapositiva, no hace nada
      this.current = next;
      // Añade clase que indica que el carrusel ya se movió al menos una vez
      this.root.classList.add('hero-carousel--started');
      this.render(next, manual);         // Muestra la nueva diapositiva
      this.restartTimer();               // Reinicia la cuenta regresiva de 6 segundos
    }

    /* --- Temporizador --- */
    /**
     * Cancela el temporizador activo en memoria
     */
    stopTimer() {
      clearTimeout(this.timer);
      this.timer = null;
    }

    /**
     * Reinicia el ciclo del temporizador automático de 6 segundos
     */
    restartTimer() {
      this.stopTimer();                  // Cancela el anterior para evitar temporizadores dobles
      this.restartProgressBar();         // Reinicia la animación visual de progreso en el dot
      this.updatePausedState();          // Actualiza las clases CSS y atributos ARIA de pausa
      // Si el carrusel está pausado manualmente, por teclado o la pestaña está oculta, no arranca
      if (this.userStopped || this.focusPaused || document.hidden) return;
      // Programa el avance hacia el siguiente banner tras 6000 milisegundos
      this.timer = setTimeout(() => this.goTo(this.current + 1), HeroCarousel.DELAY_MS);
    }

    /**
     * Fuerza al navegador a reiniciar la animación CSS de la barra de progreso en el dot activo
     */
    restartProgressBar() {
      const dot = this.dots[this.current];
      if (!dot) return;
      dot.removeAttribute('aria-current');
      // Truco de reflow: acceder a offsetWidth obliga al motor del navegador a recalcular estilos de inmediato,
      // permitiendo reiniciar la animación CSS desde cero al volver a colocar el atributo
      void dot.offsetWidth;                // reinicia la animación de la barra
      dot.setAttribute('aria-current', 'true');
    }

    /**
     * Pausa temporalmente el carrusel por navegación de teclado
     */
    pause() {
      this.focusPaused = true;
      this.stopTimer();
      this.updatePausedState();
    }

    /**
     * Reanuda el carrusel tras terminar la navegación de teclado
     */
    resume() {
      this.focusPaused = false;
      this.restartTimer();
    }

    /**
     * Alterna la pausa manual del carrusel cuando el usuario presiona el botón ⏸ / ▶
     */
    togglePause() {
      this.userStopped = !this.userStopped; // Invierte el estado booleano
      this.restartTimer();                  // Evalúa y pausa o reanuda según el nuevo estado
    }

    /**
     * Sincroniza las clases CSS del contenedor y los atributos ARIA del botón de pausa
     */
    updatePausedState() {
      // Clases para estilar o pausar animaciones mediante CSS
      this.root.classList.toggle('is-stopped', this.userStopped);
      this.root.classList.toggle('is-paused', this.focusPaused || document.hidden);
      if (!this.pauseBtn) return;
      // Actualiza atributos de accesibilidad en el botón de pausa
      this.pauseBtn.setAttribute('aria-pressed', String(this.userStopped));
      this.pauseBtn.setAttribute('aria-label', this.userStopped ? 'Reproducir carrusel' : 'Pausar carrusel');
    }
  }

  /**
   * Función inicializadora: localiza el carrusel en el DOM y crea la instancia
   */
  const start = () => {
    const root = document.querySelector('.hero-carousel');
    if (root) new HeroCarousel(root).init();
  };

  // Verifica si el documento aún se está parseando o si ya está listo para arrancar
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();