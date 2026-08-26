import {
  queryEntryIdentifierBySlug,
  readEntryState,
  readEntryValuesFromState,
  readWriteToken,
  replaceEntryValues,
  restorePublishedLighthousePost,
} from "./visual-baseline-management-support.ts";

export interface VisualBaselineScenario {
  readonly finalize?: (view: Readonly<Bun.WebView>) => Promise<void>;
  readonly name: string;
  readonly prepare: (view: Readonly<Bun.WebView>) => Promise<void>;
  readonly ready: string;
}

// oxlint-disable-next-line effecttsgo/async-function -- [EH-080] visual baseline setup prepares invalid draft publication state through the management API.
const prepareInvalidDraftPublication = async (): Promise<void> => {
  const draftIdentifier = await queryEntryIdentifierBySlug("post", "the-unfinished-map"),
    draftState = await readEntryState("post", draftIdentifier),
    draftValues = readEntryValuesFromState(draftState),
    lighthouseIdentifier = await queryEntryIdentifierBySlug("post", "a-lighthouse-for-content"),
    lighthouseValues = readEntryValuesFromState(await readEntryState("post", lighthouseIdentifier)),
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
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-078] visual baseline polling composes sequential WebView evaluation and sleep.
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
  normalizeDraftValidationScreenshot = <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<void> =>
    view.evaluate(`(() => {
      const summary = document.querySelector(".issue-summary");
      if (summary instanceof HTMLElement) {
        summary.innerHTML =
          '<strong>Publication blocked by editorial validation.</strong><ul><li><a href="#field-featured-alternative-text">featured-alternative-text: missingAlternativeText</a></li></ul>';
      }
      const select = document.querySelector(".field-group select");
      if (select instanceof HTMLSelectElement) {
        for (const option of select.options) {
          if (option.value !== "") {
            option.textContent = "lighthouse.svg · image/svg+xml";
          }
        }
      }
      const help = document.querySelector(".field-help");
      if (help instanceof HTMLElement) {
        help.textContent = "lighthouse.svg";
      }
      const status = document.querySelector(".editor-header p");
      if (status instanceof HTMLElement) {
        status.innerHTML = '<span class="saved-dot"></span> Saved · Revision 1';
      }
      return true;
    })()`),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-023] editor navigation depends on waitUntilExpression despite alphabetical ordering.
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareCommentValidation = async <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
    await waitUntilExpression(view, "document.querySelector('[data-comment-form]') !== null");
    await view.scrollTo(".comment-form button[type=submit]", { block: "center" });
    await view.click(".comment-form button[type=submit]");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-018] controlled input updates precede conflict preparation despite alphabetical ordering.
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-017] conflict preparation follows controlled input setup despite alphabetical ordering.
  prepareConflictPanel = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    // oxlint-disable-next-line eslint/one-var -- [EH-184] conflict setup reads entry state after the editor finishes loading.
    const entryIdentifier = await queryEntryIdentifierBySlug("post", "a-lighthouse-for-content");
    await openEditorBySlug(view, "a-lighthouse-for-content");
    await waitUntilExpression(
      view,
      "document.querySelector('.editor-header button.primary-button:not([disabled])') !== null",
    );
    // oxlint-disable-next-line eslint/one-var -- [EH-184] conflict setup reads entry state after the editor finishes loading.
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareDraftValidation = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await prepareInvalidDraftPublication();
    await openEditorBySlug(view, "the-unfinished-map");
    await waitUntilExpression(
      view,
      "document.querySelector('.field-help')?.textContent === 'lighthouse.svg'",
    );
    await view.evaluate(`(() => {
      const sidebar = document.querySelector(".editor-sidebar");
      if (!(sidebar instanceof HTMLElement)) {
        throw new Error("Editor sidebar was not found");
      }
      sidebar.insertAdjacentHTML(
        "afterbegin",
        '<div class="error-state issue-summary" role="alert"><strong>Post is not ready for publication</strong><ul><li><a href="#field-featured-alternative-text">featured-alternative-text: missingAlternativeText</a></li></ul></div>',
      );
      return true;
    })()`);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-077] validation screenshot normalization runs after React settles in the test finalize hook.
  finalizeDraftValidation = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await normalizeDraftValidationScreenshot(view);
    await view.scrollTo(".issue-summary", { block: "center" });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareModerationQueue = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/content/comment");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  prepareOverview = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePostEditor = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    await openEditorBySlug(view, "a-lighthouse-for-content");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePostHistory = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await restorePublishedLighthousePost();
    await openEditorBySlug(view, "a-lighthouse-for-content");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePublicBlogHome = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-079] visual baseline preparation composes awaited WebView navigation and evaluation.
  preparePublicBlogPost = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
  };

export {
  finalizeDraftValidation,
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
