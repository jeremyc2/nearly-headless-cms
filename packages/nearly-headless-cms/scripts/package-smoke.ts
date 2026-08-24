import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = join(import.meta.dir, "..", "..", ".."),
  archivePath = resolve(
    Bun.env["PACKAGE_ARCHIVE"] ??
      join(repository, ".artifacts", "npm", "nearly-headless-cms-0.1.0.tgz"),
  );
if (!(await Bun.file(archivePath).exists())) {
  throw new Error(`Package archive does not exist: ${archivePath}`);
}
const consumerDirectory = await mkdtemp(join(tmpdir(), "nearly-headless-cms-consumer-"));
await Bun.write(
  join(consumerDirectory, "package.json"),
  `${JSON.stringify({ dependencies: { effect: "4.0.0-rc.111", "nearly-headless-cms": `file:${archivePath}`, typescript: "7.0.2" }, private: true, type: "module" }, null, 2)}\n`,
);
const install = Bun.spawn(["bun", "install", "--ignore-scripts"], {
  cwd: consumerDirectory,
  stderr: "inherit",
  stdout: "inherit",
});
if ((await install.exited) !== 0) {
  throw new Error("Clean consumer installation failed");
}
const portableConsumer = `import { Cms, ContentDefinition } from "nearly-headless-cms"; import { HttpTransport } from "nearly-headless-cms/http"; import { MemoryEntryPersistence } from "nearly-headless-cms/adapters"; import { DevelopmentCms } from "nearly-headless-cms/testing"; console.log(Boolean(Cms.Service && ContentDefinition.compile && HttpTransport.makeHandler && MemoryEntryPersistence.layer && DevelopmentCms.layer));\n`,
  typeConsumer = `import { Cms, ContentDefinition } from "nearly-headless-cms"; import { HttpTransport } from "nearly-headless-cms/http"; import { MemoryEntryPersistence } from "nearly-headless-cms/adapters"; import { DevelopmentCms } from "nearly-headless-cms/testing"; void [Cms, ContentDefinition, HttpTransport, MemoryEntryPersistence, DevelopmentCms];\n`,
  bunConsumer = `import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem"; console.log(Boolean(BunFilesystemPersistence.layer));\n`;
await Bun.write(join(consumerDirectory, "portable.mjs"), portableConsumer);
await Bun.write(join(consumerDirectory, "filesystem.mjs"), bunConsumer);
await Bun.write(join(consumerDirectory, "consumer.ts"), typeConsumer);
await Bun.write(
  join(consumerDirectory, "tsconfig.json"),
  `${JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", noEmit: true, skipLibCheck: true, strict: true, target: "ES2023" }, include: ["consumer.ts"] }, null, 2)}\n`,
);
for (const command of [
  ["bun", "portable.mjs"],
  ["node", "portable.mjs"],
  ["bun", "filesystem.mjs"],
  ["bunx", "tsc", "-p", "tsconfig.json"],
]) {
  const process = Bun.spawn(command, {
    cwd: consumerDirectory,
    stderr: "inherit",
    stdout: "inherit",
  });
  if ((await process.exited) !== 0) {
    throw new Error(`Clean consumer smoke failed: ${command.join(" ")}`);
  }
}
console.log(`Package smoke passed for ${archivePath}`);
