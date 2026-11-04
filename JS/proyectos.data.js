/**
 * proyectos-data.js
 * Datos de proyectos PCW — expuestos en window.PCW_PROYECTOS
 *
 * IMPORTANTE (rutas de imágenes):
 * - Deben coincidir EXACTAMENTE con el nombre del archivo en IMG/,
 *   incluida la extensión. Varios archivos del sitio tienen doble
 *   extensión: CCTV.png.png, hero-network.png.png, ventas.png.png.
 * - Los espacios del nombre se escriben como %20.
 */

window.PCW_PROYECTOS = [
  {
    id: 'CCTV-001',
    categoria: 'cctv',
    titulo: 'Implementación de centro de monitoreo CCTV con visualización simultánea de cámaras de seguridad.',
    resumen: 'Centralización y visualización de múltiples cámaras de seguridad mediante un sistema de monitoreo CCTV, utilizando pantallas de gran formato para supervisar diferentes áreas de las instalaciones.',
    descripcion: 'Infraestructura de videovigilancia compuesta por un centro de monitoreo CCTV, equipado con un sistema de visualización multipantalla que permite supervisar simultáneamente distintas áreas mediante cámaras de seguridad. La instalación presenta un conjunto de pantallas superiores que muestran imágenes provenientes de diferentes puntos de vigilancia, incluyendo accesos, zonas exteriores, áreas recreativas y espacios interiores. Además, dispone de una estación de trabajo informática que puede utilizarse para la administración y supervisión del sistema de seguridad. Esta solución permite centralizar la observación de diferentes sectores desde un mismo espacio, facilitando la supervisión visual y la gestión operativa de la videovigilancia.',
    trabajos: [
      'Integración de cámaras de seguridad en el sistema de monitoreo',
      'Configuración de visualización multipantalla',
      'Implementación de estación de trabajo para administración del sistema'
    ],
    tecnologias: [
      'Sistema de videovigilancia CCTV',
      'Pantallas de gran formato',
      'Estación de trabajo informática'
    ],
    resultado: '',
    imagenes: ['IMG/Instalacion%20de%20CCTV.jpeg', ],
    fecha: '2026-09-12'
  },
  {
    id: 'Redes-001',
    categoria: 'redes',
    titulo: 'Integración de infraestructura de telecomunicaciones, redes LAN y videovigilancia en rack empresarial.',
    resumen: 'Centralización de equipos de telecomunicaciones mediante rack empresarial equipado con switches, paneles de parcheo, sistemas de videovigilancia, distribución de fibra óptica y equipos de respaldo eléctrico.',
    descripcion: 'Infraestructura tecnológica compuesta por un rack de telecomunicaciones de piso, diseñado para centralizar la distribución de redes de datos, sistemas de videovigilancia y equipos de comunicación. El gabinete integra paneles de parcheo para cableado estructurado, switches de red, equipos de videovigilancia Dahua, organizadores horizontales, componentes de fibra óptica y equipos de alimentación y respaldo eléctrico. Esta configuración permite concentrar diferentes servicios tecnológicos en un mismo punto de administración, facilitando la gestión de conexiones, el mantenimiento y la ampliación de la infraestructura de telecomunicaciones.',
    trabajos: [
      'Montaje y organización de equipos en rack de piso',
      'Ponchado y organización en patch panel',
      'Integración de equipos de videovigilancia Dahua.'
    ],
    tecnologias: [
      'Rack de telecomunicaciones de piso',
      'Switches de red',
      'Paneles de parcheo',
      'Sistemas de videovigilancia Dahua',
      'Organizadores horizontales',
      'Componentes de fibra óptica',
      'Equipos de alimentación y respaldo eléctrico'
    ],
    resultado: '',
    imagenes: ['IMG/servidor1.jpeg', 'IMG/servidor2.jpeg'],
    fecha: '2026-10-15'
  },
  {
    id: 'Soporte-001',
    categoria: 'soporte',
    titulo: 'Implementación de gabinete mural de distribución de fibra óptica Panduit.',
    resumen: 'Organización y distribución de conexiones de fibra óptica mediante gabinete mural Panduit, con administración de patch cords y adaptadores ópticos para infraestructura de telecomunicaciones.',
    descripcion: 'Infraestructura de telecomunicaciones compuesta por un gabinete mural de distribución de fibra óptica marca Panduit, diseñado para alojar, proteger y administrar conexiones ópticas. El sistema incorpora organizadores internos, adaptadores de conexión y cables de fibra óptica que permiten centralizar la distribución de enlaces, mantener un orden adecuado del cableado y facilitar las labores de mantenimiento.',
    trabajos: [
      'Instalación y fijación de gabinete mural Panduit',
      'Acomodo y distribución de patch cords ópticos',
      'Conexión y etiquetado de adaptadores de fibra óptica'
    ],
    tecnologias: [
      'Herramientas de diagnóstico',
      'Gabinete mural de distribución de fibra óptica Panduit',
      'Organizadores internos y adaptadores ópticos'
    ],
    resultado: '',
    imagenes: ['IMG/servidor1.jpeg'],
    fecha: '2026-10-05'
  },
  {
    id: 'redes-002',
    categoria: 'redes',
    titulo: 'Organización y distribución de fibra óptica mediante bandeja ODF.',
    resumen: 'Organización de fibras ópticas, distribución de conexiones y administración de empalmes mediante una bandeja de distribución óptica.',
    descripcion: 'Implementación de infraestructura de fibra óptica mediante bandeja de distribución óptica (ODF), con organización de fibras, alojamiento de empalmes por fusión y distribución de conexiones ópticas. El sistema permite centralizar y proteger las terminaciones de fibra, facilitando la administración, identificación y mantenimiento de los enlaces de telecomunicaciones.',
    trabajos: [
      'Organización de fibras ópticas',
      'Alojamiento de empalmes por fusión',
      'Distribución de conexiones ópticas mediante adaptadores y pigtails'
    ],
    tecnologias: [
      'Bandeja de distribución óptica (ODF)',
      'Empalmes por fusión',
      'Adaptadores y pigtails de fibra óptica'
    ],
    resultado: '',
    imagenes: ['IMG/bandeja%20de%20empalme.jpeg'],
    fecha: '2026-09-20'
  },
  {
    id: 'infra-1',
    categoria: 'infraestructura',
    titulo: 'Implementación de rack y equipos de red.',
    resumen: 'Montaje de rack, organización de cableado estructurado y equipos de red.',
    descripcion: 'Implementación de infraestructura de telecomunicaciones mediante una bandeja de distribución de fibra óptica (ODF), equipada con organizadores de empalmes, pigtails y adaptadores ópticos. El sistema permite centralizar las conexiones, proteger las fibras y facilitar la administración de los enlaces de comunicación.',
    trabajos: [
      'Acomodo de rack y equipos de red',
      'Organización de cableado estructurado',
      'Instalación de bandeja de distribución óptica (ODF)'
    ],
    tecnologias: [
      'Pigtails de fibra óptica',
      'Adaptadores ópticos',
      'Organizador de empalmes'
    ],
    resultado: '',
    imagenes: ['IMG/Caja%20de%20distribucion.jpg', 'IMG/caja%20de%20distribucion2.jpeg'],
    fecha: '2026-10-10'
  },
  {
    id: 'infra-2',
    categoria: 'infraestructura',
    titulo: 'Implementación de cableado estructurado mediante bandejas portacables aéreas.',
    resumen: 'Distribución y organización de cableado de telecomunicaciones mediante bandejas portacables metálicas, con agrupación de conductores para facilitar la administración de la infraestructura de red.',
    descripcion: 'Infraestructura de telecomunicaciones compuesta por un sistema de bandejas portacables metálicas instaladas en la parte superior de una edificación, destinadas a conducir y organizar el cableado de comunicaciones. Se observan diferentes grupos de cables identificados por colores, distribuidos a través de estructuras de soporte aéreas que permiten centralizar el recorrido del cableado y facilitar futuras labores de mantenimiento, ampliación y administración de la red.',
    trabajos: [
      'Distribución de cableado de telecomunicaciones mediante bandejas portacables aéreas.',
      'Agrupación de conductores por tipo y función',
      'Organización de la infraestructura para facilitar mantenimiento y ampliaciones'
    ],
    tecnologias: [
      'Bandejas portacables metálicas',
      'Agrupadores de cables',
      'Soportes y fijaciones para bandejas'
    ],
    resultado: '',
    imagenes: ['IMG/organizacion%20de%20cableado.jpeg'
    ],
    fecha: '2026-09-02'
  }
];