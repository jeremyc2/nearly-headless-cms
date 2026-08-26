import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";
import { createTemporaryStorageRoot, removeStorageRoot } from "./headless-api-support.ts";

export interface HeadlessApiFixture {
  readonly dispose: () => Promise<void>;
  readonly storageRoot: string;
  readonly system: ExampleSystem;
}

// Bun's test runner requires an async callback for the native Request and Response promises.
// oxlint-disable-next-line effecttsgo/async-function -- [EH-023] fixture setup intentionally awaits native filesystem and CMS startup.
const createHeadlessApiFixture = async (testDirectory: string): Promise<HeadlessApiFixture> => {
    const storageRoot = await createTemporaryStorageRoot(testDirectory),
      system = await createExampleSystem({ seed: true, storageRoot });
    return {
      // Bun lifecycle hooks require a Promise-returning dispose callback.
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-024] fixture teardown awaits native filesystem cleanup.
      dispose: async () => {
        await system.dispose();
        await removeStorageRoot(storageRoot);
      },
      storageRoot,
      system,
    };
  },
  disposeHeadlessApiFixture = (fixture: HeadlessApiFixture): Promise<void> => fixture.dispose();

export { createHeadlessApiFixture, disposeHeadlessApiFixture };
