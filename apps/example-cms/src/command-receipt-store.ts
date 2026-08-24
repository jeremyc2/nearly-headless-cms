import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export interface CommandReceiptStore {
  readonly read: (scope: string, commandKey: string) => Promise<unknown | undefined>;
  readonly write: (scope: string, commandKey: string, receipt: unknown) => Promise<void>;
}

const receiptName = async (scope: string, commandKey: string): Promise<string> => {
  const input = new TextEncoder().encode(`${scope}\0${commandKey}`),
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return `${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}.json`;
};

export const memoryCommandReceiptStore = (): CommandReceiptStore => {
  const receipts = new Map<string, unknown>();
  return {
    read: async (scope, commandKey) => receipts.get(`${scope}\0${commandKey}`),
    write: async (scope, commandKey, receipt) => {
      receipts.set(`${scope}\0${commandKey}`, structuredClone(receipt));
    },
  };
};

export const filesystemCommandReceiptStore = (root: string): CommandReceiptStore => ({
  read: async (scope, commandKey) => {
    const path = join(root, await receiptName(scope, commandKey)),
      file = Bun.file(path);
    return (await file.exists()) ? ((await file.json()) as unknown) : undefined;
  },
  write: async (scope, commandKey, receipt) => {
    await mkdir(root, { recursive: true });
    const path = join(root, await receiptName(scope, commandKey)),
      stagePath = `${path}.${crypto.randomUUID()}.stage`;
    try {
      await Bun.write(stagePath, `${JSON.stringify(receipt)}\n`);
      await rename(stagePath, path);
    } catch (error) {
      await rm(stagePath, { force: true }).catch(() => undefined);
      throw error;
    }
  },
});
