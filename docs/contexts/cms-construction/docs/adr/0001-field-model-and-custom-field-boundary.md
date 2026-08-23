# Use a portable, serializable Field model with registered custom Field Kinds

Nearly Headless CMS keeps Content Definitions and Entry values serializable so every CMS Builder can use the same runtime contract with its chosen persistence and UI. Built-in Field Kinds provide portable value and constraint semantics; CMS Builders register versioned Custom Field Kinds at composition time rather than persisting executable code.

## Consequences

- Field and Definition identifiers are immutable URL-safe lowercase machine identifiers; labels and descriptions are editable metadata.
- Field Groups compose explicitly as nested objects or inline Fields, and all Field Group inclusion graphs are acyclic.
- Entries persist JSON-compatible values without library coercion. Asset and Relationship Fields persist IDs, not copied data.
- Entry persistence must atomically enforce declared single-scalar uniqueness among live Entries of a Content Type.
