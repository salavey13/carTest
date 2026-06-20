/**
 * VIP Bike Electro Landing - The Crew Section
 * Brutalist, high-end fitness studio aesthetic
 */

const CREW_MEMBERS = [
  {
    id: "ios",
    name: "IOS",
    role: "FOUNDER",
    bio: "Built the fleet from scratch. Knows every bolt.",
    telegram: "I_O_S_NN",
  },
  {
    id: "mechanic",
    name: "THE MECHANIC",
    role: "TECH LEAD",
    bio: "If it breaks, he fixes it. If it doesn't, he makes it faster.",
    telegram: "I_O_S_NN",
  },
  {
    id: "operator",
    name: "THE OPERATOR",
    role: "SUPPORT",
    bio: "Your first point of contact. Fast, efficient, no bullshit.",
    telegram: "I_O_S_NN",
  },
];

export function TheCrew() {
  return (
    <section
      className="py-20 px-4 relative overflow-hidden"
      style={{ backgroundColor: "#050505" }}
    >
      {/* Neon orange overlay accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(255, 69, 0, 0.05)",
          mixBlendMode: "multiply",
        }}
      />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
            style={{ color: "#E0E0E0" }}
          >
            The Crew
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            The people behind the machines
          </p>
        </div>

        {/* Crew grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {CREW_MEMBERS.map((member, idx) => (
            <div
              key={member.id}
              className="p-8 border-2 relative"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: idx === 1 ? "#FF4500" : "#111",
              }}
            >
              {idx === 1 && (
                <div
                  className="absolute top-0 right-0 w-8 h-8"
                  style={{ backgroundColor: "#FF4500" }}
                />
              )}

              {/* Name */}
              <h3
                className="text-2xl font-black uppercase tracking-tighter mb-1"
                style={{ color: "#E0E0E0" }}
              >
                {member.name}
              </h3>

              {/* Role */}
              <p
                className="text-xs font-black uppercase tracking-widest mb-4"
                style={{ color: "#FF4500" }}
              >
                {member.role}
              </p>

              {/* Bio */}
              <p className="text-sm mb-6" style={{ color: "#999", lineHeight: "1.6" }}>
                {member.bio}
              </p>

              {/* Telegram link */}
              <a
                href={`https://t.me/${member.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider"
                style={{ color: "#E0E0E0" }}
              >
                @{member.telegram}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
