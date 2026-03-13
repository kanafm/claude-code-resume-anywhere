import { readdir, stat, lstat, readlink } from "fs/promises";
import { join, basename } from "path";
import { getProjectsDir, decodePath } from "./paths";
import type { Conversation } from "./types";

export async function discoverConversations(): Promise<Conversation[]> {
  const projectsDir = getProjectsDir();
  let projectDirs: string[];

  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  const conversations: Conversation[] = [];

  for (const dirName of projectDirs) {
    const dirPath = join(projectsDir, dirName);
    const dirStat = await stat(dirPath).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;

      const id = file.replace(/\.jsonl$/, "");
      const jsonlPath = join(dirPath, file);
      const companionPath = join(dirPath, id);

      const fileLstat = await lstat(jsonlPath).catch(() => null);
      if (!fileLstat) continue;

      const isSymlink = fileLstat.isSymbolicLink();
      let symlinkTarget: string | null = null;
      let mtime = fileLstat.mtime;

      if (isSymlink) {
        symlinkTarget = await readlink(jsonlPath).catch(() => null);
        // Get mtime from actual file
        const realStat = await stat(jsonlPath).catch(() => null);
        if (realStat) mtime = realStat.mtime;
      }

      const companionStat = await stat(companionPath).catch(() => null);
      const companionDir = companionStat?.isDirectory() ? companionPath : null;

      conversations.push({
        id,
        projectDir: dirName,
        decodedPath: decodePath(dirName),
        jsonlPath,
        companionDir,
        mtime,
        isSymlink,
        symlinkTarget,
      });
    }
  }

  // Sort by mtime descending (most recent first)
  conversations.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return conversations;
}

export async function findById(id: string): Promise<Conversation | null> {
  const all = await discoverConversations();
  return all.find((c) => c.id === id) ?? null;
}

export async function findByPartialId(
  partial: string
): Promise<{ match: Conversation | null; candidates: Conversation[] }> {
  const all = await discoverConversations();
  const candidates = all.filter((c) => c.id.startsWith(partial));

  if (candidates.length === 1) {
    return { match: candidates[0], candidates };
  }

  // Deduplicate: if the same ID appears in multiple projects (symlinks),
  // prefer the non-symlink (original) one
  const uniqueById = new Map<string, Conversation>();
  for (const c of candidates) {
    const existing = uniqueById.get(c.id);
    if (!existing || (!c.isSymlink && existing.isSymlink)) {
      uniqueById.set(c.id, c);
    }
  }

  const deduped = [...uniqueById.values()];
  if (deduped.length === 1) {
    return { match: deduped[0], candidates: deduped };
  }

  return { match: null, candidates: deduped };
}
