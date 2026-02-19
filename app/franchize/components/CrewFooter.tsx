import Link from "next/link";
import type { FranchizeCrewVM } from "../actions";

interface CrewFooterProps {
  crew: FranchizeCrewVM;
}

export function CrewFooter({ crew }: CrewFooterProps) {
  return (
    <footer className="mt-12 border-t" style={{ borderColor: crew.theme.palette.borderSoft }}>
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
        <section
          className="rounded-2xl p-4"
          style={{ backgroundColor: crew.theme.palette.accentMain, color: crew.theme.palette.bgBase }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em]">Контакты</p>
          <p className="mt-2 text-sm">{crew.contacts.phone || "телефон скоро добавим"}</p>
          <p className="text-sm">{crew.contacts.email || "email скоро добавим"}</p>
          <p className="text-sm">{crew.contacts.address || "адрес скоро добавим"}</p>
        </section>

        <section
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#E4A610", color: crew.theme.palette.bgBase }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em]">Быстрое меню</p>
          <nav className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {crew.header.menuLinks.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href} className="underline-offset-2 hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </footer>
  );
}
