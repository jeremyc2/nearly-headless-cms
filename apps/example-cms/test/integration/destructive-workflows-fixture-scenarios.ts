import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";
import {
  createTemporaryStorageRoot,
  removeStorageRoot,
} from "./headless-api-support.ts";

export interface DestructiveWorkflowsFixture {
  readonly dispose: () => Promise<void>;
  readonly storageRoot: string;
  readonly system: ExampleSystem;
}

// Bun lifecycle hooks require async callbacks for native Request and Response promises.
// oxlint-disable-next-line effecttsgo/async-function -- fixture setup intentionally awaits native filesystem and CMS startup.
const createDestructiveWorkflowsFixture = async (
  testDirectory: string,
): Promise<DestructiveWorkflowsFixture> => {
    const storageRoot = await createTemporaryStorageRoot(testDirectory),
      system = await createExampleSystem({ seed: true, storageRoot });
    return {
      // oxlint-disable-next-line effecttsgo/async-function -- fixture teardown awaits native filesystem cleanup.
      dispose: async () => {
        await system.dispose();
        await removeStorageRoot(storageRoot);
      },
      storageRoot,
      system,
    };
  };

export { createDestructiveWorkflowsFixture };
