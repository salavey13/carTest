// app/franchize/[slug]/verify-doc/page.tsx
//
// Verification page MOVED from /doc-verifier to /franchize/[slug]/verify-doc
// so it's part of the franchize layout (crew header + footer + theme).
//
// The old /doc-verifier page still exists for backward compatibility
// (old deep links), but this is the canonical location going forward.
// The rental page's "Verify" button now links here instead.

import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewHeader } from "../../components/CrewHeader";
import { CrewFooter } from "../../components/CrewFooter";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { VerifyDocClient } from "./VerifyDocClient";

interface VerifyDocPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ integrationScope?: string; documentKey?: string }>;
}

export async function generateMetadata({ params }: VerifyDocPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Проверка документа",
    sectionDescription: "Проверка подлинности документа аренды по хешу.",
    pathSuffix: "/verify-doc",
  });
}

export default async function VerifyDocPage({ params, searchParams }: VerifyDocPageProps) {
  const { slug } = await params;
  const { integrationScope, documentKey } = await searchParams;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/verify-doc`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
        sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)}
        items={items}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--franchize-text-primary, inherit)" }}
          >
            Проверка документа
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--franchize-text-secondary, inherit)" }}
          >
            Загрузите документ для проверки его подлинности по хешу SHA-256.
          </p>

          <FranchizeErrorBoundary
            resetKey={slug}
            fallbackTitle="Проверка временно недоступна"
            fallbackHref={`/franchize/${resolvedSlug}/verify-doc`}
            fallbackLinkLabel="Перезагрузить"
          >
            <VerifyDocClient
              initialIntegrationScope={integrationScope || `rental:${slug}`}
              initialDocumentKey={documentKey || ""}
            />
          </FranchizeErrorBoundary>
        </div>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
