import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; // Corrected import
import { cn } from "@/lib/utils";

const ColorSwatch = ({ name, className, hslVar }: { name: string, className: string, hslVar?: string }) => (
  <div className="flex flex-col items-center space-y-1">
    <div className={cn("w-16 h-16 rounded-md border", className, hslVar && hslVar.includes('foreground') ? 'border-destructive' : 'border-border' )}></div>
    <span className="text-xs font-mono font-semibold">{name}</span>
    {hslVar && <code className="text-xs text-muted-foreground">{hslVar}</code>}
    {className.startsWith('bg-') && !hslVar && <code className="text-xs text-muted-foreground">.{className}</code>}
  </div>
);

export default function StyleGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-16">
      <div className="container mx-auto space-y-16">
        <header className="text-center mb-12 mt-16 md:mt-20"> 
          <h1 
            className={cn(
              "text-5xl md:text-6xl font-bold mb-2 font-orbitron", // Use Orbitron here
              "text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue", // Custom gradient for this title
              "animate-glitch" 
            )}
            data-text="CYBERVIBE STYLE GUIDE"
          >
            CYBERVIBE STYLE GUIDE
          </h1>
          <p className="text-lg text-muted-foreground font-mono">
            Визуальный язык и компоненты платформы oneSitePls.
          </p>
        </header>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaPalette::" /> Цветовая Палитра</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 font-orbitron text-brand-blue">Брендовые Цвета (HSL Vars)</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                <ColorSwatch name="Purple" className="bg-brand-purple" hslVar="--brand-purple" />
                <ColorSwatch name="Pink" className="bg-brand-pink" hslVar="--brand-pink" />
                <ColorSwatch name="Cyan" className="bg-brand-cyan" hslVar="--brand-cyan" />
                <ColorSwatch name="Blue" className="bg-brand-blue" hslVar="--brand-blue" />
                <ColorSwatch name="Yellow" className="bg-brand-yellow" hslVar="--brand-yellow" />
                <ColorSwatch name="Green" className="bg-brand-green" hslVar="--brand-green" />
                <ColorSwatch name="Orange" className="bg-brand-orange" hslVar="--brand-orange" />
                <ColorSwatch name="Lime" className="bg-brand-lime" hslVar="--brand-lime" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 font-orbitron text-brand-blue">Основные Цвета UI (HSL Vars)</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                <ColorSwatch name="Background" className="bg-background" hslVar="--background" />
                <ColorSwatch name="Foreground" className="bg-foreground" hslVar="--foreground" />
                <ColorSwatch name="Card" className="bg-card" hslVar="--card" />
                <ColorSwatch name="Primary" className="bg-primary" hslVar="--primary" />
                <ColorSwatch name="Secondary" className="bg-secondary" hslVar="--secondary" />
                <ColorSwatch name="Accent" className="bg-accent" hslVar="--accent" />
                <ColorSwatch name="Muted" className="bg-muted" hslVar="--muted" />
                <ColorSwatch name="Destructive" className="bg-destructive" hslVar="--destructive" />
                <ColorSwatch name="Border" className="bg-border" hslVar="--border" />
                <ColorSwatch name="Input" className="bg-input" hslVar="--input" />
                <ColorSwatch name="Ring" className="bg-ring" hslVar="--ring" />
              </div>
            </div>
             <div>
                <h3 className="text-xl font-semibold mb-4 font-orbitron text-brand-blue">Текстовые Цвета</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-foreground text-lg p-2 bg-card rounded border border-border">Foreground</p>
                        <p className="text-card-foreground text-lg p-2 bg-card rounded border border-border">Card FG</p>
                        <p className="text-popover-foreground text-lg p-2 bg-popover rounded border border-border">Popover FG</p>
                    </div>
                     <div className="space-y-1">
                        <p className="text-primary-foreground text-lg p-2 bg-primary rounded">Primary FG</p>
                        <p className="text-secondary-foreground text-lg p-2 bg-secondary rounded">Secondary FG</p>
                        <p className="text-accent-foreground text-lg p-2 bg-accent rounded">Accent FG</p>
                     </div>
                    <div className="space-y-1">
                        <p className="text-destructive-foreground text-lg p-2 bg-destructive rounded">Destructive FG</p>
                        <p className="text-muted-foreground text-lg p-2 bg-card rounded border border-border">Muted FG</p>
                    </div>
                    <div className="space-y-1">
                         <p className="text-light-text text-lg p-2 bg-background rounded border border-border">Light Text (now Foreground)</p>
                         <p className="text-accent-text text-lg p-2 bg-background rounded border border-border">Accent Text (Brand)</p>
                    </div>
                </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaFont::" /> Типографика</h2>
          <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
            <h1 className="text-5xl md:text-6xl font-bold">H1: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h1>
            <h2 className="text-4xl md:text-5xl font-orbitron">H2: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h2>
            <h3 className="text-3xl md:text-4xl font-orbitron">H3: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h3>
            <h4 className="text-2xl md:text-3xl font-orbitron">H4: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h4>
            <h5 className="text-xl md:text-2xl font-orbitron">H5: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h5>
            <h6 className="text-lg md:text-xl font-orbitron">H6: Orbitron Заголовок - The quick brown fox jumps over the lazy dog</h6>
            <p className="text-lg font-sans">Основной текст (Inter/Sans Regular, text-lg): The quick brown fox jumps over the lazy dog. Эталонная фраза.</p>
            <p className="font-sans">Основной текст (Inter/Sans Regular, base): The quick brown fox jumps over the lazy dog. Эталонная фраза.</p>
            <p className="text-sm font-sans">Маленький текст (Inter/Sans Regular, text-sm): The quick brown fox jumps over the lazy dog.</p>
            <p className="text-xs font-sans">Очень маленький текст (Inter/Sans Regular, text-xs): The quick brown fox jumps over the lazy dog.</p>
            <p className="font-sans">Текст с <strong className="font-semibold">жирным выделением (semibold)</strong> и <em className="italic">курсивом</em>.</p>
            <blockquote className="border-l-4 border-brand-purple pl-4 italic text-muted-foreground">
              Блок цитаты: "Stay hungry. Stay foolish." - Steve Jobs
            </blockquote>
            <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-accent-text">inline code snippet</code>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto simple-scrollbar"> 
              <code className="text-sm font-mono text-accent-text">
                {`// Code Block Example
function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}`}
              </code>
            </pre>
            <p><a href="#" className="text-brand-blue hover:underline">Ссылка (text-brand-blue)</a></p>
            <p className="font-mono">Моноширинный текст (font-mono): Used for code, variables, etc. 1234567890</p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaHandPointer::" /> Кнопки</h2>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Варианты</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="default">Primary <VibeContentRenderer content="::FaStar::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="secondary">Secondary <VibeContentRenderer content="::FaGears::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="accent">Accent <VibeContentRenderer content="::FaPaintbrush::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="destructive">Destructive <VibeContentRenderer content="::FaTrash::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="outline">Outline <VibeContentRenderer content="::FaEyeSlash::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="ghost">Ghost <VibeContentRenderer content="::FaCode::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="link">Link <VibeContentRenderer content="::FaLink::" className="ml-2 h-3 w-3"/></Button>
            </div>
             <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Размеры</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><VibeContentRenderer content="::FaPlus::" /></Button>
            </div>
            <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Состояния</h3>
             <div className="flex flex-wrap gap-4 items-center">
              <Button variant="default">Normal</Button>
              <Button variant="default" className="hover:bg-primary/90">Hover (Simulated)</Button>
              <Button variant="default" className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">Focus (Click Me)</Button>
              <Button variant="default" disabled>Disabled</Button>
            </div>
            <h3 className="text-xl font-semibold font-orbitron text-brand-blue">С иконками</h3>
             <div className="flex flex-wrap gap-4 items-center">
                <Button><VibeContentRenderer content="::FaFloppyDisk::" className="mr-2 h-4 w-4" /> Save Changes</Button>
                <Button variant="outline"><VibeContentRenderer content="::FaPaperPlane::" className="mr-2 h-4 w-4" /> Submit</Button>
                <Button variant="destructive" size="icon"><VibeContentRenderer content="::FaTrash::" /></Button>
             </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaKeyboard::" /> Элементы Форм</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Inputs & Textarea</h3>
              <div>
                <Label htmlFor="input-normal">Normal Input</Label>
                <Input id="input-normal" placeholder="Placeholder..." className="input-cyber" />
              </div>
              <div>
                 <Label htmlFor="input-focus">Focus State</Label>
                 <Input id="input-focus" placeholder="Focus on me" className="input-cyber focus:ring-2 focus:ring-ring focus:border-ring" />
              </div>
              <div>
                <Label htmlFor="input-disabled">Disabled Input</Label>
                <Input id="input-disabled" placeholder="Can't touch this" className="input-cyber" disabled />
              </div>
              <div>
                <Label htmlFor="textarea-normal">Textarea</Label>
                <Textarea id="textarea-normal" placeholder="Type long text here..." className="textarea-cyber simple-scrollbar" /> 
              </div>
               <div>
                 <Label htmlFor="textarea-focus">Textarea Focus</Label>
                 <Textarea id="textarea-focus" placeholder="Focus on textarea" className="textarea-cyber simple-scrollbar focus:ring-2 focus:ring-ring focus:border-ring" /> 
               </div>
              <div>
                <Label htmlFor="textarea-disabled">Disabled Textarea</Label>
                <Textarea id="textarea-disabled" placeholder="Disabled textarea" className="textarea-cyber simple-scrollbar" disabled /> 
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Select</h3>
              <Select>
                <SelectTrigger className="input-cyber">
                  <SelectValue placeholder="Select a Vibe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chill">Chill <VibeContentRenderer content="::FaSnowflake::"/></SelectItem>
                  <SelectItem value="focus">Focus <VibeContentRenderer content="::FaBrain::"/></SelectItem>
                  <SelectItem value="hype">Hype <VibeContentRenderer content="::FaBolt::"/></SelectItem>
                </SelectContent>
              </Select>
              <h3 className="text-xl font-semibold font-orbitron text-brand-blue mt-6">Toggles</h3>
               <div className="flex items-center space-x-2">
                <Checkbox id="checkbox-terms" />
                <Label htmlFor="checkbox-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Accept terms and conditions</Label>
              </div>
              <div className="flex items-center space-x-2">
                  <Checkbox id="checkbox-disabled" disabled />
                  <Label htmlFor="checkbox-disabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Disabled Checkbox</Label>
              </div>
               <div className="flex items-center space-x-2">
                 <Switch id="switch-airplane" />
                 <Label htmlFor="switch-airplane">Airplane Mode</Label>
               </div>
               <div className="flex items-center space-x-2">
                 <Switch id="switch-dark" defaultChecked className="data-[state=checked]:bg-primary"/>
                 <Label htmlFor="switch-dark">Dark Mode <VibeContentRenderer content="::FaMoon::" className="inline ml-1"/></Label>
               </div>
              <div className="flex items-center space-x-2">
                  <Switch id="switch-disabled" disabled />
                  <Label htmlFor="switch-disabled">Disabled Switch</Label>
              </div>
               <h3 className="text-xl font-semibold font-orbitron text-brand-blue mt-6">Slider</h3>
              <Slider defaultValue={[66]} max={100} step={1} className="[&>span:first-child]:bg-brand-pink"/>
              <Slider defaultValue={[33]} max={100} step={1} disabled />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaIdCard::" /> Карточки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-card border-border shadow-lg"> 
              <CardHeader>
                <CardTitle className="font-orbitron text-brand-purple">Стандартная Карта</CardTitle>
                <CardDescription className="font-mono">Базовый вид карточки</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Контент карточки здесь. Можно добавить текст, кнопки или другие элементы.</p>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" size="sm">Действие</Button>
              </CardFooter>
            </Card>
             <Card className="bg-card border-brand-pink/60 shadow-xl shadow-pink-500/30">
              <CardHeader>
                <CardTitle className="font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-brand-purple">Карта с Эффектами</CardTitle>
                <CardDescription className="font-mono text-muted-foreground">Применены градиент и тень</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Этот контент для демонстрации. Рамка может быть анимирована.</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="link" size="sm" className="text-brand-cyan">Подробнее</Button>
                 <Button variant="ghost" size="sm">Отмена</Button>
              </CardFooter>
            </Card>
             <Card className="bg-gradient-to-br from-brand-cyan/5 via-card to-brand-blue/5 border-border shadow-inner">
               <CardHeader>
                <CardTitle className="font-orbitron text-brand-cyan" data-text="Кибер-Карта">Кибер-Карта</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-sm font-mono text-muted-foreground">Использует градиентный фон и акцентный цвет для заголовка.</p>
                 <div className="mt-4 h-20 bg-grid-pattern-pink rounded-md flex items-center justify-center text-xs text-brand-pink/50 border border-brand-pink/20">Grid Pattern Demo</div>
               </CardContent>
              <CardFooter>
                 <Button className="w-full" variant="accent">Активировать Протокол</Button>
              </CardFooter>
             </Card>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaDiagramProject::" /> Другие Элементы</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <h3 className="text-xl font-semibold font-orbitron text-brand-blue mb-4">Dropdown Menu</h3>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline">Открыть Меню <VibeContentRenderer content="::FaGears::" className="ml-2 h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-popover border-border">
                    <DropdownMenuItem><VibeContentRenderer content="::FaUser:: Профиль" className="flex items-center gap-2"/></DropdownMenuItem>
                    <DropdownMenuItem><VibeContentRenderer content="::FaCreditCard:: Биллинг" className="flex items-center gap-2"/></DropdownMenuItem>
                    <DropdownMenuItem disabled><VibeContentRenderer content="::FaLifeRing:: Поддержка (Неактивно)" className="flex items-center gap-2"/></DropdownMenuItem>
                    <DropdownMenuItem><VibeContentRenderer content="::FaRightFromBracket:: Выйти" className="flex items-center gap-2"/></DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div>
                <h3 className="text-xl font-semibold font-orbitron text-brand-blue mb-4">Пример с VibeContentRenderer</h3>
                 <div className="bg-card p-4 rounded-lg border border-border space-y-2">
                    <VibeContentRenderer content="Это **жирный** текст с иконкой ::FaStar className='text-yellow-400':: и *курсивом*." className="text-sm"/>
                    <VibeContentRenderer content="Ссылка на [Google](https://google.com) ::FaGoogle:: и FontAwesome ::FaFontAwesome::" className="text-sm"/>
                    <VibeContentRenderer content="Ошибка: ::faInvalidIcon:: <FaNonExistent />" className="text-sm"/>
                 </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-brand-purple flex items-center gap-2"><VibeContentRenderer content="::FaPaintbrush::" /> Эффекты и Утилиты</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Текстовые Эффекты</h3>
                 <p className="cyber-text text-lg" data-text="Cyber Text (.cyber-text)">Cyber Text (.cyber-text)</p>
                 <p className="text-lg text-gradient">Text Gradient (.text-gradient)</p>
                 <p className="text-lg text-glow animate-pulse-slow">Text Glow + Pulse Slow</p> 
                 <p className="text-lg text-shadow-neon">Neon Shadow (.text-shadow-neon)</p>
                 <p className="text-lg text-shadow-cyber">Cyber Shadow (.text-shadow-cyber)</p>
                 <p className="text-lg text-animated-gradient">Animated Gradient Text</p>
                 <p className="text-lg animate-glitch" data-text="Glitch Effect (animate-glitch)">Glitch Effect (animate-glitch)</p>
             </div>
             <div className="space-y-4">
                 <h3 className="text-xl font-semibold font-orbitron text-brand-blue">Элементы с Эффектами</h3>
                 <div className="p-4 rounded-lg border-2 animate-neon-border-glow bg-card">
                     Border Neon Glow (animate-neon-border-glow)
                 </div>
                  <div className="p-4 rounded-lg border border-brand-purple/50 bg-card shadow-purple-500/20">
                     Shadow Glow (shadow-purple-glow variant)
                 </div>
                 <div className="p-4 rounded-lg border border-dashed border-border animate-glitch-border bg-card">
                     Glitch Border (animate-glitch-border)
                 </div>
                  <div className="h-24 rounded-lg bg-grid-pattern flex items-center justify-center text-sm text-brand-purple/70 border border-brand-purple/20">
                      Grid Pattern (.bg-grid-pattern)
                  </div>
                  <div className="h-24 rounded-lg bg-grid-pattern-pink flex items-center justify-center text-sm text-brand-pink/70 border border-brand-pink/20">
                      Pink Grid Pattern (.bg-grid-pattern-pink)
                  </div>
                 <div className="h-24 overflow-y-auto simple-scrollbar border border-border rounded p-2 text-xs"> 
                    <h4 className="font-bold mb-1">Custom Scrollbar (.simple-scrollbar)</h4>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                 </div>
             </div>
          </div>
        </section>

      </div>
    </div>
  );
}