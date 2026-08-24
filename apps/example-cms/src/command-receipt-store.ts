import { CommandReceiptStoreFailure } from "./command-receipt-store-failure.ts";
import { Effect } from "effect";

export interface CommandReceiptStore {
  readonly read: (
    scope: string,
    commandKey: string,
  ) => Effect.Effect<unknown, CommandReceiptStoreFailure>;
  readonly write: (
    scope: string,
    commandKey: string,
    receipt: unknown,
  ) => Effect.Effect<void, CommandReceiptStoreFailure>;
}

const receiptName = (scope: string, commandKey: string): string => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(`${scope}\0${commandKey}`);
    return `${hasher.digest("hex")}.json`;
  },
  zFilesystemCommandReceiptStore = (root: string): CommandReceiptStore => ({
    read: (scope, commandKey) => {
      const path = `${root}/${receiptName(scope, commandKey)}`,
        pathFile = Bun.file(path);
      return Effect.tryPromise({
        catch: (cause) =>
          CommandReceiptStoreFailure.make({ cause, message: "Command receipt lookup failed" }),
        try: () => pathFile.exists(),
      }).pipe(
        Effect.flatMap((exists) => {
          if (!exists) {
            return Effect.void;
          }
          return Effect.tryPromise({
            catch: (cause) =>
              CommandReceiptStoreFailure.make({ cause, message: "Command receipt read failed" }),
            try: () => pathFile.json().then((receipt: unknown) => receipt),
          });
        }),
      );
    },
    write: (scope, commandKey, receipt) => {
      const path = `${root}/${receiptName(scope, commandKey)}`,
        stagePath = `${path}.${Bun.randomUUIDv7()}.stage`;
      return Effect.tryPromise({
        catch: (cause) =>
          CommandReceiptStoreFailure.make({ cause, message: "Command receipt write failed" }),
        try: () =>
          Bun.$`mkdir -p ${root}`
            .quiet()
            .then(() => Bun.write(stagePath, `${JSON.stringify(receipt)}\n`))
            .then(() => Bun.$`mv ${stagePath} ${path}`.quiet()),
      }).pipe(
        Effect.tapError(() =>
          Effect.promise(() => Bun.$`rm -f ${stagePath}`.quiet()).pipe(Effect.ignore),
        ),
        Effect.asVoid,
      );
    },
  }),
  zMemoryCommandReceiptStore = (): CommandReceiptStore => {
    const receipts = new Map<string, unknown>();
    return {
      read: (scope, commandKey) => Effect.succeed(receipts.get(`${scope}\0${commandKey}`)),
      write: (scope, commandKey, receipt) =>
        Effect.sync(() => {
          receipts.set(`${scope}\0${commandKey}`, structuredClone(receipt));
        }),
    };
  };

/** Effect-native command receipt stores for durable and in-memory operation replay. */
export {
  zFilesystemCommandReceiptStore as filesystemCommandReceiptStore,
  zMemoryCommandReceiptStore as memoryCommandReceiptStore,
};
