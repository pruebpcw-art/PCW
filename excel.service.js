/* =====================================================================
   PCW — services/excel.service.js
   Lee la tabla "ProductosOutlet" del Excel del Outlet.

   DOS MODOS (variable OUTLET_SOURCE):
     local  → lee el archivo de una carpeta de la computadora
              (OneDrive sincronizado). Variable: OUTLET_EXCEL_PATH
     graph  → lo descarga de OneDrive para empresas / SharePoint con
              Microsoft Graph (para el hosting). Variable: OUTLET_EXCEL_FILE
              + las credenciales de services/graph.client.js
   Si no se indica, se usa "local".

   - Devuelve objetos con los encabezados REALES de la tabla
     (ej. { "ID": 1, "Productos": "Laptop", "Precio Nuevo": 150000 }).
   - Solo vuelve a leer el Excel si cambió:
       local → fecha de modificación del archivo
       graph → versión del archivo en Microsoft (cTag), consultada
               como máximo cada OUTLET_CACHE_SECONDS (por defecto 30 s)

   Nota técnica: ExcelJS 4.4 no carga las filas de las tablas y puede
   fallar con algunos archivos con tablas. Por eso el archivo se abre
   con JSZip, se corrige esa referencia interna y se leen las celdas
   del rango exacto de la tabla.
   ===================================================================== */

const fs = require("fs/promises");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const { obtenerArchivo, descargar } = require("./graph.client");

const TABLA_POR_DEFECTO = "ProductosOutlet";

// Caché en memoria: { clave, version, revisadoEn, productos }
let cache = null;

/* ---------- Error con código para que la ruta responda bien ---------- */
class ExcelServiceError extends Error {
  constructor(mensaje, codigo, status = 500) {
    super(mensaje);
    this.name = "ExcelServiceError";
    this.codigo = codigo;
    this.status = status;
  }
}

/* ---------- Abre el Excel (desde un buffer) corrigiendo las rutas internas ---------- */
async function abrirLibro(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // Algunos programas guardan la ruta de la tabla como "/xl/tables/..."
  // y ExcelJS solo entiende "../tables/...". Se normaliza.
  const relaciones = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/_rels\/.+\.rels$/.test(n));
  for (const nombre of relaciones) {
    const xml = await zip.file(nombre).async("string");
    const corregido = xml.replace(/Target="\/xl\//g, 'Target="../');
    if (corregido !== xml) zip.file(nombre, corregido);
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await zip.generateAsync({ type: "nodebuffer" }));
  return libro;
}

/* ---------- Convierte el valor de una celda a texto/número simple ---------- */
function valorCelda(celda) {
  const v = celda.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);          // fechas → "2026-10-15"
  if (typeof v === "object") {
    if (v.result !== undefined) return v.result instanceof Date ? v.result.toISOString().slice(0, 10) : v.result; // fórmulas
    if (v.richText) return v.richText.map((t) => t.text).join("");       // texto con formato
    if (v.text !== undefined) return v.text;                              // hipervínculos
    if (v.error) return "";
  }
  return typeof v === "string" ? v.trim() : v;
}

/* ---------- Busca la tabla en todas las hojas ---------- */
function buscarTabla(libro, nombreTabla) {
  let encontrada = null;
  libro.eachSheet((hoja) => {
    if (encontrada) return;
    const tabla = typeof hoja.getTable === "function" ? hoja.getTable(nombreTabla) : null;
    const rango = tabla?.table?.tableRef || tabla?.table?.ref;
    if (rango) encontrada = { hoja, rango };
  });
  return encontrada;
}

/* ---------- Lee encabezados y filas del rango de la tabla ---------- */
function leerRango(hoja, rango) {
  const [inicio, fin] = rango.split(":");
  const celdaInicio = hoja.getCell(inicio);
  const celdaFin = hoja.getCell(fin);
  const f1 = celdaInicio.row, c1 = celdaInicio.col;
  const f2 = celdaFin.row, c2 = celdaFin.col;

  const encabezados = [];
  for (let c = c1; c <= c2; c++) {
    encabezados.push(String(valorCelda(hoja.getRow(f1).getCell(c)) || `Columna${c - c1 + 1}`));
  }

  const productos = [];
  for (let f = f1 + 1; f <= f2; f++) {
    const fila = hoja.getRow(f);
    const producto = {};
    let vacia = true;
    encabezados.forEach((encabezado, i) => {
      const valor = valorCelda(fila.getCell(c1 + i));
      if (valor !== "") vacia = false;
      producto[encabezado] = valor;
    });
    if (!vacia) productos.push(producto);     // se omiten filas en blanco
  }
  return productos;
}

/* ---------- Convierte el archivo (buffer) en la lista de productos ---------- */
async function productosDesdeBuffer(buffer) {
  const nombreTabla = process.env.OUTLET_EXCEL_TABLE || TABLA_POR_DEFECTO;
  let libro;
  try {
    libro = await abrirLibro(buffer);
  } catch (error) {
    throw new ExcelServiceError(`No se pudo abrir el Excel: ${error.message}`, "EXCEL_ILEGIBLE");
  }
  const tabla = buscarTabla(libro, nombreTabla);
  if (!tabla) {
    throw new ExcelServiceError(`No existe la tabla "${nombreTabla}" en el Excel`, "TABLA_NO_ENCONTRADA", 404);
  }
  return leerRango(tabla.hoja, tabla.rango);
}

/* =====================================================================
   MODO LOCAL — archivo en una carpeta de la computadora
   ===================================================================== */
async function obtenerLocal() {
  const ruta = process.env.OUTLET_EXCEL_PATH;
  if (!ruta) throw new ExcelServiceError("Falta OUTLET_EXCEL_PATH en el archivo .env", "EXCEL_SIN_CONFIGURAR");

  let info;
  try {
    info = await fs.stat(ruta);
  } catch {
    throw new ExcelServiceError(`No se encontró el Excel en: ${ruta}`, "EXCEL_NO_ENCONTRADO", 404);
  }

  const clave = `local:${ruta}`;
  if (cache && cache.clave === clave && cache.version === info.mtimeMs) return cache.productos;

  let buffer;
  try {
    buffer = await fs.readFile(ruta);
  } catch (error) {
    if (error.code === "EBUSY" || error.code === "EPERM") {
      throw new ExcelServiceError("El Excel está bloqueado (OneDrive sincronizando). Intenta en unos segundos.", "EXCEL_BLOQUEADO", 503);
    }
    throw new ExcelServiceError(`No se pudo leer el Excel: ${error.message}`, "EXCEL_ILEGIBLE");
  }

  const productos = await productosDesdeBuffer(buffer);
  cache = { clave, version: info.mtimeMs, revisadoEn: Date.now(), productos };
  return productos;
}

/* =====================================================================
   MODO GRAPH — OneDrive para empresas / SharePoint (Microsoft 365)
   ===================================================================== */
async function obtenerGraph() {
  const ruta = process.env.OUTLET_EXCEL_FILE;
  if (!ruta) throw new ExcelServiceError("Falta OUTLET_EXCEL_FILE (ruta del Excel dentro de OneDrive/SharePoint)", "EXCEL_SIN_CONFIGURAR");

  const clave = `graph:${ruta}`;
  const espera = Number(process.env.OUTLET_CACHE_SECONDS || 30) * 1000;

  // No se consulta a Microsoft en cada visita: como máximo cada 30 s
  if (cache && cache.clave === clave && Date.now() - cache.revisadoEn < espera) return cache.productos;

  try {
    const archivo = await obtenerArchivo(ruta);

    // Misma versión que la que ya está leída: no se descarga de nuevo
    if (cache && cache.clave === clave && cache.version === archivo.eTag) {
      cache.revisadoEn = Date.now();
      return cache.productos;
    }

    const buffer = await descargar(archivo.descarga);
    const productos = await productosDesdeBuffer(buffer);
    cache = { clave, version: archivo.eTag, revisadoEn: Date.now(), productos };
    return productos;
  } catch (error) {
    // Si Microsoft falla momentáneamente, se siguen mostrando los últimos productos leídos
    if (cache && cache.clave === clave && error.status >= 500) {
      console.warn("[Outlet] Microsoft no respondió; se usan los últimos datos leídos:", error.message);
      return cache.productos;
    }
    throw error;
  }
}

/* ---------- Función principal ---------- */
async function obtenerProductosExcel() {
  const modo = (process.env.OUTLET_SOURCE || "local").toLowerCase();
  return modo === "graph" ? obtenerGraph() : obtenerLocal();
}

module.exports = { obtenerProductosExcel, ExcelServiceError };
