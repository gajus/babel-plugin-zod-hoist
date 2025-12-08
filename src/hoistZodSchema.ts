import { generate } from '@babel/generator';
import { declare } from '@babel/helper-plugin-utils';
import { type NodePath } from '@babel/traverse';
// eslint-disable-next-line id-length
import * as t from '@babel/types';
import { createHash } from 'node:crypto';

/**
 * Check if a node is the `z` identifier (the Zod namespace)
 */
const isZodIdentifier = (node: t.Node): node is t.Identifier => {
  return t.isIdentifier(node) && node.name === 'z';
};

/**
 * Get the root object of a member expression / call chain.
 * For `z.string().optional()`, this returns the `z` Identifier.
 */
const getChainRoot = (node: t.Node): t.Node => {
  let current = node;

  while (true) {
    if (t.isCallExpression(current)) {
      current = current.callee;
    } else if (t.isMemberExpression(current)) {
      current = current.object;
    } else {
      break;
    }
  }

  return current;
};

/**
 * Check if a call expression is a Zod call (chain starts with `z.`)
 */
const isZodCall = (node: t.CallExpression): boolean => {
  return isZodIdentifier(getChainRoot(node));
};

/**
 * Walk up the AST to find the outermost call expression in a method chain.
 * For `z.string().optional().default('x')`, starting from `z.string()`,
 * this returns the path to `.default('x')`.
 */
const getOutermostCall = (
  path: NodePath<t.CallExpression>,
): NodePath<t.CallExpression> => {
  let current = path;

  // Pattern: CallExpression -> MemberExpression (parent) -> CallExpression (grandparent)
  while (
    current.parentPath?.isMemberExpression() &&
    current.parentPath.parentPath?.isCallExpression()
  ) {
    current = current.parentPath.parentPath as NodePath<t.CallExpression>;
  }

  return current;
};

/**
 * Check if a path is nested inside another Zod call.
 * This handles cases like `z.object({ a: z.string() })` where we don't
 * want to separately hoist the inner `z.string()`.
 */
const isNestedInZodCall = (outerPath: NodePath<t.CallExpression>): boolean => {
  let current = outerPath.parentPath;

  while (current) {
    if (current.isCallExpression() && isZodCall(current.node)) {
      return true;
    }

    current = current.parentPath;
  }

  return false;
};

/**
 * Check if the `z` identifier in a Zod call chain refers to the global/imported Zod,
 * not a shadowed local variable or parameter.
 */
const isGlobalZodReference = (
  path: NodePath<t.CallExpression>,
  programPath: NodePath<t.Program>,
): boolean => {
  const root = getChainRoot(path.node);

  if (!isZodIdentifier(root)) {
    return false;
  }

  // Check if `z` is bound to a local variable/parameter
  const binding = path.scope.getBinding('z');

  // If there's no binding, it's a global reference (assume it's Zod)
  if (!binding) {
    return true;
  }

  // If the binding is at program scope, it's the import (fine to hoist)
  // If it's at a nested scope, it's shadowed (don't hoist)
  return binding.scope === programPath.scope;
};

/**
 * Check if an expression can be safely hoisted to the top of the file.
 * Returns false if it references local variables, `this`, or any top-level
 * variable declarations (const/let/var) which would cause TDZ errors.
 * Only imports are safe to reference when hoisting to the top.
 */
const canSafelyHoist = (
  path: NodePath<t.CallExpression>,
  programPath: NodePath<t.Program>,
): boolean => {
  let canHoist = true;

  path.traverse({
    Identifier(idPath) {
      // Skip the 'z' identifier itself
      if (idPath.node.name === 'z') {
        return;
      }

      // Skip property access names (e.g., `.optional` in `z.string().optional()`)
      if (
        idPath.parentPath?.isMemberExpression() &&
        idPath.parentPath.node.property === idPath.node &&
        !idPath.parentPath.node.computed
      ) {
        return;
      }

      // Skip object property keys (e.g., `name` in `{ name: z.string() }`)
      if (
        idPath.parentPath?.isObjectProperty() &&
        idPath.parentPath.node.key === idPath.node &&
        !idPath.parentPath.node.computed
      ) {
        return;
      }

      const binding = idPath.scope.getBinding(idPath.node.name);

      if (binding) {
        // If binding is defined WITHIN the expression we're hoisting
        // (e.g., callback parameters like `val` in `.transform((val) => val.trim())`),
        // it's fine - the binding will move with the expression
        if (path.isAncestor(binding.path)) {
          return;
        }

        // If binding is at program scope
        if (binding.scope === programPath.scope) {
          // Imports are safe - they're hoisted at runtime in ES modules
          if (
            binding.path.isImportSpecifier() ||
            binding.path.isImportDefaultSpecifier() ||
            binding.path.isImportNamespaceSpecifier()
          ) {
            return;
          }

          // Any other program-scope binding (const/let/var) is NOT safe
          // because our hoisted schema would be placed BEFORE it, causing TDZ
          canHoist = false;
          idPath.stop();
          return;
        }

        // Local variable from enclosing function - can't hoist
        canHoist = false;
        idPath.stop();
      }
    },

    ThisExpression() {
      // `this` is context-dependent and cannot be safely hoisted
      canHoist = false;
    },
  });

  return canHoist;
};

/**
 * Generate a short hash from code string for variable naming.
 */
const generateHash = (code: string): string => {
  return createHash('sha256').update(code).digest('hex').slice(0, 8);
};

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'babel-plugin-zod-hoist',

    visitor: {
      Program(programPath) {
        // Map from generated code -> hoisted identifier (for deduplication)
        const hoistedSchemas = new Map<string, t.Identifier>();

        // Schemas queued to be inserted at top of file
        const schemasToHoist: Array<{ id: t.Identifier; init: t.Expression }> =
          [];

        // Track processed nodes to avoid re-processing chains
        const processedNodes = new WeakSet<t.Node>();

        programPath.traverse({
          CallExpression(path) {
            // Only process Zod calls
            if (!isZodCall(path.node)) {
              return;
            }

            // Get the outermost call in the method chain
            const outerPath = getOutermostCall(path);

            // Skip if we've already processed this chain
            if (processedNodes.has(outerPath.node)) {
              return;
            }

            processedNodes.add(outerPath.node);

            // Skip if nested inside another Zod call (will be hoisted with parent)
            if (isNestedInZodCall(outerPath)) {
              return;
            }

            // Skip if `z` is shadowed by a local variable/parameter
            if (!isGlobalZodReference(outerPath, programPath)) {
              return;
            }

            // Skip if already at program level (no hoisting needed)
            const functionParent = outerPath.getFunctionParent();

            if (!functionParent) {
              return;
            }

            // Skip if the schema can't be safely hoisted
            if (!canSafelyHoist(outerPath, programPath)) {
              return;
            }

            // Generate code string for deduplication and hashing
            const { code } = generate(outerPath.node);

            // If we've seen this exact schema before, reuse the identifier
            const existingId = hoistedSchemas.get(code);

            if (existingId) {
              outerPath.replaceWith(t.cloneNode(existingId));
              return;
            }

            // Create a unique identifier for this schema
            const hash = generateHash(code);
            const id = programPath.scope.generateUidIdentifier(
              `schema_${hash}`,
            );

            hoistedSchemas.set(code, id);

            // Queue the schema for hoisting
            schemasToHoist.push({
              id,
              init: t.cloneNode(outerPath.node, true),
            });

            // Replace original expression with the identifier
            outerPath.replaceWith(id);
          },
        });

        // Insert all hoisted schemas at the top of the file
        if (schemasToHoist.length > 0) {
          const declarations = schemasToHoist.map(({ id, init }) =>
            t.variableDeclaration('const', [t.variableDeclarator(id, init)]),
          );

          programPath.unshiftContainer('body', declarations);
        }
      },
    },
  };
});
