import { copyFile, cp, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getProjectDirForCwd } from "./paths";
import { findByPartialId } from "./discovery";
import type { Conversation, ImportResult } from "./types";

export async function importConversation(
  idOrPartial: string,
  targetDir?: string
): Promise<ImportResult> {
  const { match, candidates } = await findByPartialId(idOrPartial);

  if (!match) {
    if (candidates.length === 0) {
      throw new Error(`No conversation found matching "${idOrPartial}"`);
    }
    const ids = candidates.map((c) => `  ${c.id} (${c.decodedPath})`).join("\n");
    throw new Error(
      `Ambiguous ID "${idOrPartial}" matches ${candidates.length} conversations:\n${ids}\nPlease be more specific.`
    );
  }

  return importConversationFromMatch(match, targetDir);
}

export async function importConversationFromMatch(
  conversation: Conversation,
  targetDir?: string
): Promise<ImportResult> {
  const dest = targetDir ?? getProjectDirForCwd();
  await mkdir(dest, { recursive: true });

  const newId = randomUUID();
  const newJsonlPath = join(dest, `${newId}.jsonl`);

  // Copy the jsonl file
  await copyFile(conversation.jsonlPath, newJsonlPath);

  // Copy companion dir if it exists
  if (conversation.companionDir) {
    const newCompanionDir = join(dest, newId);
    await cp(conversation.companionDir, newCompanionDir, { recursive: true });
  }

  return { newId, path: newJsonlPath };
}
