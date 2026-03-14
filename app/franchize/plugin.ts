export const plugin = {
  name: "franchize",
  description: "Franchise storefront runtime for motorbike crews with slug-hydrated catalog, cart, order and content surfaces",
  version: "1.0",
  uses: ["core.registry", "core.telegram", "infrastructure.supabase", "app.supaplan"],
  exports: [
    "getFranchizeBySlug",
    "createFranchizeCrew",
    "CatalogClient",
    "CrewHeader",
    "CrewFooter",
    "FranchizeFloatingCart",
  ],
  capabilities: ["franchize-runtime", "crew-theming", "catalog-marketplace-ui", "meta.plugin"],
};
