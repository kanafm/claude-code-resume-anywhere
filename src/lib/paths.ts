import { homedir } from "os";
import { join } from "path";

export function getClaudeDir(): string {
  return join(homedir(), ".claude");
}

export function getProjectsDir(): string {
  return join(getClaudeDir(), "projects");
}

export function encodePath(absolutePath: string): string {
  return absolutePath.replace(/\//g, "-");
}

export function decodePath(encoded: string): string {
  // Encoded paths start with "-" (from leading "/"), then each "-" is a "/"
  // e.g. "-Users-kana-Desktop" → "/Users/kana/Desktop"
  return encoded.replace(/-/g, "/");
}

export function getProjectDir(absolutePath: string): string {
  return join(getProjectsDir(), encodePath(absolutePath));
}

export function getProjectDirForCwd(): string {
  return getProjectDir(process.cwd());
}

export function projectNameFromEncoded(encoded: string): string {
  const decoded = decodePath(encoded);
  const parts = decoded.split("/").filter(Boolean);
  return parts[parts.length - 1] || decoded;
}
