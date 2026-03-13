import { symlink, mkdir, lstat } from "fs/promises";
import { join } from "path";
import { getProjectDirForCwd } from "./paths";
import { findByPartialId } from "./discovery";
import type { Conversation, LinkResult } from "./types";

export async function linkConversation(
  idOrPartial: string,
  targetDir?: string
): Promise<LinkResult> {
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

  return linkConversationFromMatch(match, targetDir);
}

export async function linkConversationFromMatch(
  conversation: Conversation,
  targetDir?: string
): Promise<LinkResult> {
  const dest = targetDir ?? getProjectDirForCwd();
  await mkdir(dest, { recursive: true });

  const linkJsonlPath = join(dest, `${conversation.id}.jsonl`);

  // Check if link already exists
  const existing = await lstat(linkJsonlPath).catch(() => null);
  if (existing) {
    throw new Error(
      `Conversation ${conversation.id} already exists in target project. Use --fork to create an independent copy instead.`
    );
  }

  // Symlink the jsonl file
  await symlink(conversation.jsonlPath, linkJsonlPath);

  // Symlink companion dir if it exists
  if (conversation.companionDir) {
    const linkCompanionDir = join(dest, conversation.id);
    await symlink(conversation.companionDir, linkCompanionDir);
  }

  return { id: conversation.id, path: linkJsonlPath };
}
