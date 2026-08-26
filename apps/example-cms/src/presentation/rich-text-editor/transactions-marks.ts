import type { RichText } from "nearly-headless-cms";
import type { State } from "./transactions-types.ts";
import transactionsSelection from "./transactions-selection.ts";
import transactionsSupport from "./transactions-support.ts";

const { selectedText } = transactionsSelection,
  { canonicalMarks } = transactionsSupport,
  marksAtCursor = (state: State): readonly RichText.Mark[] => {
    const selected = selectedText(state);
    return selected?.text.marks ?? [];
  },
  marksForNextInput = (state: State): readonly RichText.Mark[] => {
    if (state.storedMarks !== null) {
      return state.storedMarks;
    }
    return marksAtCursor(state);
  },
  toggleMarkInSet = (
    marks: readonly RichText.Mark[],
    mark: RichText.Mark,
  ): readonly RichText.Mark[] => {
    if (marks.includes(mark)) {
      return canonicalMarks(marks.filter((candidate) => candidate !== mark));
    }
    return canonicalMarks([...marks, mark]);
  };

export default { marksAtCursor, marksForNextInput, toggleMarkInSet };
