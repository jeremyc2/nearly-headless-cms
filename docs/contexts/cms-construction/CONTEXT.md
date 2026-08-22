# CMS Construction

CMS Construction is the language of the reusable library for defining and operating a headless CMS while leaving infrastructure, user interface, and presentation choices to its builder.

## Language

**CMS Builder**:
A developer who uses the Nearly Headless CMS library to assemble a CMS with their chosen user interface and integrations.
_Avoid_: Package consumer, integrator

**Rich Text**:
Structured content that preserves document structure and semantic marks such as emphasis and strong emphasis without prescribing their visual presentation.
_Avoid_: Styled text, HTML blob

**System**:
One independently composed part of the headless content flow: the reusable library, a Headless CMS built with it, or a Content Client that consumes that CMS.
_Avoid_: Architectural layer, tier

**Headless CMS**:
A system assembled by a CMS Builder from the library, CMS-specific behavior, a user interface, and Effect Layers that provide its external capabilities.
_Avoid_: Nearly Headless CMS library

**Content Client**:
A system that consumes content from a Headless CMS and owns how that content is presented.
_Avoid_: CMS UI, frontend layer

**Content Type**:
A named schema that defines the Fields accepted by one kind of content.
_Avoid_: Collection, schema type

**Entry**:
One persisted value conforming to a Content Type.
_Avoid_: Document, item, record

**Field**:
One named, typed part of an Entry's Content Type.
_Avoid_: Property, attribute

**Field Group**:
A named, reusable fragment of Field definitions composed into one or more Content Types.
_Avoid_: Editor panel, fieldset
