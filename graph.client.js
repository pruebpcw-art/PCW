/* =====================================================================
   PCW — services/graph.client.js
   Conexión con Microsoft Graph usando las credenciales de la APLICACIÓN
   (flujo "client credentials"): nadie tiene que iniciar sesión y no hay
   tokens que renovar a mano.

   Variables del .env / hosting:
     MS_TENANT_ID       → ID del directorio (inquilino) de Microsoft 365
     MS_CLIENT_ID       → ID de la aplicación registrada en Azure
     MS_CLIENT_SECRET   → secreto de la aplicación (NUNCA en el navegador)
     Y UNA de estas opciones, según cómo identifiques la carpeta:
       OUTLET_DRIVE_USER → correo dueño del OneDrive (ej. ventas@pcwcr.com)
       OUTLET_SITE       → sitio de SharePoint (ej. pcwcr.sharepoint.com:/sites/Web)
       ONEDRIVE_DRIVE_ID → ID de la unidad de OneDrive PARA EMPRESAS
         + ONEDRIVE_FOLDER_ID (opcional) → ID de la carpeta; si se usa, las
           rutas OUTLET_EXCEL_FILE y OUTLET_IMAGES_FOLDER son relativas a ella
     ⚠️ Solo OneDrive para empresas / SharePoint (Microsoft 365). Un OneDrive
        PERSONAL no permite el acceso de la aplicación sin iniciar sesión.

   Requiere Node.js 18 o superior (usa fetch nativo).
   ===================================================================== */

const LOGIN_URL = process.env.MS_LOGIN_URL || 'https://login.microsoftonline.com';
const GRAPH_URL = process.env.MS_GRAPH_URL || 'https://graph.microsoft.com/v1.0';
const TIMEOUT_MS = 20000;

class GraphError extends Error {
  constructor(mensaje, codigo, status = 500) {
    super(mensaje);
    this.name = 'GraphError';
    this.codigo = codigo;
    this.status = status;
  }
}

// Token de la aplicación en memoria (dura ~60 min; se pide otro antes de vencer)
let tokenCache = { valor: null, venceEn: 0 };

/** fetch con tiempo máximo de espera */
async function fetchConLimite(url, opciones = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opciones, signal: controller.signal });
  } catch (error) {
    throw new GraphError(
      error.name === 'AbortError' ? 'Microsoft Graph tardó demasiado en responder' : `Sin conexión con Microsoft: ${error.message}`,
      'GRAPH_SIN_CONEXION', 503);
  } finally {
    clearTimeout(timer);
  }
}

/** Revisa que las variables necesarias existan */
function revisarConfiguracion() {
  const faltan = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'].filter((v) => !process.env[v]);
  if (!process.env.OUTLET_DRIVE_USER && !process.env.OUTLET_SITE && !process.env.ONEDRIVE_DRIVE_ID) {
    faltan.push('OUTLET_DRIVE_USER, OUTLET_SITE u ONEDRIVE_DRIVE_ID');
  }
  if (faltan.length) {
    throw new GraphError(`Faltan variables de configuración: ${faltan.join(', ')}`, 'GRAPH_SIN_CONFIGURAR');
  }
}

/** Obtiene (o reutiliza) el token de acceso de la aplicación */
async function obtenerToken() {
  if (tokenCache.valor && Date.now() < tokenCache.venceEn) return tokenCache.valor;
  revisarConfiguracion();

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const respuesta = await fetchConLimite(`${LOGIN_URL}/${encodeURIComponent(process.env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || !datos.access_token) {
    console.error('[Graph] Error al obtener el token:', datos.error, datos.error_description);
    throw new GraphError(
      'No se pudo autenticar con Microsoft. Revisa MS_TENANT_ID, MS_CLIENT_ID y MS_CLIENT_SECRET (¿venció el secreto?).',
      'GRAPH_CREDENCIALES', 500);
  }

  // Se renueva 5 minutos antes de que venza
  tokenCache = { valor: datos.access_token, venceEn: Date.now() + (Number(datos.expires_in || 3600) - 300) * 1000 };
  return tokenCache.valor;
}

/** Ruta base de la unidad: ID de unidad, sitio de SharePoint u OneDrive de un usuario */
function baseUnidad() {
  if (process.env.ONEDRIVE_DRIVE_ID) return `/drives/${encodeURIComponent(process.env.ONEDRIVE_DRIVE_ID.trim())}`;
  if (process.env.OUTLET_SITE) {
    const sitio = process.env.OUTLET_SITE.trim();
    // "pcwcr.sharepoint.com:/sites/Web" → /sites/pcwcr.sharepoint.com:/sites/Web:/drive
    return sitio.includes(':/') ? `/sites/${sitio}:/drive` : `/sites/${sitio}/drive`;
  }
  return `/users/${encodeURIComponent(process.env.OUTLET_DRIVE_USER)}/drive`;
}

/** "prueba Pagina/Inventario.xlsx" → "prueba%20Pagina/Inventario.xlsx" */
function codificarRuta(ruta) {
  return String(ruta).replace(/^\/+|\/+$/g, '').split('/').map(encodeURIComponent).join('/');
}

/** Consulta a Graph con el token de la aplicación */
async function graphGet(ruta) {
  const token = await obtenerToken();
  const respuesta = await fetchConLimite(`${GRAPH_URL}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  const datos = await respuesta.json().catch(() => ({}));

  if (respuesta.ok) return datos;

  const detalle = datos?.error?.message || `HTTP ${respuesta.status}`;
  console.error(`[Graph] ${respuesta.status} en ${ruta}:`, detalle);
  if (respuesta.status === 404) throw new GraphError('No se encontró el archivo o la carpeta en OneDrive/SharePoint', 'GRAPH_NO_ENCONTRADO', 404);
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new GraphError('La aplicación no tiene permiso para leer el archivo. Revisa los permisos y el consentimiento de administrador en Azure.', 'GRAPH_SIN_PERMISO', 500);
  }
  if (respuesta.status === 400 && process.env.ONEDRIVE_DRIVE_ID) {
    throw new GraphError('Microsoft rechazó la unidad indicada. Si ONEDRIVE_DRIVE_ID es de un OneDrive PERSONAL, este método no funciona: la carpeta debe estar en OneDrive para empresas.', 'GRAPH_UNIDAD_INVALIDA', 500);
  }
  if (respuesta.status === 429) throw new GraphError('Microsoft limitó temporalmente las consultas. Intenta en unos segundos.', 'GRAPH_LIMITE', 503);
  throw new GraphError(`Error de Microsoft Graph: ${detalle}`, 'GRAPH_ERROR', 502);
}

/**
 * Datos de un archivo: identificador de versión (eTag), tipo y enlace de descarga temporal.
 * @param {string} ruta ruta dentro de la unidad, ej. "prueba Pagina/Inventario_outlet.xlsx"
 */
async function obtenerArchivo(ruta) {
  // Con ONEDRIVE_FOLDER_ID la ruta es relativa a esa carpeta; si no, a la raíz de la unidad
  const carpeta = process.env.ONEDRIVE_FOLDER_ID
    ? `items/${encodeURIComponent(process.env.ONEDRIVE_FOLDER_ID.trim())}`
    : 'root';
  const item = await graphGet(`${baseUnidad()}/${carpeta}:/${codificarRuta(ruta)}`);
  if (!item.file) throw new GraphError(`"${ruta}" no es un archivo`, 'GRAPH_NO_ES_ARCHIVO', 404);
  return {
    eTag: item.cTag || item.eTag,
    nombre: item.name,
    tipo: item.file.mimeType || 'application/octet-stream',
    tamano: item.size,
    descarga: item['@microsoft.graph.downloadUrl'],
  };
}

/** Descarga el contenido de un archivo (el enlace temporal no necesita token) */
async function descargar(urlDescarga) {
  if (!urlDescarga) throw new GraphError('Microsoft no devolvió un enlace de descarga', 'GRAPH_SIN_DESCARGA', 502);
  const respuesta = await fetchConLimite(urlDescarga);
  if (!respuesta.ok) throw new GraphError(`No se pudo descargar el archivo (HTTP ${respuesta.status})`, 'GRAPH_DESCARGA', 502);
  return Buffer.from(await respuesta.arrayBuffer());
}

module.exports = { obtenerArchivo, descargar, GraphError };
