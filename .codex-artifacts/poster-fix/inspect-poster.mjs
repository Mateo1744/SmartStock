import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const input = "C:/Users/mateo/OneDrive/Escritorio/entremovil5/App/outputs/SmartStock_Poster_Movil_corregido.pptx";
const outputDir = "C:/Users/mateo/OneDrive/Escritorio/entremovil5/App/.codex-artifacts/poster-fix";

const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
const inspection = await presentation.inspect({
  select: "$.slides[*]",
  include: [
    "id",
    "index",
    "layout",
    "elements.id",
    "elements.kind",
    "elements.name",
    "elements.text",
    "elements.position",
    "elements.style",
    "elements.paragraphs",
    "elements.image",
    "elements.imageData",
  ],
});

await fs.writeFile(`${outputDir}/inspection.ndjson`, inspection.ndjson, "utf8");
console.log(inspection.ndjson);
