import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

// Заголовок в стиле GTA
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  // Используем основной шрифт, но делаем его жирным, большим и с цветом акцента
  <h2 className="text-3xl font-bold mb-6 uppercase tracking-wide text-primary text-glow">
    {children}
  </h2>
  // Или можно использовать Orbitron, если он больше нравится для заголовков:
  // <h2 className="text-3xl font-orbitron font-bold mb-6 uppercase tracking-wider text-secondary animate-neon">
  //  {children}
  // </h2>
);

export default function StyleGuide() {
  return (
    // Применяем градиентный фон ко всему контейнеру
    <div className="min-h-screen bg-gta-gradient p-8 text-foreground">
      {/* Используем Tailwind container для центрирования и отступов */}
      <div className="container mx-auto space-y-12">

        {/* Buttons Section */}
        <section>
          <SectionTitle>Buttons</SectionTitle>
          {/* Кнопки автоматически подхватят цвета из CSS переменных */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="default" className="shadow-glow-primary-md hover:shadow-glow-primary-lg">Primary</Button>
            <Button variant="secondary" className="shadow-glow-md hover:shadow-glow-lg">Secondary</Button>
            <Button variant="accent">Accent</Button> {/* Добавлен вариант Accent */}
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link" className="text-secondary">Link</Button> {/* Сделаем ссылку бирюзовой */}
            <Button disabled>Disabled</Button>
          </div>
        </section>

        {/* Input Fields Section */}
        <section>
          <SectionTitle>Form Elements</SectionTitle>
          <div className="space-y-6">
            {/* Инпуты и Textarea также используют переменные */}
            <Input placeholder="Enter your name..." />
            <Textarea placeholder="Your message..." />
            <Input type="search" placeholder="Search Vice City..." />
            <Select>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Vice Beach</SelectItem>
                <SelectItem value="2">Little Havana</SelectItem>
                <SelectItem value="3">Downtown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Dropdown Section */}
        <section>
          <SectionTitle>Dropdown</SectionTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Open Menu</Button>
            </DropdownMenuTrigger>
            {/* DropdownContent также стилизуется через переменные */}
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem disabled>Radio Stations (Soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        {/* Toggle Section */}
        <section>
          <SectionTitle>Toggles</SectionTitle>
          <div className="flex items-center space-x-4">
            {/* Switch и Checkbox используют primary цвет */}
            <Switch id="neon-mode" />
            <Label htmlFor="neon-mode" className="text-lg">Neon Mode</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="terms" />
              <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Accept terms
              </Label>
            </div>
          </div>
        </section>

        {/* Slider Section */}
        <section>
          <SectionTitle>Slider</SectionTitle>
          {/* Slider также использует primary цвет */}
          <Slider defaultValue={[66]} max={100} step={1} />
        </section>

        {/* Card Section */}
        <section>
          <SectionTitle>Cards</SectionTitle>
          {/* Добавляем тень и возможно градиент на карточку */}
          <Card className="w-full max-w-sm shadow-glow bg-card/80 backdrop-blur-sm border-primary/30"> {/* Полупрозрачная с блюром и рамкой */}
            <CardHeader>
              {/* Используем градиент для заголовка */}
              <CardTitle className="text-gradient text-2xl font-bold">Mission Briefing</CardTitle>
              <CardDescription className="text-muted-foreground">
                Downtown Rendezvous
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-glow">Meet Lester at the usual spot. High stakes.</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full shadow-glow-primary-md">Accept Mission</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  );
}