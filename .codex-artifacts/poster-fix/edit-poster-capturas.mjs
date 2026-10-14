import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/mateo/OneDrive/Escritorio/entremovil5/App";
const skillDir = "C:/Users/mateo/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations";
const runtimePython = "C:/Users/mateo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
process.env.RUNTIME_NODE_MODULES = "C:/Users/mateo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const sourcePath = path.join(workspaceDir, "outputs", "SmartStock_Poster_Movil_corregido.pptx");
const buildDir = path.join(workspaceDir, ".codex-artifacts", "poster-fix");
const candidatePath = path.join(buildDir, "candidate-capturas.pptx");
const finalPath = path.join(workspaceDir, "outputs", "SmartStock_Poster_Movil_corregido_con_capturas.pptx");
const receiptPath = path.join(buildDir, "SmartStock_Poster_Movil_corregido_con_capturas.validation.json");

const screenshotPaths = {
  statistics: "C:/Users/mateo/AppData/Local/Temp/codex-clipboard-fcfe0966-e75f-4436-8ec7-e6656c004ce3.png",
  admin: "C:/Users/mateo/AppData/Local/Temp/codex-clipboard-f93121bf-ade3-4483-ba24-eda27cba8148.png",
  client: "C:/Users/mateo/AppData/Local/Temp/codex-clipboard-e6944c2a-0af7-47d7-a610-58acdb4a8510.png",
  login: "C:/Users/mateo/AppData/Local/Temp/codex-clipboard-1ff77cba-380d-462f-8fea-6bbc2a1c2c19.png",
};

async function saveBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function readArrayBuffer(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function replaceScreenshot(id, filePath, alt, frame) {
  const image = presentation.resolve(id);
  image.replace({
    blob: await readArrayBuffer(filePath),
    contentType: "image/png",
    alt,
    fit: "contain",
  });
  image.frame = frame;
  image.crop = undefined;
  image.rotation = 0;
  image.flipHorizontal = false;
  image.flipVertical = false;
  image.lockAspectRatio = false;
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.resolve("sl/y90nupkv");

await saveBlob(
  path.join(buildDir, "before-capturas.png"),
  await slide.export({ format: "png", scale: 1.5 }),
);
await fs.writeFile(
  path.join(buildDir, "before-capturas.layout.json"),
  await (await slide.export({ format: "layout", detail: "full" })).text(),
  "utf8",
);

const topLabelY = 833;
const topImageY = 865;
const bottomLabelY = 1200;
const bottomImageY = 1232;
const leftX = 810;
const rightX = 1200;
const leftW = 360;
const rightW = 370;

await replaceScreenshot(
  "im/1kvyhsfm",
  screenshotPaths.login,
  "Pantalla de inicio de sesión de SmartStock",
  { left: leftX, top: topImageY, width: leftW, height: 320 },
);
await replaceScreenshot(
  "im/nmxgjixc",
  screenshotPaths.admin,
  "Panel administrativo de SmartStock",
  { left: rightX, top: topImageY, width: rightW, height: 320 },
);
await replaceScreenshot(
  "im/t8jihgzm",
  screenshotPaths.client,
  "Área de cliente de SmartStock",
  { left: leftX, top: bottomImageY, width: leftW, height: 350 },
);

const statisticsImage = slide.images.add({
  blob: await readArrayBuffer(screenshotPaths.statistics),
  contentType: "image/png",
  alt: "Panel de estadísticas de SmartStock",
  fit: "contain",
  position: { left: rightX, top: bottomImageY, width: rightW, height: 350 },
});
statisticsImage.name = "Captura de estadísticas";

const loginLabel = presentation.resolve("sh/h072l4jy");
loginLabel.position = { left: leftX, top: topLabelY, width: leftW, height: 22.4 };
const adminLabel = presentation.resolve("sh/i1gje90j");
adminLabel.position = { left: rightX, top: topLabelY, width: rightW, height: 22.4 };
const clientLabel = presentation.resolve("sh/j2pkne14");
clientLabel.position = { left: leftX, top: bottomLabelY, width: leftW, height: 22.4 };

const statisticsLabel = slide.shapes.add({
  geometry: "textbox",
  name: "Rótulo de estadísticas",
  position: { left: rightX, top: bottomLabelY, width: rightW, height: 22.4 },
  fill: "none",
  line: { style: "solid", fill: "none", width: 0 },
});
statisticsLabel.text = "ESTADÍSTICAS";
statisticsLabel.text.style = {
  fontFamily: "Calibri",
  fontSize: 18.67,
  color: "#000000",
};

const inspection = await presentation.inspect({
  select: "$.slides[0]",
  include: [
    "id",
    "index",
    "elements.id",
    "elements.kind",
    "elements.name",
    "elements.text",
    "elements.alt",
    "elements.position",
    "elements.style",
  ],
});
await fs.writeFile(path.join(buildDir, "after-capturas-inspection.ndjson"), inspection.ndjson, "utf8");

await saveBlob(
  path.join(buildDir, "after-capturas.png"),
  await slide.export({ format: "png", scale: 1.5 }),
);
await fs.writeFile(
  path.join(buildDir, "after-capturas.layout.json"),
  await (await slide.export({ format: "layout", detail: "full" })).text(),
  "utf8",
);

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

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
