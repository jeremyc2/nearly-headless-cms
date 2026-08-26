import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import type { ContentDefinition } from "nearly-headless-cms";
import { Layer } from "effect";
import { forStorageRoot } from "./identifiers.ts";

/** Filesystem persistence rooted under the example CMS data directory. */
export const layer = ({
  definitionSnapshot,
  root,
  storageRoot,
}: {
  readonly definitionSnapshot: ContentDefinition.CompiledSnapshot;
  readonly root: string;
  readonly storageRoot: string | undefined;
}) =>
  BunFilesystemPersistence.cmsLayer({
    acknowledgement: "durable",
    definitionSnapshot,
    root,
  }).pipe(Layer.provide(forStorageRoot(storageRoot)));
