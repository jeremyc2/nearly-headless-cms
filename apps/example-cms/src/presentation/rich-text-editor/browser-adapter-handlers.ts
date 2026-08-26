import type { Command } from "./transactions-types.ts";
import type { ReadonlyInputEvent, ReadonlyKeyboardEvent } from "./readonly-dom-types.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";

const { beforeInputCommand, metaKeyEditorAction } = transactionsEditorAdapterSupport,
  isDeleteCommand = (
    command: ReturnType<typeof beforeInputCommand>,
  ): command is Extract<Command, { type: "deleteBackward" | "deleteForward" }> =>
    command?.type === "deleteBackward" || command?.type === "deleteForward",
  shouldConsumeDuplicateDeleteInput = (
    command: ReturnType<typeof beforeInputCommand>,
    deleteKeyHandled: boolean,
  ): boolean => isDeleteCommand(command) && deleteKeyHandled,
  consumeDuplicateDeleteInput = (input: {
    readonly clearDeleteHandled: () => void;
    readonly command: ReturnType<typeof beforeInputCommand>;
    readonly deleteKeyHandled: boolean;
    readonly event: ReadonlyInputEvent;
  }): boolean => {
    if (!shouldConsumeDuplicateDeleteInput(input.command, input.deleteKeyHandled)) {
      return false;
    }
    input.clearDeleteHandled();
    input.event.preventDefault();
    return true;
  },
  dispatchBeforeInputCommand = (input: {
    readonly command: Command;
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyInputEvent;
  }): void => {
    input.event.preventDefault();
    input.dispatch(input.command);
  },
  applyBrowserBeforeInput = (input: {
    readonly clearDeleteHandled: () => void;
    readonly composing: boolean;
    readonly deleteKeyHandled: boolean;
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyInputEvent;
    readonly synchronizeSelection: () => void;
  }): void => {
    if (input.composing) {
      return;
    }
    input.synchronizeSelection();
    const command = beforeInputCommand(input.event);
    if (
      consumeDuplicateDeleteInput({
        clearDeleteHandled: input.clearDeleteHandled,
        command,
        deleteKeyHandled: input.deleteKeyHandled,
        event: input.event,
      })
    ) {
      return;
    }
    if (command === undefined) {
      return;
    }
    dispatchBeforeInputCommand({
      command,
      dispatch: input.dispatch,
      event: input.event,
    });
  },
  handleDeleteKeyboardEvent = (event: ReadonlyKeyboardEvent): Command | undefined => {
    if (event.key === "Backspace") {
      return { type: "deleteBackward" };
    }
    if (event.key === "Delete") {
      return { type: "deleteForward" };
    }
    return undefined;
  },
  applyBrowserMetaKeyDown = (input: {
    readonly action: NonNullable<ReturnType<typeof metaKeyEditorAction>>;
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyKeyboardEvent;
    readonly onRequestLink: (() => void) | undefined;
  }): void => {
    input.event.preventDefault();
    if ("command" in input.action) {
      input.dispatch(input.action.command);
      return;
    }
    input.onRequestLink?.();
  },
  tryBrowserDeleteKeyDown = (input: {
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyKeyboardEvent;
    readonly markDeleteHandled: () => void;
  }): boolean => {
    const deleteCommand = handleDeleteKeyboardEvent(input.event);
    if (deleteCommand === undefined) {
      return false;
    }
    input.event.preventDefault();
    input.markDeleteHandled();
    input.dispatch(deleteCommand);
    return true;
  },
  tryBrowserMetaKeyDown = (input: {
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyKeyboardEvent;
    readonly onRequestLink: (() => void) | undefined;
  }): boolean => {
    if (!input.event.metaKey) {
      return false;
    }
    const action = metaKeyEditorAction(input.event);
    if (action === undefined) {
      return false;
    }
    applyBrowserMetaKeyDown({
      action,
      dispatch: input.dispatch,
      event: input.event,
      onRequestLink: input.onRequestLink,
    });
    return true;
  },
  applyBrowserKeyDown = (input: {
    readonly dispatch: (command: Command) => void;
    readonly event: ReadonlyKeyboardEvent;
    readonly markDeleteHandled: () => void;
    readonly onRequestLink: (() => void) | undefined;
    readonly synchronizeSelection: () => void;
  }): boolean => {
    input.synchronizeSelection();
    if (tryBrowserDeleteKeyDown(input)) {
      return true;
    }
    return tryBrowserMetaKeyDown(input);
  };

export default {
  applyBrowserBeforeInput,
  applyBrowserKeyDown,
  beforeInputCommand,
  shouldConsumeDuplicateDeleteInput,
};
