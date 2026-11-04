/*PCW — JS/nosotros.js
   Módulo de control de la ventana modal "¿Quiénes somos?"
   
   ARQUITECTURA Y PRINCIPIOS:
   - Patrón de Diseño: Programación Orientada a Objetos (Clase AboutModal).
   - Encapsulamiento: Función Autoejecutable (IIFE) en modo estricto ('use strict') 
     para evitar contaminación del ámbito global (window).
   - Accesibilidad (A11y): Usa la API nativa <dialog>, gestiona el atrapamiento de 
     foco (focus trap) y restaura el foco al botón que originó la apertura.
   - Preservación de Estado: Guarda y restaura la posición exacta del scroll vertical (scrollY) 
     al abrir y cerrar la ventana, bloqueando el scroll de fondo con una clase CSS.*/

(() => {
  'use strict';

  /* CLASE PRINCIPAL: AboutModal
   * Encapsula toda la lógica de control, eventos y accesibilidad del modal.*/
  class AboutModal {
    /**
     * CONSTRUCTOR: Inicializa las propiedades de la instancia.
     * 
     * @param {HTMLDialogElement} dialog - Elemento <dialog id="pcwn-modal"> del DOM.
     * @param {HTMLElement[]} openButtons - Arreglo con los botones que activan el modal ([data-pcwn-open]).
     */
    constructor(dialog, openButtons) {
      // VARIABLE / PROPIEDAD: Referencia directa al nodo nativo <dialog>
      this.dialog = dialog;

      // VARIABLE / PROPIEDAD: Lista de botones disparadores que abren el modal
      this.openButtons = openButtons;

      // VARIABLE / PROPIEDAD: Referencia al <div> contenedor interno (.pcwn-modal__box).
      // Se utiliza para distinguir clics en el contenido de clics en el fondo oscuro (backdrop).
      this.box = dialog.querySelector('.pcwn-modal__box');

      // VARIABLE / PROPIEDAD: Almacena el último elemento enfocado antes de abrir el modal
      // para devolverle el foco al cerrar (requisito de accesibilidad WCAG).
      this.lastFocus = null;

      // VARIABLE / PROPIEDAD: Guarda la posición en píxeles del scroll de la página (window.scrollY)
      // para evitar saltos de pantalla al cerrar la ventana.
      this.scrollY = 0;
    }

    /**
     * FUNCIÓN / MÉTODO: init()
     * Registra y vincula todos los escuchadores de eventos (Event Listeners) necesarios
     * para la apertura, cierre y accesibilidad por teclado y ratón.
     */
    init() {
      // 1. EVENTO APERTURA: Escucha el clic en cada botón con el atributo [data-pcwn-open]
      this.openButtons.forEach((btn) => 
        btn.addEventListener('click', () => this.open(btn))
      );

      // 2. EVENTO CIERRE MANUAL: Escucha el clic en los botones con el atributo [data-pcwn-close] (botón X)
      this.dialog.querySelectorAll('[data-pcwn-close]').forEach((btn) =>
        btn.addEventListener('click', () => this.close())
      );

      // 3. EVENTO CLIC EN EL FONDO (BACKDROP):
      // El elemento <dialog> cubre toda la pantalla. Si el clic no ocurre dentro del
      // <div> (.pcwn-modal__box), significa que el usuario hizo clic en la zona oscura exterior.
      this.dialog.addEventListener('click', (e) => {
        // e.target: elemento exacto donde se hizo clic.
        // Si this.box no contiene a e.target, se procede a cerrar el modal.
        if (!this.box.contains(e.target)) this.close();
      });

      // 4. EVENTO TECLA ESCAPE ('cancel'):
      // El navegador dispara el evento 'cancel' en el <dialog> cuando se presiona la tecla Escape.
      // Se previene el comportamiento por defecto (e.preventDefault()) para canalizar
      // el cierre ordenadamente a través de this.close() y ejecutar la limpieza.
      this.dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        this.close();
      });

      // 5. EVENTO DE CIERRE NATIVO ('close'):
      // Cuando el diálogo se cierra (por cualquier vía), se ejecuta el método de restauración.
      this.dialog.addEventListener('close', () => this.restore());
    }

    /**
     * FUNCIÓN / MÉTODO: open(trigger)
     * Despliega la ventana modal, congela el scroll del documento y posiciona el foco.
     * 
     * @param {HTMLElement} trigger - El botón que disparó la apertura del modal.
     */
    open(trigger) {
      // Cláusula de guarda: Si el diálogo ya está abierto, no hace nada para evitar llamadas redundantes.
      if (this.dialog.open) return;

      // Guarda el elemento que tenía el foco activo (o el botón recibido)
      this.lastFocus = trigger || document.activeElement;

      // Guarda la posición actual de desplazamiento vertical de la ventana
      this.scrollY = window.scrollY;

      // Bloquea el scroll de la página de fondo añadiendo la clase de bloqueo al <html>
      document.documentElement.classList.add('pcwn-lock');

      // Muestra el diálogo en la capa superior nativa (top layer) con backdrop y foco atrapado
      this.dialog.showModal();

      // Mueve el foco del teclado inmediatamente al botón de cierre (X) para facilidad de uso
      this.dialog.querySelector('.pcwn-modal__close')?.focus();
    }

    /**
     * FUNCIÓN / MÉTODO: close()
     * Cierra el diálogo nativo invocando el método nativo .close() de la API HTMLDialogElement.
     */
    close() {
      // Cláusula de guarda: Solo intenta cerrar si el modal se encuentra actualmente abierto
      if (this.dialog.open) this.dialog.close();
    }

    /**
     * FUNCIÓN / MÉTODO: restore()
     * Limpia las modificaciones aplicadas al abrir:
     * 1. Desbloquea el scroll de la página.
     * 2. Restaura la posición original de la pantalla.
     * 3. Devuelve el foco al elemento que abrió el modal.
     */
    restore() {
      // 1. Remueve la clase de bloqueo del <html>, permitiendo el desplazamiento normal
      document.documentElement.classList.remove('pcwn-lock');

      // 2. Regresa la pantalla exactamente a la coordenada vertical donde estaba el usuario, de forma instantánea
      window.scrollTo({ top: this.scrollY, behavior: 'instant' });

      // 3. Devuelve el foco al botón disparador original (preventScroll: true evita saltos bruscos de scroll)
      this.lastFocus?.focus({ preventScroll: true });
    }
  }

  /*SEGMENTO: INICIALIZACIÓN Y ARRANQUE DEL MÓDULO
    Se ejecuta una vez que el árbol DOM esté completamente cargado.
   */
  document.addEventListener('DOMContentLoaded', () => {
    // VARIABLE LOCAL (dialog): Busca el elemento <dialog> por su identificador único
    const dialog = document.getElementById('pcwn-modal');

    // VARIABLE LOCAL (buttons): Selecciona todos los botones disparadores y los convierte en un Array iterable
    const buttons = [...document.querySelectorAll('[data-pcwn-open]')];

    // Cláusula de guarda y validación de compatibilidad:
    // Si no existe el diálogo, no hay botones disparadores, o el navegador no soporta showModal(), cancela la ejecución
    if (!dialog || !buttons.length || typeof dialog.showModal !== 'function') return;

    // Crea una nueva instancia de la clase AboutModal e inicia los escuchadores de eventos
    new AboutModal(dialog, buttons).init();
  });
})();