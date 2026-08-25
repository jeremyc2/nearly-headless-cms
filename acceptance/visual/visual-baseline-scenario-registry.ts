import {
  type VisualBaselineScenario,
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
} from "./visual-baseline-scenarios.ts";

const interactiveVisualBaselineScenarios: readonly VisualBaselineScenario[] = [
    {
      name: "example-cms-post-editor",
      prepare: preparePostEditor,
      ready: "document.querySelector('h1')?.textContent === 'A Lighthouse for Content'",
    },
    {
      name: "example-cms-moderation-queue",
      prepare: prepareModerationQueue,
      ready:
        "document.querySelectorAll('.entry-row').length >= 1 && document.querySelector('.entry-row')?.textContent?.includes('pending') === true",
    },
    {
      name: "example-cms-validation",
      prepare: prepareDraftValidation,
      ready: "document.querySelector('.issue-summary') !== null",
    },
    {
      name: "example-cms-history",
      prepare: preparePostHistory,
      ready: "document.querySelectorAll('.history-panel .revision-row').length >= 1",
    },
    {
      name: "example-cms-conflict",
      prepare: prepareConflictPanel,
      ready: "document.querySelector('.conflict-panel') !== null",
    },
    {
      name: "public-blog-comment-validation",
      prepare: prepareCommentValidation,
      ready: "document.querySelector('[data-error-summary]:not([hidden])') !== null",
    },
    {
      name: "public-blog-comment-success",
      prepare: prepareCommentSuccess,
      ready:
        "document.querySelector('[data-comment-status]')?.textContent === 'Comment entry-visual-baseline is pending moderation.'",
    },
  ],
  staticVisualBaselineScenarios: readonly VisualBaselineScenario[] = [
    {
      name: "example-cms-overview",
      prepare: prepareOverview,
      ready:
        "document.querySelectorAll('.signal-card').length === 4 && document.querySelectorAll('.recent-panel .entry-row').length >= 5",
    },
    {
      name: "public-blog-home",
      prepare: preparePublicBlogHome,
      ready: "document.querySelectorAll('.post-card').length > 0",
    },
    {
      name: "public-blog-post",
      prepare: preparePublicBlogPost,
      ready: "document.querySelector('h1')?.textContent === 'A Lighthouse for Content'",
    },
  ],
  visualBaselineScenarios: readonly VisualBaselineScenario[] = [
    ...staticVisualBaselineScenarios,
    ...interactiveVisualBaselineScenarios,
  ];

export { visualBaselineScenarios };
