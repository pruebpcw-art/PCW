/* =====================================================================
   PCW — routes/outlet.routes.js
   Rutas del Outlet. Se registran en server.js con:
       app.use("/api/outlet", outletRoutes);

   GET /api/outlet/prueba              → comprueba que las rutas están conectadas
   GET /api/outlet/productos           → productos de la tabla ProductosOutlet (JSON)
   GET /api/outlet/imagenes/:archivo   → foto de la carpeta de imágenes

   Las fotos salen de:
     modo local → OUTLET_IMAGES_PATH   (carpeta de la computadora)
     modo graph → OUTLET_IMAGES_FOLDER (carpeta en OneDrive/SharePoint)
   ===================================================================== */

const express = require("express");
const path = require("path");
const { obtenerProductosExcel } = require("../services/excel.service");
const { obtenerArchivo, descargar } = require("../services/graph.client");

const router = express.Router();
const modoGraph = () => (process.env.OUTLET_SOURCE || "local").toLowerCase() === "graph";

/* ---------- Prueba de conexión ---------- */
router.get("/prueba", (req, res) => {
  res.json({
    success: true,
    mensaje: "Rutas del Outlet conectadas correctamente",
    modo: modoGraph() ? "graph (Microsoft 365)" : "local (carpeta de la computadora)",
    hora: new Date().toISOString(),
  });
});

/* ---------- Productos del Excel ---------- */
router.get("/productos", async (req, res) => {
  try {
    const productos = await obtenerProductosExcel();
    res.set("Cache-Control", "no-store");          // el navegador siempre pide la versión actual
    res.json({ success: true, total: productos.length, productos });
  } catch (error) {
    console.error("[Outlet] Error al leer el Excel:", error.message);
    res.status(error.status || 500).json({
      success: false,
      codigo: error.codigo || "ERROR_INTERNO",
      mensaje: error.message,                       // sin claves ni detalles internos
    });
  }
});

/* ---------- Imágenes ----------
   Solo entrega imágenes (.jpg, .png, .webp, .gif) de la carpeta configurada.
   path.basename evita rutas como "../../.env". */
const EXTENSIONES = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// Modo graph: las fotos se guardan en memoria 10 minutos (no se descargan en cada visita)
const fotosCache = new Map();          // nombre → { buffer, tipo, guardadaEn }
const FOTO_TTL_MS = 10 * 60 * 1000;
const FOTO_MAX = 150;

router.get("/imagenes/:archivo", async (req, res) => {
  const archivo = path.basename(req.params.archivo);
  if (!EXTENSIONES.has(path.extname(archivo).toLowerCase())) {
    return res.status(400).json({ success: false, mensaje: "Tipo de archivo no permitido" });
  }

  /* --- Modo local: carpeta de la computadora --- */
  if (!modoGraph()) {
    const carpeta = process.env.OUTLET_IMAGES_PATH;
    if (!carpeta) return res.status(503).json({ success: false, mensaje: "Falta OUTLET_IMAGES_PATH en el .env" });
    return res.sendFile(path.join(carpeta, archivo), { maxAge: "1h" }, (error) => {
      if (error && !res.headersSent) res.status(404).json({ success: false, mensaje: "Imagen no encontrada" });
    });
  }

  /* --- Modo graph: carpeta en OneDrive para empresas / SharePoint --- */
  const carpeta = process.env.OUTLET_IMAGES_FOLDER;
  if (!carpeta) return res.status(503).json({ success: false, mensaje: "Falta OUTLET_IMAGES_FOLDER" });

  try {
    let foto = fotosCache.get(archivo);
    if (!foto || Date.now() - foto.guardadaEn > FOTO_TTL_MS) {
      const info = await obtenerArchivo(`${carpeta}/${archivo}`);
      foto = { buffer: await descargar(info.descarga), tipo: info.tipo, guardadaEn: Date.now() };
      if (fotosCache.size >= FOTO_MAX) fotosCache.delete(fotosCache.keys().next().value);   // quita la más antigua
      fotosCache.set(archivo, foto);
    }
    res.set("Content-Type", foto.tipo);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(foto.buffer);
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ success: false, mensaje: "Imagen no encontrada" });
    console.error("[Outlet] Error al obtener la imagen:", error.message);
    res.status(error.status || 500).json({ success: false, mensaje: "No se pudo obtener la imagen" });
  }
});

module.exports = router;
