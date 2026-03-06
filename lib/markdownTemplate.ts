export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

export function applyTemplateVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    return String(value);
  });
}
