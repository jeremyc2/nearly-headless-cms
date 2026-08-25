const cmsOrigin = "http://localhost:3000",
  definitionSpaceIdentifier = "example-blog",
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  jsonRecord = (response: Response): Promise<Readonly<Record<string, unknown>>> =>
    response.json().then((body: unknown) => {
      if (!isRecord(body)) {
        throw new TypeError("Expected a JSON object");
      }
      return body;
    }),
  managementEntryUrl = (contentTypeIdentifier: string, entryIdentifier: string): string =>
    `${cmsOrigin}/api/v1/management/definition-spaces/${definitionSpaceIdentifier}/content-types/${contentTypeIdentifier}/entries/${entryIdentifier}`,
  managementQueryUrl = (contentTypeIdentifier: string): string =>
    `${cmsOrigin}/api/v1/management/definition-spaces/${definitionSpaceIdentifier}/content-types/${contentTypeIdentifier}/entries/query`,
  managementStateUrl = (contentTypeIdentifier: string, entryIdentifier: string): string =>
    `${managementEntryUrl(contentTypeIdentifier, entryIdentifier)}/state`,
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-319, EH-330] visual baseline setup queries the live Example CMS management API.
  queryEntryIdentifierBySlug = async (
    contentTypeIdentifier: string,
    slug: string,
  ): Promise<string> => {
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-322] visual baseline setup queries the live Example CMS management API.
    const response = await fetch(managementQueryUrl(contentTypeIdentifier), {
      body: JSON.stringify({
        pageSize: 1,
        where: { operator: "equals", path: "slug", value: slug },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Entry query failed for slug ${slug}`);
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-325] query response body and first item are parsed together after the status guard.
    const body = await jsonRecord(response),
      [entry] = readRecordArray(body, "items");
    if (entry === undefined) {
      throw new Error(`No entry found for slug ${slug}`);
    }
    return readStringField(entry, "id");
  },
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-320, EH-331] visual baseline setup reads the live Example CMS management API.
  readEntryState = async (
    contentTypeIdentifier: string,
    entryIdentifier: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-323] visual baseline setup reads the live Example CMS management API.
    const response = await fetch(managementStateUrl(contentTypeIdentifier, entryIdentifier));
    if (!response.ok) {
      throw new Error(`Entry state read failed for ${entryIdentifier}`);
    }
    return jsonRecord(response);
  },
  readEntryValuesFromState = (
    state: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> => {
    const { entry } = state;
    if (!isRecord(entry) || !isRecord(entry["values"])) {
      throw new TypeError("Expected entry values");
    }
    return entry["values"];
  },
  readRecordArray = (
    record: Readonly<Record<string, unknown>>,
    key: string,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const value = record[key];
    if (!Array.isArray(value) || !value.every((item) => isRecord(item))) {
      throw new TypeError(`Expected record array field ${key}`);
    }
    return value;
  },
  readStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  readWriteToken = (state: Readonly<Record<string, unknown>>): string =>
    readStringField(state, "writeToken"),
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-321, EH-332] visual baseline setup writes through the live Example CMS management API.
  replaceEntryValues = async (input: {
    readonly contentTypeIdentifier: string;
    readonly entryIdentifier: string;
    readonly values: Readonly<Record<string, unknown>>;
    readonly writeToken: string;
  }): Promise<void> => {
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-324] visual baseline setup writes through the live Example CMS management API.
    const response = await fetch(
      managementEntryUrl(input.contentTypeIdentifier, input.entryIdentifier),
      {
        body: JSON.stringify({ values: input.values }),
        headers: {
          "cms-write-token": input.writeToken,
          "content-type": "application/json",
        },
        method: "PUT",
      },
    );
    if (!response.ok) {
      throw new Error(`Entry replace failed for ${input.entryIdentifier}`);
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-326, EH-329] interactive visual scenarios reset mutated Example CMS fixture entries.
  restorePublishedLighthousePost = async (): Promise<void> => {
    const entryIdentifier = await queryEntryIdentifierBySlug("post", "a-lighthouse-for-content"),
      state = await readEntryState("post", entryIdentifier),
      values = readEntryValuesFromState(state);
    if (values["title"] === "A Lighthouse for Content") {
      return;
    }
    await replaceEntryValues({
      contentTypeIdentifier: "post",
      entryIdentifier,
      values: { ...values, title: "A Lighthouse for Content" },
      writeToken: readWriteToken(state),
    });
  };

export {
  queryEntryIdentifierBySlug,
  readEntryState,
  readEntryValuesFromState,
  readWriteToken,
  replaceEntryValues,
  restorePublishedLighthousePost,
};
