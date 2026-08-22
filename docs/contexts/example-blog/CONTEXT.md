# Example Blog

The Example Blog is the content domain exercised by the polished reference implementation and its end-to-end acceptance tests.

## Language

**Example CMS**:
The polished blog CMS maintained in this monorepo to demonstrate a complete composition of the library and anchor its end-to-end acceptance tests. It is source code for reference, not a package published to npm.
_Avoid_: Demo, toy app, sample code

**Public Blog**:
The separately runnable Content Client that consumes the Example CMS's headless API and owns all visual presentation of the Example Blog.
_Avoid_: CMS UI, preview

**Post**:
The primary publishable content in the Example CMS.
_Avoid_: Article

**Author**:
Content describing a person credited with a Post. An Author is unrelated to authentication or any logged-in identity.
_Avoid_: User, account

**Post Status**:
An ordinary CMS Builder-defined field on a Post whose values include draft and published. It carries no library-defined lifecycle behavior.
_Avoid_: Publication lifecycle

**Comment**:
Content submitted through the Public Blog and related to a Post. Comment moderation is expressed through ordinary CMS Builder-defined Fields, not library-defined workflow semantics.
_Avoid_: Feedback, message
