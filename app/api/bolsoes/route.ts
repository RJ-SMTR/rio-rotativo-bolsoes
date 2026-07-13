import { promises as fs } from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "geojson.geojson");
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);

    return Response.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao ler GeoJSON";
    return Response.json({ error: message }, { status: 500 });
  }
}
