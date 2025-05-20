"use client"; 

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

const ColorSwatch = ({ name, className, hslVar }: { name: string, className: string, hslVar?: string }) => (
  <div className="flex flex-col items-center space-y-1">
    <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-md border border-border", className)}></div>
    <span className="text-xs font-mono font-semibold">{name}</span>
    {hslVar && <code className="text-xs text-muted-foreground">{hslVar}</code>}
    {className.startsWith('bg-') && !hslVar && <code className="text-xs text-muted-foreground">.{className}</code>}
  </div>
);

export default function StyleGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-black to-card text-foreground p-4 pb-16">
      <div className="container mx-auto space-y-12 md:space-y-16">
        <header className="text-center mb-10 md:mb-12 mt-16 md:mt-20">
          <h1 
            className={cn(
              "text-4xl sm:text-5xl md:text-6xl font-bold mb-2",
              "gta-vibe-text-effect", 
              "animate-glitch" 
            )}
            data-text="CYBERVIBE STYLE GUIDE"
          >
            CYBERVIBE STYLE GUIDE
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground font-mono">
            Визуальный язык и компоненты платформы oneSitePls.
          </p>
        </header>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaPalette::" /> Цветовая Палитра</h2>
          <div className="space-y-6 md:space-y-8">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 font-orbitron text-brand-yellow">Брендовые Цвета (HSL Vars)</h3>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                <ColorSwatch name="Purple" className="bg-brand-purple" hslVar="--brand-purple" />
                <ColorSwatch name="Pink" className="bg-brand-pink" hslVar="--brand-pink" />
                <ColorSwatch name="Cyan" className="bg-brand-cyan" hslVar="--brand-cyan" />
                <ColorSwatch name="Orange" className="bg-brand-orange" hslVar="--brand-orange" />
                <ColorSwatch name="Yellow" className="bg-brand-yellow" hslVar="--brand-yellow" />
                <ColorSwatch name="Green" className="bg-brand-green" hslVar="--brand-green" />
                <ColorSwatch name="Blue" className="bg-brand-blue" hslVar="--brand-blue" />
                <ColorSwatch name="Lime" className="bg-brand-lime" hslVar="--brand-lime" />
              </div>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 font-orbitron text-brand-yellow">Основные Цвета UI (HSL Vars)</h3>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-5 gap-3 sm:gap-4"> {/* Adjusted xl cols */}
                <ColorSwatch name="Background" className="bg-background" hslVar="--background" />
                <ColorSwatch name="Foreground" className="bg-foreground border-destructive" hslVar="--foreground" />
                <ColorSwatch name="Card" className="bg-card" hslVar="--card" />
                <ColorSwatch name="Popover" className="bg-popover" hslVar="--popover" />
                <ColorSwatch name="Primary" className="bg-primary" hslVar="--primary" />
                <ColorSwatch name="Secondary" className="bg-secondary" hslVar="--secondary" />
                <ColorSwatch name="Muted" className="bg-muted" hslVar="--muted" />
                <ColorSwatch name="Accent" className="bg-accent" hslVar="--accent" />
                <ColorSwatch name="Destructive" className="bg-destructive" hslVar="--destructive" />
                <ColorSwatch name="Border" className="bg-border" hslVar="--border" />
                <ColorSwatch name="Input" className="bg-input" hslVar="--input" />
                <ColorSwatch name="Ring" className="bg-ring" hslVar="--ring" />
              </div>
            </div>
             <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 font-orbitron text-brand-yellow">Текстовые Цвета</h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                        <p className="text-foreground text-base sm:text-lg p-2 bg-card rounded">Foreground</p>
                        <p className="text-card-foreground text-base sm:text-lg p-2 bg-card rounded">Card FG</p>
                        <p className="text-popover-foreground text-base sm:text-lg p-2 bg-popover rounded">Popover FG</p>
                    </div>
                     <div className="space-y-1">
                        <p className="text-primary-foreground text-base sm:text-lg p-2 bg-primary rounded">Primary FG</p>
                        <p className="text-secondary-foreground text-base sm:text-lg p-2 bg-secondary rounded">Secondary FG</p>
                        <p className="text-accent-foreground text-base sm:text-lg p-2 bg-accent rounded">Accent FG</p>
                     </div>
                    <div className="space-y-1">
                        <p className="text-destructive-foreground text-base sm:text-lg p-2 bg-destructive rounded">Destructive FG</p>
                        <p className="text-muted-foreground text-base sm:text-lg p-2 bg-card rounded">Muted FG</p>
                    </div>
                    <div className="space-y-1">
                         <p className="text-light-text text-base sm:text-lg p-2 bg-background rounded">Light Text</p>
                         <p className="text-accent-text text-base sm:text-lg p-2 bg-background rounded">Accent Text</p>
                    </div>
                </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaFont::" /> Типографика</h2>
          <div className="space-y-3 sm:space-y-4 bg-card p-4 sm:p-6 rounded-lg border border-border">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">H1: Orbitron Заголовок</h1>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-orbitron">H2: Orbitron Заголовок</h2>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-orbitron">H3: Orbitron Заголовок</h3>
            <h4 className="text-xl sm:text-2xl md:text-3xl font-orbitron">H4: Orbitron Заголовок</h4>
            <h5 className="text-lg sm:text-xl md:text-2xl font-orbitron">H5: Orbitron Заголовок</h5>
            <h6 className="text-base sm:text-lg md:text-xl font-orbitron">H6: Orbitron Заголовок</h6>
            <p className="text-base sm:text-lg">Основной текст (Inter Regular, text-lg): The quick brown fox jumps over the lazy dog. Эталонная фраза, служащая для проверки правильности отображения шрифтов.</p>
            <p className="text-sm sm:text-base">Основной текст (Inter Regular, base): The quick brown fox jumps over the lazy dog. Эталонная фраза, служащая для проверки правильности отображения шрифтов.</p>
            <p className="text-xs sm:text-sm">Маленький текст (Inter Regular, text-sm): The quick brown fox jumps over the lazy dog.</p>
            <p className="text-xs">Очень маленький текст (Inter Regular, text-xs): The quick brown fox jumps over the lazy dog.</p>
            <p>Текст с <strong className="font-semibold">жирным выделением (semibold)</strong> и <em className="italic">курсивом</em>.</p>
            <blockquote className="border-l-4 border-brand-purple pl-3 sm:pl-4 italic text-muted-foreground">
              Блок цитаты: "Stay hungry. Stay foolish." - Steve Jobs
            </blockquote>
            <code className="bg-muted px-1 py-0.5 rounded text-xs sm:text-sm font-mono">inline code snippet</code>
            <pre className="bg-muted p-3 sm:p-4 rounded-md overflow-x-auto simple-scrollbar"> 
              <code className="text-xs sm:text-sm font-mono">
                {`// Code Block Example
function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}`}
              </code>
            </pre>
            <p><a href="#" className="text-brand-blue hover:underline">Ссылка (text-brand-blue)</a></p>
            <p className="font-mono text-xs sm:text-sm">Моноширинный текст (font-mono): Used for code, variables, etc. 1234567890</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaHandPointer::" /> Кнопки</h2>
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Варианты</h3>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center sm:justify-start">
              <Button variant="default">Primary <VibeContentRenderer content="::FaStar::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="secondary">Secondary <VibeContentRenderer content="::FaGears::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="accent">Accent <VibeContentRenderer content="::FaPaintbrush::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="destructive">Destructive <VibeContentRenderer content="::FaTrash::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="outline">Outline <VibeContentRenderer content="::FaSquarePen::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="ghost">Ghost <VibeContentRenderer content="::FaCode::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="link">Link <VibeContentRenderer content="::FaLink::" className="ml-2 h-3 w-3"/></Button>
            </div>
             <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Размеры</h3>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center sm:justify-start">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><VibeContentRenderer content="::FaPlus::" /></Button>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Состояния</h3>
             <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center sm:justify-start">
              <Button variant="default">Normal</Button>
              <Button variant="default" className="hover:bg-primary/90">Hover (Simulated)</Button>
              <Button variant="default" className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">Focus (Click Me)</Button>
              <Button variant="default" disabled>Disabled</Button>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">С иконками</h3>
             <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center sm:justify-start">
                <Button><VibeContentRenderer content="::FaFloppyDisk::" className="mr-2 h-4 w-4" /> Save Changes</Button>
                <Button variant="outline"><VibeContentRenderer content="::FaPaperPlane::" className="mr-2 h-4 w-4" /> Submit</Button>
                <Button variant="destructive" size="icon"><VibeContentRenderer content="::FaTrash::" /></Button>
                <Button variant="ghost" size="icon" className="rounded-full"><VibeContentRenderer content="::FaUser::" /></Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaKeyboard::" /> Элементы Форм</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Inputs & Textarea</h3>
              <div>
                <Label htmlFor="input-normal">Normal Input</Label>
                <Input id="input-normal" placeholder="Placeholder..." className="input-cyber" />
              </div>
              <div>
                <Label htmlFor="input-error">Error Input</Label>
                <Input id="input-error" placeholder="Error state" className="input-cyber border-destructive focus:ring-destructive" />
              </div>
              <div>
                <Label htmlFor="input-disabled">Disabled Input</Label>
                <Input id="input-disabled" placeholder="Disabled" className="input-cyber" disabled />
              </div>
              <div>
                <Label htmlFor="textarea-normal">Textarea</Label>
                <Textarea id="textarea-normal" placeholder="Type your message here." className="textarea-cyber simple-scrollbar" />
              </div>
              <div>
                <Label htmlFor="textarea-disabled">Disabled Textarea</Label>
                <Textarea id="textarea-disabled" placeholder="Disabled textarea" className="textarea-cyber simple-scrollbar" disabled /> 
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Select</h3>
              <Select>
                <SelectTrigger className="input-cyber">
                  <SelectValue placeholder="Select a Vibe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chill">Chill <VibeContentRenderer content="::FaSnowflake::"/></SelectItem>
                  <SelectItem value="cyber">Cyber <VibeContentRenderer content="::FaRobot::"/></SelectItem>
                  <SelectItem value="hype">Hype <VibeContentRenderer content="::FaBolt::"/></SelectItem>
                </SelectContent>
              </Select>
              <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow mt-4 md:mt-6">Toggles</h3>
               <div className="flex items-center space-x-2">
                <Checkbox id="checkbox-terms" />
                <Label htmlFor="checkbox-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Accept terms and conditions</Label>
              </div>
              <RadioGroup defaultValue="option-one" className="space-y-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-one" id="radio-one" />
                  <Label htmlFor="radio-one">Option One</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-two" id="radio-two" />
                  <Label htmlFor="radio-two">Option Two</Label>
                </div>
              </RadioGroup>
              <div className="flex items-center space-x-2">
                  <Switch id="switch-airplane" />
                  <Label htmlFor="switch-airplane">Airplane Mode</Label>
              </div>
               <div className="flex items-center space-x-2">
                  <Switch id="switch-disabled" disabled />
                  <Label htmlFor="switch-disabled">Disabled Switch</Label>
              </div>
               <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow mt-4 md:mt-6">Slider</h3>
              <Slider defaultValue={[66]} max={100} step={1} className="[&>span:first-child]:bg-brand-pink"/>
              <Slider defaultValue={[33]} max={100} step={1} disabled />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaIdCard::" /> Карточки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <Card className="bg-card border-brand-purple/50 shadow-lg shadow-purple-glow"> 
              <CardHeader>
                <CardTitle className="font-orbitron text-brand-purple">Стандартная Карта</CardTitle>
                <CardDescription>Описание для стандартной карты.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Контент карты. Здесь может быть любая информация, отображаемая в теле карточки.</p>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" className="w-full">Действие</Button>
              </CardFooter>
            </Card>

            <Card className="border-brand-pink/60 shadow-pink-glow">
              <CardHeader>
                 <CardTitle className="font-orbitron text-brand-pink flex items-center gap-2">
                    <VibeContentRenderer content="::FaLightbulb::" /> Карта с Иконкой
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VibeContentRenderer content="Эта карта использует иконку в заголовке и имеет **розовый** акцент. ::FaRocket color='var(--brand-pink)'::" />
              </CardContent>
            </Card>

            <Card className="border-brand-cyan/50 bg-gradient-to-br from-card to-black/30 shadow-cyan-glow">
               <CardHeader>
                <CardTitle className="font-orbitron text-brand-cyan">Карта с градиентом</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Эта карта использует градиентный фон и голубой акцент.</p>
                <Button variant="outline" className="mt-4 border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 hover:text-brand-cyan">
                  <VibeContentRenderer content="::FaPlay::" className="mr-2" /> Начать
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaDiagramProject::" /> Другие Элементы</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
             <div>
                <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow mb-3 sm:mb-4">Dropdown Menu</h3>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline">Открыть Меню <VibeContentRenderer content="::FaGears::" className="ml-2 h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Мой Аккаунт</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><VibeContentRenderer content="::FaUser::" className="mr-2 h-4 w-4" /> Профиль</DropdownMenuItem>
                    <DropdownMenuItem><VibeContentRenderer content="::FaCreditCard::" className="mr-2 h-4 w-4" /> Биллинг</DropdownMenuItem>
                    <DropdownMenuItem><VibeContentRenderer content="::FaKeyboard::" className="mr-2 h-4 w-4" /> Горячие клавиши</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/20 focus:text-destructive-foreground"><VibeContentRenderer content="::FaRightFromBracket::" className="mr-2 h-4 w-4" /> Выйти</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div>
                <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow mb-3 sm:mb-4">Пример с VibeContentRenderer</h3>
                 <div className="bg-card p-3 sm:p-4 rounded-lg border border-border space-y-2">
                    <VibeContentRenderer content="Это **жирный** текст с иконкой ::FaStar color='gold':: и *курсивом*." className="text-xs sm:text-sm"/>
                    <VibeContentRenderer content="Ссылка на [Google](https://google.com) ::FaGoogle:: и FontAwesome ::FaFontAwesome::" className="text-xs sm:text-sm"/>
                    <VibeContentRenderer content="Ошибка: ::faInvalidIcon:: <FaNonExistent />" className="text-xs sm:text-sm"/>
                 </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl sm:text-3xl font-orbitron mb-4 sm:mb-6 text-brand-cyan cyber-text flex items-center gap-2"><VibeContentRenderer content="::FaPaintbrush::" /> Эффекты и Утилиты</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
             <div className="space-y-3 sm:space-y-4">
                <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Текстовые Эффекты</h3>
                 <p className="cyber-text text-base sm:text-lg" data-text="Cyber Text (.cyber-text)">Cyber Text (.cyber-text)</p>
                 <p className="text-base sm:text-lg text-gradient">Text Gradient (.text-gradient)</p>
                 <p className="text-base sm:text-lg text-glow animate-pulse-slow">Text Glow + Pulse Slow</p> 
                 <p className="text-base sm:text-lg text-shadow-neon">Neon Shadow (.text-shadow-neon)</p>
                 <p className="text-base sm:text-lg text-shadow-cyber">Cyber Shadow (.text-shadow-cyber)</p>
                 <p className="text-base sm:text-lg text-animated-gradient">Animated Gradient Text</p>
                 <p className="text-base sm:text-lg animate-glitch" data-text="Glitch Effect (animate-glitch)">Glitch Effect (animate-glitch)</p>
             </div>
             <div className="space-y-3 sm:space-y-4">
                 <h3 className="text-lg sm:text-xl font-semibold font-orbitron text-brand-yellow">Элементы с Эффектами</h3>
                 <div className="p-3 sm:p-4 rounded-lg border-2 animate-neon-border-glow bg-card">
                     Border Neon Glow (animate-neon-border-glow)
                 </div>
                  <div className="p-3 sm:p-4 rounded-lg border border-brand-purple/50 bg-card shadow-purple-glow">
                     Shadow Glow (shadow-purple-glow)
                 </div>
                 <div className="p-3 sm:p-4 rounded-lg border border-dashed border-border animate-glitch-border bg-card">
                     Glitch Border (animate-glitch-border)
                 </div>
                  <div className="h-20 sm:h-24 rounded-lg bg-grid-pattern flex items-center justify-center text-xs text-brand-purple/70 border border-brand-purple/20">
                       Grid Pattern (.bg-grid-pattern)
                   </div>
                  <div className="h-20 sm:h-24 rounded-lg bg-grid-pattern-pink flex items-center justify-center text-xs text-brand-pink/70 border border-brand-pink/20">
                       Pink Grid Pattern (.bg-grid-pattern-pink)
                   </div>
                 <div className="h-20 sm:h-24 overflow-y-auto simple-scrollbar border border-border rounded p-2 text-xs"> 
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