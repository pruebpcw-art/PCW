/* =====================================================================
   PCW — routes/outlet.routes.js
   Rutas del Outlet. Se registran en server.js con:
       app.use("/api/outlet", outletRoutes);

   GET /api/outlet/prueba              → comprueba que las rutas están conectadas
   GET /api/outlet/productos           → productos de la tabla ProductosOutlet (JSON)
   GET /api/outlet/imagenes/:archivo   → foto de la carpeta "Imagenes" (para más adelante)
   ===================================================================== */

const express = require("express");
const path = require("path");
const { obtenerProductosExcel } = require("../services/excel.service");

const router = express.Router();

/* ---------- Prueba de conexión ---------- */
router.get("/prueba", (req, res) => {
  res.json({
    success: true,
    mensaje: "Rutas del Outlet conectadas correctamente",
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
      mensaje: error.message,                       // sin detalles internos ni rutas del sistema
    });
  }
});

/* ---------- Imágenes de la carpeta "Imagenes" ----------
   Requiere OUTLET_IMAGES_PATH en el .env. Solo entrega archivos de
   imagen de esa carpeta (path.basename evita rutas como "../../"). */
const EXTENSIONES = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

router.get("/imagenes/:archivo", (req, res) => {
  const carpeta = process.env.OUTLET_IMAGES_PATH;
  if (!carpeta) return res.status(503).json({ success: false, mensaje: "Falta OUTLET_IMAGES_PATH en el .env" });

  const archivo = path.basename(req.params.archivo);
  if (!EXTENSIONES.has(path.extname(archivo).toLowerCase())) {
    return res.status(400).json({ success: false, mensaje: "Tipo de archivo no permitido" });
  }

  res.sendFile(path.join(carpeta, archivo), { maxAge: "1h" }, (error) => {
    if (error && !res.headersSent) res.status(404).json({ success: false, mensaje: "Imagen no encontrada" });
  });
});

module.exports = router;