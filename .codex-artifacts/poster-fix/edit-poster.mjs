import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/mateo/OneDrive/Escritorio/entremovil5/App";
const skillDir = "C:/Users/mateo/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations";
const runtimePython = "C:/Users/mateo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const sourcePath = "C:/Users/mateo/Downloads/SmartStock_Poster_Movil_sin_Luciana.pptx";
const buildDir = path.join(workspaceDir, ".codex-artifacts", "poster-fix");
const candidatePath = path.join(buildDir, "candidate.pptx");
const finalPath = path.join(workspaceDir, "outputs", "SmartStock_Poster_Movil_corregido.pptx");
const receiptPath = path.join(buildDir, "SmartStock_Poster_Movil_corregido.validation.json");

async function saveBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.resolve("sl/y90nupkv");

// Se conserva una vista previa de referencia antes de cambiar el texto.
await saveBlob(
  path.join(buildDir, "before-artifact.png"),
  await slide.export({ format: "png", scale: 1.5 }),
);

const introduction = presentation.resolve("sh/sryl4zqx");
introduction.text.replace(
  "SmartStock es una aplicación móvil diseñada para optimizar el control de inventarios en pequeñas y medianas empresas. Su propósito es centralizar la información de productos, ventas y reportes, ofreciendo un sistema eficiente, seguro y automatizado que facilite la toma de decisiones.",
  "SmartStock es una aplicación móvil diseñada para optimizar el control de inventarios en pequeñas y medianas empresas. Centraliza la información de clientes, productos, compras y estadísticas para facilitar el seguimiento del inventario y la toma de decisiones.",
);
introduction.text.replace(
  "La herramienta surge ante la necesidad de reducir errores humanos, pérdidas de información y procesos lentos derivados del manejo manual de inventarios. Con una interfaz moderna e intuitiva, SmartStock permite a administradores y empleados gestionar de forma ordenada los recursos de la empresa, mejorando la productividad y la trazabilidad.",
  "La herramienta surge ante la necesidad de reducir errores y demoras derivados del manejo manual de inventarios. Con una interfaz clara, SmartStock permite al administrador gestionar el negocio y a los clientes consultar productos y registrar sus compras.",
);

const problem = presentation.resolve("sh/utg3698n");
problem.text.replace(
  "controlar el stock en tiempo real",
  "actualizar el stock de forma automática en la base de datos local",
);

const methodology = presentation.resolve("sh/hofulsf2");
methodology.text.replace(
  "El desarrollo se realizó bajo la metodología ágil SCRUM, dividiendo el trabajo en sprints con tareas específicas de análisis, diseño, desarrollo, pruebas y despliegue.",
  "El desarrollo se realizó bajo la metodología ágil Scrum, dividiendo el trabajo en sprints con tareas de análisis, diseño, desarrollo y pruebas.",
);
methodology.text.replace(
  "El frontend se desarrolló en React Native, brindando una interfaz móvil dinámica y adaptable; el backend, con Node.js y Express, gestiona la lógica del sistema y la conexión con la base de datos MySQL. Se usaron herramientas como Figma para el diseño y Postman para pruebas.\nEsta metodología permitió un proceso iterativo, garantizando funcionalidad, seguridad y facilidad de uso en cada módulo del sistema.",
  "La aplicación se desarrolló con React Native y Expo. Expo Router gestiona la navegación y Expo SQLite almacena localmente la información. El sistema utiliza autenticación por roles y operaciones transaccionales para actualizar el inventario al registrar o modificar compras.\nEl proceso iterativo permitió comprobar el funcionamiento de cada módulo.",
);

const results = presentation.resolve("sh/vmdcj2xw");
results.text.replace(
  "Gestión de productos: registro, edición, búsqueda y control de entradas y salidas.",
  "Gestión de productos: registro, edición, búsqueda y control de existencias.",
);
results.text.replace(
  "Registro de compras vinculado al inventario en tiempo real.",
  "Registro de compras con actualización automática del inventario local.",
);

const recommendations = presentation.resolve("sh/036h8but");
recommendations.text.replace(
  "Se recomienda implementar notificaciones automáticas, funcionamiento sin conexión y mejoras de accesibilidad en la aplicación móvil.\nAdemás, integrar gráficos comparativos, alertas de stock y un módulo de auditoría fortalecería la trazabilidad y el control general del sistema, garantizando una evolución constante y adaptable a las necesidades empresariales.",
  "Se recomienda implementar notificaciones automáticas, copias de seguridad y mejoras de accesibilidad en la aplicación móvil.\nTambién sería útil añadir sincronización en la nube, exportación de informes y un módulo de auditoría para consultar el historial de cambios.",
);

const afterInspection = await presentation.inspect({
  select: "$.slides[0]",
  include: ["id", "index", "elements.id", "elements.text", "elements.position", "elements.style"],
});
await fs.writeFile(path.join(buildDir, "after-inspection.ndjson"), afterInspection.ndjson, "utf8");

await saveBlob(
  path.join(buildDir, "after-artifact.png"),
  await slide.export({ format: "png", scale: 1.5 }),
);

const candidate = await PresentationFile.exportPptx(presentation);
await candidate.save(candidatePath);

const sourceBytes = await fs.readFile(sourcePath);
const referenceSha256 = crypto.createHash("sha256").update(sourceBytes).digest("hex");
const { finalizePresentation } = await import(
  pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href
);

const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu",
    "15074900,20104100",
    "--expected-slide-count",
    "1",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  fontPolicy: {
    basis: "reference",
    families: ["Calibri"],
    referencePath: sourcePath,
    referenceSha256,
  },
  verifyArtifactToolImport: true,
  receiptPath,
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
