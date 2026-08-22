export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

/**
 * Render a template by substituting {{var}} placeholders and resolving
 * {{#if var}}...{{else}}...{{/if}} / {{#if var}}...{{/if}} conditional
 * blocks against the supplied variables.
 *
 * Conditional handling:
 *   - Innermost-first resolution (max 100 iterations) so nested blocks
 *     like {{#if A}}...{{#if B}}...{{/if}}...{{/if}} resolve correctly.
 *   - A block body is matched only if it contains no nested {{#if}} /
 *     {{/if}} markers (negative-lookahead char-by-char match).
 *   - Both with-else and without-else forms are supported: if the body
 *     contains "{{else}}", the part before it is the if-branch and the
 *     part after is the else-branch; otherwise the whole body is the
 *     if-branch and the else-branch is "".
 *   - Truthiness: non-empty string that isn't "0"/"false"/"no"/"null"/
 *     "undefined"; numbers > 0; booleans as-is; null/undefined → false.
 *
 * HTML comments (<!-- ... -->) are stripped BEFORE any processing so
 * that {{#if}}/{{var}} text appearing in documentation comments is not
 * accidentally matched as live template syntax.
 *
 * Empty / missing variables resolve to "" (empty string), never to a
 * literal "{{var}}" placeholder.
 *
 * This implementation mirrors the proven one in
 * scripts/make-deal-contract-skill.mjs:renderTemplateWithVars() so that
 * the Telegram /doc flow and the CLI skill flow produce identical
 * output for the same template + variables.
 */
export function applyTemplateVariables(template: string, variables: TemplateVariables): string {
  // First pass: strip HTML comments so that any {{#if}}/{{else}}/{{/if}} or
  // {{var}} text used as documentation inside <!-- ... --> is NOT processed
  // as real template syntax. (Comments are not preserved in the final DOCX
  // anyway — htmlToDocxElements drops them.)
  let out = template.replace(/<!--[\s\S]*?-->/g, '');

  // Truthy check shared by all conditional resolutions. Kept in sync with
  // make-deal-contract-skill.mjs so both flows agree on what counts as
  // "variable is set" for {{#if}} purposes.
  const isTruthy = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (s === '' || s === '0' || s === 'false' || s === 'no' || s === 'null' || s === 'undefined') return false;
    return true;
  };

  // Process INNERMOST conditional blocks first: a block whose body contains
  // NO nested {{#if}} opener and NO nested {{/if}} closer. The negated
  // lookahead ((?:(?!\{\{#if\s|\{\{\/if\}\}).)*?) matches one char at a
  // time, failing fast if it sees either marker — so the body cannot
  // contain a nested conditional. The `s` (dotAll) flag lets `.` match
  // newlines so multi-line blocks (e.g. App.1's pledge clause spanning
  // two <p> tags) match correctly.
  const blockRe = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if\s|\{\{\/if\}\}).)*?)\{\{\/if\}\}/gs;
  let guard = 0;
  while (guard++ < 100) {
    let replaced = false;
    out = out.replace(blockRe, (_full, varName: string, body: string) => {
      replaced = true;
      let ifBranch = body, elseBranch = '';
      const elseIdx = body.indexOf('{{else}}');
      if (elseIdx >= 0) {
        ifBranch = body.slice(0, elseIdx);
        elseBranch = body.slice(elseIdx + '{{else}}'.length);
      }
      return isTruthy(variables[varName]) ? ifBranch : elseBranch;
    });
    if (!replaced) break;
  }

  // Final pass: simple {{var}} interpolation.
  // Missing / null variables resolve to "" — never to the literal placeholder.
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    return String(value);
  });

  return out;
}
