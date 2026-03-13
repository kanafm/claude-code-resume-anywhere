import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { createInterface } from "readline";
import type { ConversationPreview } from "./types";

export async function getConversationPreview(
  jsonlPath: string
): Promise<ConversationPreview> {
  const fileStat = await stat(jsonlPath);
  let firstMessage = "";
  let lineCount = 0;

  const rl = createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineCount++;
    if (firstMessage) continue; // keep counting lines

    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "user" || parsed.role === "user") {
        const content = parsed.message?.content ?? parsed.content;
        if (typeof content === "string") {
          firstMessage = content;
        } else if (Array.isArray(content)) {
          const textBlock = content.find(
            (b: { type: string }) => b.type === "text"
          );
          if (textBlock) firstMessage = textBlock.text;
        }
      }
    } catch {
      // skip unparseable lines
    }
  }

  // Truncate preview
  if (firstMessage.length > 80) {
    firstMessage = firstMessage.slice(0, 77) + "...";
  }
  firstMessage = firstMessage.replace(/\n/g, " ");

  return {
    firstMessage,
    mtime: fileStat.mtime,
    messageCount: lineCount,
  };
}
