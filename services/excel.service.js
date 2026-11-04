/* =====================================================================
   PCW — services/excel.service.js
   Lee la tabla "ProductosOutlet" del Excel sincronizado por OneDrive.

   - Ruta del archivo: variable OUTLET_EXCEL_PATH del .env
   - Nombre de la tabla: OUTLET_EXCEL_TABLE (por defecto "ProductosOutlet")
   - Devuelve un arreglo de objetos cuyas propiedades son los
     encabezados REALES de la tabla (ej. { "ID": "001", "Nombre": ... }).
   - Solo vuelve a abrir el Excel si el archivo cambió (fecha de
     modificación), así cada consulta es rápida.

   Nota técnica: ExcelJS 4.4 no carga las filas de las tablas y puede
   fallar con algunos archivos que tienen tablas. Por eso el archivo se
   abre con JSZip, se corrige esa referencia interna y se leen las
   celdas del rango exacto de la tabla.
   ===================================================================== */

const fs = require("fs/promises");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");

const TABLA_POR_DEFECTO = "ProductosOutlet";

// Caché en memoria: { ruta, mtimeMs, productos }
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

/* ---------- Abre el Excel corrigiendo las rutas internas de las tablas ---------- */
async function abrirLibro(ruta) {
  const buffer = await fs.readFile(ruta);
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

  // Primera fila del rango = encabezados
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

/* ---------- Función principal ---------- */
async function obtenerProductosExcel() {
  const ruta = process.env.OUTLET_EXCEL_PATH;
  const nombreTabla = process.env.OUTLET_EXCEL_TABLE || TABLA_POR_DEFECTO;

  if (!ruta) {
    throw new ExcelServiceError("Falta OUTLET_EXCEL_PATH en el archivo .env", "EXCEL_SIN_CONFIGURAR");
  }

  let info;
  try {
    info = await fs.stat(ruta);
  } catch {
    throw new ExcelServiceError(`No se encontró el Excel en: ${ruta}`, "EXCEL_NO_ENCONTRADO", 404);
  }

  // Si el archivo no cambió, se devuelve lo que ya estaba leído
  if (cache && cache.ruta === ruta && cache.mtimeMs === info.mtimeMs) {
    return cache.productos;
  }

  let libro;
  try {
    libro = await abrirLibro(ruta);
  } catch (error) {
    if (error.code === "EBUSY" || error.code === "EPERM") {
      throw new ExcelServiceError("El Excel está bloqueado (OneDrive sincronizando). Intenta en unos segundos.", "EXCEL_BLOQUEADO", 503);
    }
    throw new ExcelServiceError(`No se pudo abrir el Excel: ${error.message}`, "EXCEL_ILEGIBLE");
  }

  const tabla = buscarTabla(libro, nombreTabla);
  if (!tabla) {
    throw new ExcelServiceError(`No existe la tabla "${nombreTabla}" en el Excel`, "TABLA_NO_ENCONTRADA", 404);
  }

  const productos = leerRango(tabla.hoja, tabla.rango);
  cache = { ruta, mtimeMs: info.mtimeMs, productos };
  return productos;
}

module.exports = { obtenerProductosExcel, ExcelServiceError };