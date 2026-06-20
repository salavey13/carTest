/**
 * VIP Bike Electro Landing - Member Stories Section
 * Brutalist, high-end fitness studio aesthetic
 */

const STORIES = [
  {
    id: "story-1",
    quote: "Best electric bike experience in Nizhny. The Falcon GT is a beast.",
    author: "ALEX K.",
    ride: "Falcon GT 2025",
  },
  {
    id: "story-2",
    quote: "No paperwork bullshit. Just show up, ride, leave. That's how it should be.",
    author: "DMITRY M.",
    ride: "Sequence Zero",
  },
  {
    id: "story-3",
    quote: "Tried the Surge V for 3 hours. Bought one the next week. Enough said.",
    author: "SERGEI V.",
    ride: "Y-Volt Surge V",
  },
];

export function MemberStories() {
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
            Witness
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            What riders say
          </p>
        </div>

        {/* Stories grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {STORIES.map((story, idx) => (
            <div
              key={story.id}
              className="p-8 border-2"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: idx === 1 ? "#FF4500" : "#111",
              }}
            >
              {/* Quote mark */}
              <div
                className="text-6xl font-black leading-none mb-4"
                style={{ color: "#FF4500" }}
              >
                "
              </div>

              {/* Quote */}
              <p
                className="text-base mb-6 leading-relaxed"
                style={{ color: "#E0E0E0" }}
              >
                {story.quote}
              </p>

              {/* Divider */}
              <div
                className="w-12 h-px mb-4"
                style={{ backgroundColor: "#FF4500" }}
              />

              {/* Author */}
              <p
                className="text-sm font-black uppercase tracking-wider"
                style={{ color: "#666" }}
              >
                {story.author}
              </p>
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: "#FF4500" }}
              >
                {story.ride}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
