/**
 * ESLint rule: no-floating-generators
 *
 * Flags calls to generator functions whose return value is discarded.
 * A bare `gen()` in an expression statement silently creates a Generator
 * object that is never iterated — the generator body never executes.
 *
 * Escape hatch: `void gen()` signals intentional discard.
 *
 * Requires type information — enable `parserOptions.projectService` in the
 * ESLint config.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require generator function return values to be assigned to a variable",
    },
    messages: {
      floating:
        "Generator return value must be assigned to a variable. Use `void` to explicitly discard.",
    },
    schema: [],
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services?.esTreeNodeToTSNodeMap) {
      return {};
    }
    const checker = services.program.getTypeChecker();

    return {
      ExpressionStatement(node) {
        const { expression } = node;

        // `void gen()` — intentional discard, skip.
        if (expression.type === "UnaryExpression" && expression.operator === "void") {
          return;
        }

        if (expression.type !== "CallExpression") return;

        const tsNode = services.esTreeNodeToTSNodeMap.get(expression);
        if (!tsNode) return;

        const type = checker.getTypeAtLocation(tsNode);
        if (isGeneratorType(type)) {
          context.report({ node: expression, messageId: "floating" });
        }
      },
    };

    /**
     * Check whether a TypeScript type is a Generator or AsyncGenerator.
     * Walks union types so `Generator<X> | undefined` is still caught.
     *
     * @param {import('typescript').Type} type
     * @returns {boolean}
     */
    function isGeneratorType(type) {
      const symbol = type.getSymbol?.() ?? type.target?.getSymbol?.();
      if (symbol) {
        const name = symbol.getName();
        if (name === "Generator" || name === "AsyncGenerator") return true;
      }
      if (type.isUnion?.()) {
        return type.types.some((t) => isGeneratorType(t));
      }
      return false;
    }
  },
};
