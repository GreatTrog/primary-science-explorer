import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const contentDir = path.join(process.cwd(), "content", "investigations");
const files = (await fs.readdir(contentDir)).filter((file) => file.endsWith(".json"));
const investigations = await Promise.all(
  files.map(async (file) => JSON.parse(await fs.readFile(path.join(contentDir, file), "utf8"))),
);

await supabase.from("investigation_definitions").upsert(
  investigations.map((investigation) => ({
    id: investigation.id,
    slug: investigation.slug,
    definition: investigation,
    year_group: investigation.yearGroup,
    curriculum_area: investigation.curriculumArea,
    enquiry_type: investigation.enquiryType,
  })),
);

const coverageRows = investigations.reduce((acc, investigation) => {
  const keyName = `${investigation.yearGroup}:${investigation.curriculumArea}`;
  const existing = acc.get(keyName) ?? {
    year_group: investigation.yearGroup,
    curriculum_area: investigation.curriculumArea,
    investigation_ids: [],
    covered: true,
  };
  existing.investigation_ids.push(investigation.id);
  acc.set(keyName, existing);
  return acc;
}, new Map());

await supabase
  .from("curriculum_manifest")
  .upsert([...coverageRows.values()], { onConflict: "year_group,curriculum_area" });

console.log(`Seeded ${investigations.length} investigations.`);
