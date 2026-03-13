#!/usr/bin/env bun

import { parseArgs } from "util";
import { execSync } from "child_process";
import { createInterface } from "readline/promises";
import {
  discoverConversations,
  findByPartialId,
  getConversationPreview,
  importConversation,
  importConversationFromMatch,
  linkConversation,
  linkConversationFromMatch,
  encodePath,
} from "./lib/index";
import { projectNameFromEncoded } from "./lib/paths";
import type { Conversation } from "./lib/types";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortId(id: string): string {
  return id.slice(0, 8) + "...";
}

async function printList(partialId?: string) {
  if (partialId) {
    const { match, candidates } = await findByPartialId(partialId);
    const results = match ? [match] : candidates;
    if (results.length === 0) {
      console.error(`No conversations matching "${partialId}"`);
      process.exit(1);
    }
    await printConversationTable(results);
  } else {
    const conversations = await discoverConversations();
    if (conversations.length === 0) {
      console.log("No conversations found.");
      return;
    }
    await printConversationTable(conversations);
  }
}

async function printConversationTable(conversations: Conversation[]) {
  const rows: string[][] = [];
  rows.push(["ID", "Project", "Last active", "Preview"]);

  for (const conv of conversations) {
    const preview = await getConversationPreview(conv.jsonlPath).catch(
      () => null
    );
    const projectName = projectNameFromEncoded(conv.projectDir);
    let projectDisplay = projectName;
    if (conv.isSymlink && conv.symlinkTarget) {
      // Extract project name from symlink target path
      const parts = conv.symlinkTarget.split("/");
      const projIdx = parts.indexOf("projects");
      if (projIdx >= 0 && projIdx + 1 < parts.length) {
        projectDisplay += ` → ${projectNameFromEncoded(parts[projIdx + 1])}`;
      }
    }

    rows.push([
      shortId(conv.id),
      projectDisplay,
      formatTimeAgo(conv.mtime),
      preview ? `"${preview.firstMessage}"` : "(empty)",
    ]);
  }

  // Calculate column widths
  const colWidths = rows[0].map((_, i) =>
    Math.max(...rows.map((r) => r[i].length))
  );

  for (const [i, row] of rows.entries()) {
    const line = row
      .map((cell, j) => cell.padEnd(colWidths[j] + 2))
      .join("")
      .trimEnd();
    console.log(line);
    if (i === 0) {
      console.log("-".repeat(line.length));
    }
  }
}

async function interactivePick(
  action: "fork" | "resume"
): Promise<Conversation> {
  const currentProjectDir = encodePath(process.cwd());
  const conversations = (await discoverConversations()).filter(
    (c) => c.projectDir !== currentProjectDir
  );

  if (conversations.length === 0) {
    console.error("No conversations found in other projects.");
    process.exit(1);
  }

  console.log(`\nSelect a conversation to ${action}:\n`);

  for (const [i, conv] of conversations.entries()) {
    const preview = await getConversationPreview(conv.jsonlPath).catch(
      () => null
    );
    const projectName = projectNameFromEncoded(conv.projectDir);
    const msg = preview?.firstMessage
      ? `"${preview.firstMessage}"`
      : "(empty)";
    console.log(
      `  ${(i + 1).toString().padStart(3)}) ${shortId(conv.id)}  ${projectName.padEnd(20)}  ${formatTimeAgo(conv.mtime).padEnd(12)}  ${msg}`
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nEnter number (1-${conversations.length}): `);
  rl.close();

  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= conversations.length) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  return conversations[idx];
}

function printImportNote(conversation: Conversation) {
  console.log(
    `\nNote: This conversation was originally in ${conversation.decodedPath}`
  );
  console.log(
    `      File paths and git context in the history reference that directory.`
  );
  console.log(`      Claude will adapt to the current directory on resume.\n`);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      fork: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
      import: { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help || (!values.fork && !values.resume && !values.import && !values.list)) {
    console.log(`claude-extras — Cross-directory conversation management for Claude Code

Usage:
  claude-extras --fork [<id>]      Copy conversation to current project + resume
  claude-extras --resume [<id>]    Symlink conversation to current project + resume
  claude-extras --import <id>      Copy conversation to current project (no resume)
  claude-extras --list [<id>]      List conversations (optionally filter by partial ID)
  claude-extras --help             Show this help`);
    process.exit(values.help ? 0 : 1);
  }

  if (values.list) {
    await printList(positionals[0]);
    return;
  }

  if (values.import) {
    const id = positionals[0];
    if (!id) {
      console.error("--import requires a conversation ID");
      process.exit(1);
    }
    const result = await importConversation(id);
    printImportNote((await findByPartialId(id)).match!);
    console.log(`Imported as ${result.newId}`);
    return;
  }

  if (values.fork) {
    const id = positionals[0];
    let conversation: Conversation;
    let newId: string;

    if (id) {
      const result = await importConversation(id);
      newId = result.newId;
      conversation = (await findByPartialId(id)).match!;
    } else {
      conversation = await interactivePick("fork");
      const result = await importConversationFromMatch(conversation);
      newId = result.newId;
    }

    printImportNote(conversation);
    console.log(`Forked as ${newId}, resuming...`);
    execSync(`claude --resume ${newId}`, { stdio: "inherit" });
    return;
  }

  if (values.resume) {
    const id = positionals[0];
    let conversation: Conversation;
    let resumeId: string;

    if (id) {
      const result = await linkConversation(id);
      resumeId = result.id;
      conversation = (await findByPartialId(id)).match!;
    } else {
      conversation = await interactivePick("resume");
      const result = await linkConversationFromMatch(conversation);
      resumeId = result.id;
    }

    printImportNote(conversation);
    console.log(`Linked, resuming ${resumeId}...`);
    execSync(`claude --resume ${resumeId}`, { stdio: "inherit" });
    return;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
