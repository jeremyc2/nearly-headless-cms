interface SchemaContext {
  readonly definitions: Readonly<Record<string, unknown>>;
  readonly visitedReferences: ReadonlySet<string>;
}

interface FieldTypeInput {
  readonly context: SchemaContext;
  readonly name: string;
  readonly propertySchema: unknown;
  readonly required: ReadonlySet<string>;
}

interface SchemaRenderer {
  readonly additionalType: (value: unknown, context: SchemaContext) => string;
  readonly alternativeType: (
    alternatives: readonly unknown[],
    context: SchemaContext,
    delimiter: " & " | " | ",
  ) => string;
  readonly arrayValue: (value: unknown) => readonly unknown[] | null;
  readonly compositionType: (
    schema: Readonly<Record<string, unknown>>,
    context: SchemaContext,
  ) => string | null;
  readonly definitionsFor: (
    schema: Readonly<Record<string, unknown>>,
    context: SchemaContext,
  ) => Readonly<Record<string, unknown>>;
  readonly fieldType: (input: FieldTypeInput) => string;
  readonly literalType: (schema: Readonly<Record<string, unknown>>) => string | null;
  readonly localReferenceType: (reference: string, context: SchemaContext) => string;
  readonly namedScalarType: (typeName: unknown) => string | null;
  readonly objectType: (
    schema: Readonly<Record<string, unknown>>,
    context: SchemaContext,
  ) => string;
  readonly propertyName: (name: string) => string;
  readonly recordValue: (value: unknown) => Readonly<Record<string, unknown>>;
  readonly referenceType: (reference: string, context: SchemaContext) => string;
  readonly render: (schema: Readonly<Record<string, unknown>>, context?: SchemaContext) => string;
  readonly scalarType: (
    schema: Readonly<Record<string, unknown>>,
    context: SchemaContext,
  ) => string | null;
  readonly stringValues: (value: unknown) => readonly string[];
  readonly structuredType: (
    schema: Readonly<Record<string, unknown>>,
    context: SchemaContext,
  ) => string | null;
  readonly typeVariant: (
    schema: Readonly<Record<string, unknown>>,
    typeName: unknown,
  ) => Readonly<Record<string, unknown>>;
}

const emptyFieldCount = 0,
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  requireRecord = (value: unknown, description: string): Readonly<Record<string, unknown>> => {
    if (!isRecord(value)) {
      throw new Error(`OpenAPI generator expected ${description}`);
    }
    return value;
  },
  schemaRenderer: SchemaRenderer = {
    additionalType(value, context) {
      if (isRecord(value)) {
        return this.render(value, context);
      }
      return "unknown";
    },
    alternativeType(alternatives, context, delimiter) {
      return alternatives
        .map((alternative) => {
          if (!isRecord(alternative)) {
            return "unknown";
          }
          return this.render(alternative, context);
        })
        .join(delimiter);
    },
    arrayValue(value) {
      if (Array.isArray(value)) {
        return value.map((element: unknown) => element);
      }
      return null;
    },
    compositionType(schema, context) {
      const allOf = this.arrayValue(schema["allOf"]),
        anyOf = this.arrayValue(schema["anyOf"]),
        oneOf = this.arrayValue(schema["oneOf"]);
      if (oneOf !== null) {
        return this.alternativeType(oneOf, context, " | ");
      }
      if (anyOf !== null) {
        return this.alternativeType(anyOf, context, " | ");
      }
      if (allOf !== null) {
        return this.alternativeType(allOf, context, " & ");
      }
      return null;
    },
    definitionsFor(schema, context) {
      if (!isRecord(schema["$defs"])) {
        return context.definitions;
      }
      return { ...context.definitions, ...schema["$defs"] };
    },
    fieldType({ context, name, propertySchema, required }) {
      let optionalSuffix = "?",
        propertyType = "unknown";
      if (required.has(name)) {
        optionalSuffix = "";
      }
      if (isRecord(propertySchema)) {
        propertyType = this.render(propertySchema, context);
      }
      return `${this.propertyName(name)}${optionalSuffix}: ${propertyType}`;
    },
    literalType(schema) {
      const constant = schema["const"],
        enumeration = this.arrayValue(schema["enum"]);
      if (constant !== undefined) {
        return JSON.stringify(constant);
      }
      if (enumeration !== null) {
        return enumeration.map((value) => JSON.stringify(value)).join(" | ");
      }
      return null;
    },
    localReferenceType(reference, context) {
      if (context.visitedReferences.has(reference)) {
        return "unknown";
      }
      const localDefinitionPrefix = "#/$defs/";
      {
        const definitionName = reference.slice(localDefinitionPrefix.length);
        {
          const definition = context.definitions[definitionName];
          if (!isRecord(definition)) {
            return "unknown";
          }
          return this.render(definition, {
            definitions: context.definitions,
            visitedReferences: new Set([...context.visitedReferences, reference]),
          });
        }
      }
    },
    namedScalarType(typeName) {
      if (typeName === "string") {
        return "string";
      }
      if (typeName === "integer" || typeName === "number") {
        return "number";
      }
      if (typeName === "boolean") {
        return "boolean";
      }
      if (typeName === "null") {
        return "null";
      }
      return null;
    },
    objectType(schema, context) {
      const { additionalProperties } = schema,
        properties = this.recordValue(schema["properties"]),
        required = new Set(this.stringValues(schema["required"]));
      {
        const fields = Object.entries(properties).map(([name, propertySchema]) =>
          this.fieldType({ context, name, propertySchema, required }),
        );
        if (fields.length === emptyFieldCount && additionalProperties !== false) {
          return `Readonly<Record<string, ${this.additionalType(additionalProperties, context)}>>`;
        }
        {
          const objectType = `{ readonly ${fields.join("; readonly ")} }`;
          if (isRecord(additionalProperties)) {
            return `${objectType} & Readonly<Record<string, ${this.render(additionalProperties, context)}>>`;
          }
          return objectType;
        }
      }
    },
    propertyName(name) {
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name)) {
        return name;
      }
      return JSON.stringify(name);
    },
    recordValue(value) {
      if (isRecord(value)) {
        return value;
      }
      return {};
    },
    referenceType(reference, context) {
      const componentPrefix = "#/components/schemas/",
        localDefinitionPrefix = "#/$defs/";
      if (reference.startsWith(componentPrefix)) {
        return reference.slice(componentPrefix.length);
      }
      if (!reference.startsWith(localDefinitionPrefix)) {
        throw new Error(`OpenAPI generator cannot resolve ${reference}`);
      }
      return this.localReferenceType(reference, context);
    },
    render(schema, context) {
      const activeContext = context ?? { definitions: {}, visitedReferences: new Set() },
        definitions = this.definitionsFor(schema, activeContext),
        nestedContext = { definitions, visitedReferences: activeContext.visitedReferences },
        reference = schema["$ref"];
      if (typeof reference === "string") {
        return this.referenceType(reference, nestedContext);
      }
      {
        const compositionType = this.compositionType(schema, nestedContext),
          literalType = this.literalType(schema);
        if (compositionType !== null) {
          return compositionType;
        }
        if (literalType !== null) {
          return literalType;
        }
        return this.scalarType(schema, nestedContext) ?? "unknown";
      }
    },
    scalarType(schema, context) {
      const schemaTypeName = schema["type"],
        schemaTypeNames = this.arrayValue(schemaTypeName);
      if (schemaTypeNames !== null) {
        return schemaTypeNames
          .map((typeName) => this.render(this.typeVariant(schema, typeName), context))
          .join(" | ");
      }
      {
        const namedType = this.namedScalarType(schemaTypeName);
        if (namedType !== null) {
          return namedType;
        }
        return this.structuredType(schema, context);
      }
    },
    stringValues(value) {
      const values = this.arrayValue(value);
      if (values === null) {
        return [];
      }
      return values.filter((candidate): candidate is string => typeof candidate === "string");
    },
    structuredType(schema, context) {
      const { items } = schema,
        schemaTypeName = schema["type"];
      if (schemaTypeName === "array") {
        if (!isRecord(items)) {
          return "readonly unknown[]";
        }
        return `readonly (${this.render(items, context)})[]`;
      }
      if (schemaTypeName === "object" || isRecord(schema["properties"])) {
        return this.objectType(schema, context);
      }
      return null;
    },
    typeVariant(schema, typeName) {
      return { ...schema, type: typeName };
    },
  },
  zRenderComponentTypes = (document: Readonly<Record<string, unknown>>): string => {
    const componentsSchemas = requireRecord(
      requireRecord(document["components"], "components")["schemas"],
      "component schemas",
    );
    return Object.entries(componentsSchemas)
      .toSorted(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, schema]) => {
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) || !isRecord(schema)) {
          throw new Error(`OpenAPI generator cannot emit component ${name}`);
        }
        const generatedType = schemaRenderer.render(schema);
        if (generatedType.startsWith("{ readonly ") && generatedType.endsWith("}")) {
          return `export interface ${name} ${generatedType}`;
        }
        return `export type ${name} = ${generatedType};`;
      })
      .join("\n");
  },
  zRenderSchemaType = (schema: Readonly<Record<string, unknown>>): string =>
    schemaRenderer.render(schema),
  zRenderTypeProperty = (name: string): string => schemaRenderer.propertyName(name);

/** Renders validated OpenAPI schemas into stable TypeScript type source. */
export { listComponentSchemaNames } from "./component-schema-names.ts";
export {
  zRenderComponentTypes as renderComponentTypes,
  zRenderSchemaType as renderSchemaType,
  zRenderTypeProperty as renderTypeProperty,
};
