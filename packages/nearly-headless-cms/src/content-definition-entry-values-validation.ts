import type {
  CompiledContentType,
  CustomFieldRegistration,
  JsonObject,
  ValidateEntryOptions,
} from "./content-definition-types.ts";
import entryValidation from "./content-definition-entry-validation.ts";
import { isJsonValue } from "./internal/json.ts";
import validationSupport from "./content-definition-validation-support.ts";

const { createValidationIssue, emptyLength, failValidation } = validationSupport,
  { validateFields } = entryValidation,
  validateEntryValues = ({
    contentTypeId,
    contentTypes,
    customRegistrations,
    validateOptions,
    values,
  }: {
    readonly contentTypeId: string;
    readonly contentTypes: ReadonlyMap<string, CompiledContentType>;
    readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
    readonly validateOptions: ValidateEntryOptions;
    readonly values: JsonObject;
  }): JsonObject => {
    const compiledContentType = contentTypes.get(contentTypeId),
      validated = ((): ReturnType<typeof validateFields> => {
        if (compiledContentType === undefined) {
          return failValidation("Unknown Content Type", [
            createValidationIssue(
              ["contentTypeId"],
              "unknownContentType",
              `Content Type ${contentTypeId} does not exist`,
            ),
          ]);
        }
        if (!isJsonValue(values) || values === null || Array.isArray(values)) {
          return failValidation("Invalid Entry values", [
            createValidationIssue(
              ["values"],
              "expectedObject",
              "Entry values must be a JSON-compatible object",
            ),
          ]);
        }
        return validateFields({
          customRegistrations,
          fields: compiledContentType.fields,
          parentPath: [],
          validateOptions,
          values,
        });
      })(),
      validationIssues = validated.issues;
    if (validationIssues.length > emptyLength) {
      failValidation("Entry validation failed", validationIssues);
    }
    return validated.result;
  };

export default { validateEntryValues };
