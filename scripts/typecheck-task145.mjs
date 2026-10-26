// typecheck-task145.mjs — targeted type-check of the files touched in task 145
// (landings quality uplift: partner logo grids, feedback forms, photo banners)
import ts from "typescript";

const targets = [
  "components/landing/PartnerLogoGrid.tsx",
  "app/page.tsx",
  "app/leorus/LeorusLandingClient.tsx",
  "app/leorus/page.tsx",
  "app/sly13/Sly13LandingClient.tsx",
  "app/moto-selection/page.tsx",
  "app/georg-electro/page.tsx",
  "app/vipbikerental/VipBikeRentalClient.tsx",
  "app/vipbikerental/features/PartnersCrewsSection.tsx",
  "app/vipbikerental/features/HowItWorksSection.tsx",
  "app/vipbikerental/features/GearSection.tsx",
  "app/vipbikerental/features/InvestSection.tsx",
  "app/vipbikerental/page.tsx",
];

const cfgFile = ts.findConfigFile("./", ts.sys.fileExists, "tsconfig.json");
const cfg = ts.readConfigFile(cfgFile, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, "./");

const program = ts.createProgram(targets, { ...parsed.options, noEmit: true, skipLibCheck: true });
const diags = ts.getPreEmitDiagnostics(program).filter(
  (d) => d.file && targets.some((t) => d.file.fileName.endsWith(t))
);
for (const d of diags) {
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  console.log(`${d.file.fileName}:${line + 1}:${character + 1}`, ts.flattenDiagnosticMessageText(d.messageText, " "));
}
console.log(diags.length === 0 ? "TOUCHED FILES: CLEAN" : "ERRORS: " + diags.length);
