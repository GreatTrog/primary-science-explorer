"use client";

import { del, get, set } from "idb-keyval";

import type { InvestigationSession } from "@/lib/domain/types";

export async function loadDraft(key: string) {
  return (await get<InvestigationSession>(key)) ?? null;
}

export async function saveDraft(key: string, draft: InvestigationSession) {
  await set(key, draft);
}

export async function clearDraft(key: string) {
  await del(key);
}
