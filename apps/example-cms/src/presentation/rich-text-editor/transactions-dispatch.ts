import type { Command, State } from "./transactions-types.ts";
import transactionsCommandHandlers from "./transactions-command-handlers.ts";
import transactionsListCommandHandlers from "./transactions-list-command-handlers.ts";

const commandHandlers = {
    ...transactionsCommandHandlers,
    ...transactionsListCommandHandlers,
  },
  dispatchHistoryCommand = (
    state: State,
    command: Extract<Command, { type: "redo" | "undo" }>,
  ): State => {
    if (command.type === "undo") {
      return commandHandlers.applyUndo(state);
    }
    return commandHandlers.applyRedo(state);
  },
  dispatchInsertCommand = (
    state: State,
    command: Extract<
      Command,
      { type: "insertAssetReference" | "insertEntryReference" | "insertText" }
    >,
  ): State => {
    if (command.type === "insertText") {
      return commandHandlers.applyInsertText(state, command);
    }
    if (command.type === "insertEntryReference") {
      return commandHandlers.applyInsertEntryReference(state, command);
    }
    return commandHandlers.applyInsertAssetReference(state, command);
  },
  dispatchMarkupCommand = (
    state: State,
    command: Extract<
      Command,
      { type: "select" | "setBlockKind" | "toggleList" | "toggleMark" | "wrapLink" }
    >,
  ): State => {
    if (command.type === "select") {
      return commandHandlers.applySelect(state, command);
    }
    if (command.type === "setBlockKind") {
      return commandHandlers.applySetBlockKind(state, command);
    }
    if (command.type === "toggleList") {
      return commandHandlers.applyToggleList(state, command);
    }
    if (command.type === "toggleMark") {
      return commandHandlers.applyToggleMark(state, command);
    }
    return commandHandlers.applyWrapLink(state, command);
  },
  dispatchStatelessCommand = (
    state: State,
    command: Extract<Command, { type: "deleteBackward" | "deleteForward" | "splitBlock" }>,
  ): State => {
    if (command.type === "deleteBackward") {
      return commandHandlers.applyDeleteBackward(state);
    }
    if (command.type === "deleteForward") {
      return commandHandlers.applyDeleteForward(state);
    }
    return commandHandlers.applySplitBlock(state);
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-122] editor transaction API is intentionally a direct two-argument operation.
  transact = (state: State, command: Command): State => {
    switch (command.type) {
      case "composition": {
        return commandHandlers.applyComposition(state, command);
      }
      case "deleteBackward":
      case "deleteForward":
      case "splitBlock": {
        return dispatchStatelessCommand(state, command);
      }
      case "insertAssetReference":
      case "insertEntryReference":
      case "insertText": {
        return dispatchInsertCommand(state, command);
      }
      case "redo":
      case "undo": {
        return dispatchHistoryCommand(state, command);
      }
      case "select":
      case "setBlockKind":
      case "toggleList":
      case "toggleMark":
      case "wrapLink": {
        return dispatchMarkupCommand(state, command);
      }
    }
    return state;
  };

export { transact };
