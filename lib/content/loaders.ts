import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  CurriculumCoverageEntrySchema,
  InvestigationDefinitionSchema,
  InvestigationSummarySchema,
} from "@/lib/domain/schema";
import type {
  CurriculumCoverageEntry,
  InvestigationDefinition,
  InvestigationSummary,
} from "@/lib/domain/types";

const CONTENT_DIR = path.join(process.cwd(), "content", "investigations");

async function loadDefinitionFile(fileName: string): Promise<InvestigationDefinition> {
  const filePath = path.join(CONTENT_DIR, fileName);
  const json = JSON.parse(await fs.readFile(filePath, "utf8"));
  return InvestigationDefinitionSchema.parse(json);
}

export const getAllInvestigations = cache(async (): Promise<InvestigationDefinition[]> => {
  const files = await fs.readdir(CONTENT_DIR);
  const definitions = await Promise.all(
    files.filter((file) => file.endsWith(".json")).map((file) => loadDefinitionFile(file)),
  );

  return definitions.sort((left, right) => left.title.localeCompare(right.title));
});

export const getInvestigationSummaries = cache(async (): Promise<InvestigationSummary[]> => {
  const investigations = await getAllInvestigations();
  return investigations.map((investigation) => InvestigationSummarySchema.parse(investigation));
});

export const getInvestigationBySlug = cache(
  async (slug: string): Promise<InvestigationDefinition | null> => {
    const investigations = await getAllInvestigations();
    return investigations.find((investigation) => investigation.slug === slug) ?? null;
  },
);

export async function getCurriculumCoverage(): Promise<CurriculumCoverageEntry[]> {
  const investigations = await getAllInvestigations();
  const grouping = new Map<string, CurriculumCoverageEntry>();

  for (const investigation of investigations) {
    const key = `${investigation.yearGroup}:${investigation.curriculumArea}`;
    const existing = grouping.get(key) ?? {
      yearGroup: investigation.yearGroup,
      curriculumArea: investigation.curriculumArea,
      investigationIds: [],
      covered: true,
    };
    existing.investigationIds.push(investigation.id);
    grouping.set(key, existing);
  }

  return [...grouping.values()].map((entry) => CurriculumCoverageEntrySchema.parse(entry));
}
