/* =====================================================================
   PCW — server.js
   Servidor Express de PC Wizard.

   Orden correcto de un servidor Express:
     1. Cargar .env y librerías
     2. Crear la app y los middlewares
     3. Registrar TODAS las rutas
     4. Manejo de errores (404 y 500)
     5. app.listen()  ← siempre al final
   ===================================================================== */

/* ---------- 1. Configuración y librerías ---------- */
require("dotenv").config();                         // primero: así todo lo demás ya ve las variables del .env

const path = require("path");
const express = require("express");
const outletRoutes = require("./routes/outlet.routes");

const app = express();
const PORT = process.env.PORT || 3000;


/* ---------- 2. Middlewares ---------- */
app.use(express.json());

// Sitios que pueden pedir datos a este servidor (CORS):
//  · el dominio publicado en IONOS (con y sin www)
//  · Live Server en tu computadora
//  · y los que agregues en la variable ALLOWED_ORIGINS (separados por comas)
const ORIGENES_PERMITIDOS = [
  "https://pcwcr.com",
  "https://www.pcwcr.com",
  "http://pcwcr.com",
  "http://www.pcwcr.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
];
app.use("/api", (req, res, next) => {
  const origen = req.headers.origin;
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    res.set("Access-Control-Allow-Origin", origen);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});


/* ---------- 3. Rutas ---------- */

// Verificar servidor
app.get("/api/estado", (req, res) => {
  res.json({ estado: "OK", mensaje: "Servidor PCWizard funcionando" });
});

// Verificar módulo Outlet
app.get("/api/outlet/estado", (req, res) => {
  res.json({ success: true, mensaje: "Módulo Outlet preparado" });
});

app.get("/api/outlet/diagnostico", (req, res) => {
  res.json({ success: true, mensaje: "Express reconoce las rutas del Outlet" });
});

// Rutas del Outlet: /api/outlet/prueba, /api/outlet/productos, /api/outlet/imagenes/:archivo
app.use("/api/outlet", outletRoutes);

// Página web: se sirven SOLO las carpetas del sitio y el index.html.
// (No se sirve la carpeta completa del proyecto para no exponer .env ni server.js)
const OPCIONES_ESTATICAS = { dotfiles: "deny", index: false };
app.use("/CSS", express.static(path.join(__dirname, "CSS"), OPCIONES_ESTATICAS));
app.use("/JS", express.static(path.join(__dirname, "JS"), OPCIONES_ESTATICAS));
app.use("/IMG", express.static(path.join(__dirname, "IMG"), OPCIONES_ESTATICAS));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/proyectos.html", (req, res) => res.sendFile(path.join(__dirname, "proyectos.html")));


/* ---------- 4. Manejo de errores ---------- */

// Ruta de la API que no existe → respuesta JSON (en vez de "Cannot GET")
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Error inesperado en cualquier ruta
app.use((err, req, res, next) => {
  console.error("[Servidor] Error:", err);
  res.status(500).json({ success: false, mensaje: "Error interno del servidor" });
});


/* ---------- 5. Iniciar servidor (siempre al final) ---------- */
const servidor = app.listen(PORT, () => {
  console.log("================================");
  console.log("SERVIDOR PCWIZARD ACTIVO");
  console.log(`http://localhost:${PORT}`);
  console.log(`Outlet: http://localhost:${PORT}/api/outlet/productos`);
  console.log("================================");
});

servidor.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${PORT} ya está en uso: hay otro servidor abierto. Ciérralo y vuelve a ejecutar "node server.js".`);
  } else {
    console.error("[Servidor] No se pudo iniciar:", error.message);
  }
  process.exit(1);
});
