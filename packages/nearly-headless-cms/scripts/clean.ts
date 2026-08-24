import { $ } from "bun";

const distributionDirectory = `${import.meta.dir}/../dist`;
await $`rm -rf ${distributionDirectory}`;
