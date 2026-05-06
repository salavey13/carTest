export const toCategoryId = (category: string) => `category-${category.trim().toLowerCase().replace(/\s+/g, "-")}`;

export const isExternalHref = (href: string) => /^https?:\/\//.test(href);
