export interface Conversation {
  id: string;
  projectDir: string;
  decodedPath: string;
  jsonlPath: string;
  companionDir: string | null;
  mtime: Date;
  isSymlink: boolean;
  symlinkTarget: string | null;
}

export interface ConversationPreview {
  firstMessage: string;
  mtime: Date;
  messageCount: number;
}

export interface ImportResult {
  newId: string;
  path: string;
}

export interface LinkResult {
  id: string;
  path: string;
}
