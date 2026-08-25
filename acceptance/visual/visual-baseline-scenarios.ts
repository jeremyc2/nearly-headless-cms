import {
  queryEntryIdentifierBySlug,
  readEntryState,
  readEntryValuesFromState,
  readWriteToken,
  replaceEntryValues,
  restorePublishedLighthousePost,
} from "./visual-baseline-management-support.ts";

export interface VisualBaselineScenario {
  readonly name: string;
  readonly prepare: (view: Readonly<Bun.WebView>) => Promise<void>;
  readonly ready: string;
}

// oxlint-disable-next-line effecttsgo/async-function -- [EH-334] visual baseline setup prepares invalid draft publication state through the management API.
const prepareInvalidDraftPublication = async (): Promise<void> => {
  // oxlint-disable-next-line eslint/sort-vars -- [EH-337] draft identifiers are resolved before lighthouse fixture values are copied.
  const draftIdentifier = await queryEntryIdentifierBySlug("post", "the-unfinished-map"),
    draftState = await readEntryState("post", draftIdentifier),
    draftValues = readEntryValuesFromState(draftState),
    lighthouseIdentifier = await queryEntryIdentifierBySlug("post", "a-lighthouse-for-content"),
    lighthouseValues = readEntryValuesFromState(await readEntryState("post", lighthouseIdentifier)),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-342] featured asset selection follows lighthouse fixture lookup.
   featuredAsset = lighthouseValues["featured-asset"];
  if (typeof featuredAsset !== "string") {
    throw new TypeError("Expected lighthouse featured asset");
  }
  await replaceEntryValues({
    contentTypeIdentifier: "post",
    entryIdentifier: draftIdentifier,
    values: {
      ...draftValues,
      "featured-alternative-text": null,
      "featured-asset": featuredAsset,
      "published-at": null,
      status: "draft",
    },
    writeToken: readWriteToken(draftState),
  });
},

 settleTimeoutMilliseconds = 15_000,
  waitPollingIntervalMilliseconds = 50,
  waitUntilExpression = <View extends Bun.WebView>(
    view: Readonly<View>,
    expression: string,
  ): Promise<void> => {
    const deadline = performance.now() + settleTimeoutMilliseconds,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-328] visual baseline polling composes sequential WebView evaluation and sleep.
      poll = async (): Promise<void> => {
        if (performance.now() >= deadline) {
          throw new Error(`Visual prepare timed out: ${expression}`);
        }
        if (await view.evaluate<boolean>(expression)) {
          return;
        }
        await Bun.sleep(waitPollingIntervalMilliseconds);
        return poll();
      };
    return poll();
  },
  // oxlint-disable-next-line effecttsgo/async-function, eslint/sort-vars -- [EH-339, EH-341] editor navigation depends on waitUntilExpression despite alphabetical ordering.
  openEditorBySlug = async <View extends Bun.WebView>(
    view: Readonly<View>,
    slug: string,
  ): Promise<void> => {
    const entryIdentifier = await queryEntryIdentifierBySlug("post", slug);
    await view.navigate(`http://localhost:3000/content/post/${entryIdentifier}`);
    await waitUntilExpression(
      view,
      "document.querySelector('.editor-layout') !== null && location.pathname.startsWith('/content/post/')",
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareCommentSuccess = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
    await waitUntilExpression(view, "document.querySelector('[data-comment-form]') !== null");
    await waitUntilExpression(
      view,
      `(() => {
        const form = document.querySelector("[data-comment-form]");
        if (!(form instanceof HTMLFormElement)) {
          return false;
        }
        form.requestSubmit();
        const summary = form.querySelector("[data-error-summary]");
        return summary instanceof HTMLElement && summary.hidden === false;
      })()`,
    );
    await view.evaluate(`(() => {
      const form = document.querySelector("[data-comment-form]");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Comment form was not found");
      }
      const displayName = form.querySelector("input[name=displayName]");
      const body = form.querySelector("textarea[name=body]");
      if (!(displayName instanceof HTMLInputElement) || !(body instanceof HTMLTextAreaElement)) {
        throw new Error("Comment fields were not found");
      }
      displayName.value = "Baseline Reader";
      body.value = "A deterministic comment for visual baselines.";
      return true;
    })()`);
    await view.scrollTo(".comment-form button[type=submit]", { block: "center" });
    await view.click(".comment-form button[type=submit]");
    await waitUntilExpression(
      view,
      "document.querySelector('[data-comment-status]')?.textContent?.includes('pending moderation') === true",
    );
    await view.evaluate(`(() => {
      const status = document.querySelector("[data-comment-status]");
      if (status instanceof HTMLElement) {
        status.textContent = "Comment entry-visual-baseline is pending moderation.";
      }
      return true;
    })()`);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareCommentValidation = async <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
    await waitUntilExpression(view, "document.querySelector('[data-comment-form]') !== null");
    await view.scrollTo(".comment-form button[type=submit]", { block: "center" });
    await view.click(".comment-form button[type=submit]");
  },
  // oxlint-disable-next-line effecttsgo/async-function, eslint/sort-vars -- [EH-346, EH-347] controlled input updates precede conflict preparation despite alphabetical ordering.
  setControlledInputValue = async <View extends Bun.WebView>(
    view: Readonly<View>,
    selector: string,
    value: string,
  ): Promise<void> => {
    await view.evaluate(
      `(input => {
        const element = document.querySelector(input.selector);
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("Controlled input was not found");
        }
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        descriptor?.set?.call(element, input.value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })(${JSON.stringify({ selector, value })})`,
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function, eslint/sort-vars -- [EH-344, EH-345] conflict preparation follows controlled input setup despite alphabetical ordering.
  prepareConflictPanel = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    // oxlint-disable-next-line eslint/one-var -- [EH-335] conflict setup reads entry state after the editor finishes loading.
    const entryIdentifier = await queryEntryIdentifierBySlug("post", "a-lighthouse-for-content");
    await openEditorBySlug(view, "a-lighthouse-for-content");
    await waitUntilExpression(
      view,
      "document.querySelector('.editor-header button.primary-button:not([disabled])') !== null",
    );
    // oxlint-disable-next-line eslint/one-var -- [EH-335] conflict setup reads entry state after the editor finishes loading.
    const initialState = await readEntryState("post", entryIdentifier),
      staleWriteToken = readWriteToken(initialState),
      values = readEntryValuesFromState(initialState);
    await setControlledInputValue(view, ".story-canvas .field.full input", "Local draft title change");
    await replaceEntryValues({
      contentTypeIdentifier: "post",
      entryIdentifier,
      values: { ...values, title: "Server-side revision bump" },
      writeToken: staleWriteToken,
    });
    await view.click(".editor-header button.primary-button");
    await waitUntilExpression(view, "document.querySelector('.conflict-panel') !== null");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareDraftValidation = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await prepareInvalidDraftPublication();
    await openEditorBySlug(view, "the-unfinished-map");
    await view.scrollTo(".editor-sidebar button.full-button.primary-button", { block: "center" });
    await view.click(".editor-sidebar button.full-button.primary-button");
    await waitUntilExpression(view, "document.querySelector('.rich-dialog') !== null");
    await view.click(".rich-dialog button.primary-button");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareModerationQueue = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/content/comment");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareOverview = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePostEditor = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    await openEditorBySlug(view, "a-lighthouse-for-content");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePostHistory = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    await openEditorBySlug(view, "a-lighthouse-for-content");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePublicBlogHome = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-318] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePublicBlogPost = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
  };

export {
  prepareCommentSuccess,
  prepareCommentValidation,
  prepareConflictPanel,
  prepareDraftValidation,
  prepareModerationQueue,
  prepareOverview,
  preparePostEditor,
  preparePostHistory,
  preparePublicBlogHome,
  preparePublicBlogPost,
};
