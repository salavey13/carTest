// src/components/ThemeSelector.tsx
interface ThemeSelectorProps {
  theme: string;
  onThemeChange: (theme: string) => void;
}

export const ThemeSelector = ({ theme, onThemeChange }: ThemeSelectorProps) => {
  const themes = [
    { id: 'cyberpunk', name: 'Cyberpunk', color: 'bg-cyan-500' },
    { id: 'neon', name: 'Neon Grid', color: 'bg-purple-500' },
    { id: 'sci-fi', name: 'Sci-Fi', color: 'bg-amber-500' },
  ];

  return (
    <div className="flex gap-2 mb-8">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => onThemeChange(t.id)}
          className={`w-8 h-8 rounded-full ${t.color} ${
            theme === t.id ? 'ring-2 ring-white' : 'opacity-50'
          } transition-all`}
          title={t.name}
        />
      ))}
    </div>
  );
};

