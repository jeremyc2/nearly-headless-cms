import type { QuerySnapshotInput, SnapshotEntry } from "./delivery-public-content-types.ts";
import { EntryQuery } from "nearly-headless-cms";

const evaluateSnapshotQueryPage = <
    Input extends QuerySnapshotInput & { readonly cursor: string | undefined },
  >(
    input: Readonly<Input>,
  ): EntryQuery.QueryPage => {
    const { consistentSnapshot, contentTypeId, cursor, sort, where } = input,
      query = {
        contentTypeId,
        cursor,
        pageSize: 100,
      } as {
        contentTypeId: string;
        cursor: string | undefined;
        pageSize: number;
        sort?: QuerySnapshotInput["sort"];
        where?: QuerySnapshotInput["where"];
      };
    if (sort !== undefined) {
      query.sort = sort;
    }
    if (where !== undefined) {
      query.where = where;
    }
    return EntryQuery.evaluate({
      entries: consistentSnapshot.entries,
      options: { generation: consistentSnapshot.generation },
      query,
      snapshot: consistentSnapshot.definitionSnapshot,
    });
  },
  querySnapshot = <Input extends QuerySnapshotInput>(
    input: Readonly<Input>,
  ): readonly SnapshotEntry[] => {
    const { consistentSnapshot, contentTypeId, sort, where } = input,
      entries: SnapshotEntry[] = [];
    let cursor: string | undefined = undefined;
    do {
      const page: EntryQuery.QueryPage = evaluateSnapshotQueryPage({
        consistentSnapshot,
        contentTypeId,
        cursor,
        sort,
        where,
      });
      entries.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    return entries;
  };

export default {
  querySnapshot,
};
