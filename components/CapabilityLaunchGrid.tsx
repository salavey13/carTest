import Link from "next/link";
import { ExternalLink, GitBranch, Orbit, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";

type LaunchItem = {
  title: string;
  href: string;
  caption: string;
  icon: typeof ExternalLink;
  external?: boolean;
  accent: string;
};

type CapabilityLaunchGridProps = {
  className?: string;
  includeGreenbox?: boolean;
};

const baseItems: LaunchItem[] = [
  {
    title: "Codex",
    href: "https://chatgpt.com/codex",
    caption: "chatgpt.com",
    icon: ExternalLink,
    external: true,
    accent: "border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/10",
  },
  {
    title: "Nexus",
    href: "/nexus",
    caption: "внутри платформы",
    icon: Orbit,
    accent: "border-brand-pink/40 hover:border-brand-pink hover:bg-brand-pink/10",
  },
  {
    title: "Repo XML",
    href: "/repo-xml",
    caption: "dev flow",
    icon: GitBranch,
    accent: "border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow/10",
  },
];

const greenboxItem: LaunchItem = {
  title: "Greenbox",
  href: "/greenbox",
  caption: "симулятор сада",
  icon: Sprout,
  accent: "border-emerald-400/50 hover:border-emerald-300 hover:bg-emerald-500/10",
};

function CapabilityLink({ item }: { item: LaunchItem }) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="inline-flex items-center">
        <Icon className="mr-2 h-4 w-4" />
        {item.title}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">{item.caption}</span>
    </>
  );

  if (item.external) {
    return (
      <Button asChild variant="outline" className={`justify-between ${item.accent}`}>
        <a href={item.href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className={`justify-between ${item.accent}`}>
      <Link href={item.href}>{content}</Link>
    </Button>
  );
}

export function CapabilityLaunchGrid({ className, includeGreenbox = false }: CapabilityLaunchGridProps) {
  const items = includeGreenbox ? [...baseItems, greenboxItem] : baseItems;

  return (
    <div className={className ?? "grid grid-cols-1 gap-2 sm:grid-cols-3"}>
      {items.map((item) => (
        <CapabilityLink key={item.title} item={item} />
      ))}
    </div>
  );
}
