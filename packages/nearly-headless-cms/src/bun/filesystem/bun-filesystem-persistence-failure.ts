import type { InfrastructureFailureKind } from "../../cms-error/infrastructure-failure.ts";

const errorCodeKinds = new Map<string, InfrastructureFailureKind>([
    ["EACCES", "permission"],
    ["EAGAIN", "transientIo"],
    ["EBUSY", "transientIo"],
    ["EDQUOT", "capacity"],
    ["EIO", "transientIo"],
    ["EMFILE", "transientIo"],
    ["ENFILE", "transientIo"],
    ["ENOSPC", "capacity"],
    ["EPERM", "permission"],
    ["EROFS", "permission"],
    ["ETIMEDOUT", "transientIo"],
  ]),
  filesystemErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }
    if (typeof error.code === "string") {
      return error.code;
    }
    return undefined;
  },
  filesystemFailureKind = (
    cause: unknown,
    message: string,
  ): InfrastructureFailureKind | undefined => {
    const errorCode = filesystemErrorCode(cause),
      normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes("corrupt")) {
      return "corruption";
    }
    if (normalizedMessage.includes("capability")) {
      return "unsupportedCapability";
    }
    if (errorCode === undefined) {
      return undefined;
    }
    return errorCodeKinds.get(errorCode);
  };

export default { filesystemErrorCode, filesystemFailureKind };
