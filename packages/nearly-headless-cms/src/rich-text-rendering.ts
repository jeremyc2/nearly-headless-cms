import type {
  BlockNode,
  Document,
  ExtensionNode,
  ListItemNode,
  Node,
  Renderer,
} from "./rich-text.ts";

const collectReferences = (document: Document) => {
    const assetIds: string[] = [],
      entryIds: string[] = [];
    for (const child of document.children) {
      visitReferences(child, entryIds, assetIds);
    }
    return { assetIds: [...new Set(assetIds)], entryIds: [...new Set(entryIds)] };
  },
  coreBlockNodeTypes = new Set([
    "asset-reference",
    "code-block",
    "heading",
    "list-item",
    "ordered-list",
    "paragraph",
    "quote",
    "unordered-list",
  ]),
  extensionNodePredicate = (node: Node): node is ExtensionNode =>
    typeof node.type === "string" &&
    node.type.includes(".") &&
    !coreBlockNodeTypes.has(node.type),
  renderBranchNode = <Result>(node: Node, renderer: Renderer<Result>): Result => {
    const children = renderChildren(node, renderer);
    if (node.type === "link") {
      return renderer.link(node, children);
    }
    if (node.type === "entry-reference") {
      return renderer.entryReference(node, children);
    }
    if (renderableBlockNodePredicate(node)) {
      return renderer.block(node, children);
    }
    if (extensionNodePredicate(node)) {
      return renderer.extension(node, children);
    }
    throw new Error(`Unsupported Rich Text node ${node.type}`);
  },
  renderChildren = <Result>(node: Node, renderer: Renderer<Result>): readonly Result[] => {
    if (!("children" in node)) {
      return [];
    }
    return node.children.map((child) => renderNode(child, renderer));
  },
  renderDocument = <Result>(
    document: Document,
    renderer: Renderer<Result>,
  ): readonly Result[] => document.children.map((child) => renderNode(child, renderer)),
  renderNode = <Result>(node: Node, renderer: Renderer<Result>): Result => {
    if (node.type === "text") {
      return renderer.text(node);
    }
    return renderBranchNode(node, renderer);
  },
  renderableBlockNodePredicate = (
    node: Node,
  ): node is Exclude<BlockNode, ExtensionNode> | ListItemNode => coreBlockNodeTypes.has(node.type),
  visitReferences = (node: Node, entryIds: string[], assetIds: string[]): void => {
    if (node.type === "entry-reference") {
      entryIds.push(node.entryId);
    }
    if (node.type === "asset-reference") {
      assetIds.push(node.assetId);
    }
    if ("children" in node) {
      for (const child of node.children) {
        visitReferences(child, entryIds, assetIds);
      }
    }
  };

export default { collectReferences, renderDocument };
