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
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
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
              "text-5xl md:text-6xl font-bold mb-2 font-orbitron",
              "text-transparent bg-clip-text bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-deep-indigo",
              "animate-glitch" 
            )}
            data-text="VIBECODING STYLE GUIDE"
          >
            VIBECODING STYLE GUIDE
          </h1>
          <p className="text-lg text-muted-foreground font-mono max-w-2xl mx-auto">
            Интерактивное руководство по методологии Vibe Coding и ее визуальным компонентам.
          </p>
        </header>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaPalette::" /> Цветовая Палитра</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 font-orbitron text-secondary">Новая Палитра (HSL Vars)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
                <ColorSwatch name="Red-Orange" className="bg-brand-red-orange" hslVar="--brand-red-orange" />
                <ColorSwatch name="Deep Indigo" className="bg-brand-deep-indigo" hslVar="--brand-deep-indigo" />
                <ColorSwatch name="Warm Gold" className="bg-brand-gold" hslVar="--brand-gold" />
                <ColorSwatch name="Cream Beige" className="bg-brand-beige" hslVar="--brand-beige" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 font-orbitron text-secondary">Основные Цвета UI (HSL Vars)</h3>
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
                <h3 className="text-xl font-semibold mb-4 font-orbitron text-secondary">Текстовые Цвета</h3>
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
                         <p className="text-light-text text-lg p-2 bg-background rounded border border-border">Light Text (FG)</p>
                         <p className="text-accent-text text-lg p-2 bg-background rounded border border-border">Accent Text (Brand)</p>
                    </div>
                </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaFont::" /> Типографика</h2>
          <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
            <h1 className="text-5xl md:text-6xl font-bold">Forget the Code, Not the Product</h1>
            <h2 className="text-4xl md:text-5xl">Embrace Exponentials</h2>
            <h3 className="text-3xl md:text-4xl">Focus on Leaf Nodes</h3>
            <h4 className="text-2xl md:text-3xl">Design for Verifiability</h4>
            <h5 className="text-xl md:text-2xl">Be the AI's Product Manager</h5>
            <h6 className="text-lg md:text-xl">Provide Clear Context</h6>
            <p className="text-lg font-sans">Vibe coding is where you fully give into the vibes, embrace exponentials, and forget that the code even exists. This is a powerful unlock, but it comes with responsibility.</p>
            <p className="font-sans">The length of tasks that AI can do is doubling every seven months. To take advantage of this, we must find a way to responsibly give into this and find some way to leverage this task.</p>
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
              "Ask not what Claude can do for you, but what you can do for Claude."
            </blockquote>
            <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-accent-text">core-architecture.ts</code>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto simple-scrollbar"> 
              <code className="text-sm font-mono text-accent-text">
                {`// We protect the core architecture.
// This is what other things are built on.
// We must ensure it stays extensible, understandable, and flexible.
function protectCoreSystem(isVerified: boolean) {
  if (!isVerified) {
    throw new Error("Human review required for core changes!");
  }
  return "Proceed with caution.";
}`}
              </code>
            </pre>
            <p><a href="#" className="text-accent hover:underline">Read more about leaf nodes</a></p>
            <p className="font-mono">Variable: `is_tech_debt_contained = true;`</p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaHandPointer::" /> Кнопки</h2>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold font-orbitron text-secondary">Действия</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="default">Embrace Exponential <VibeContentRenderer content="::FaRocket::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="secondary">Review Output <VibeContentRenderer content="::FaClipboardCheck::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="accent">Generate Leaf <VibeContentRenderer content="::FaLeaf::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="destructive">Abort Task <VibeContentRenderer content="::FaBan::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="outline">Verify Correctness <VibeContentRenderer content="::FaEye::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="ghost">Provide Context <VibeContentRenderer content="::FaFileLines::" className="ml-2 h-3 w-3"/></Button>
              <Button variant="link">Read Docs <VibeContentRenderer content="::FaBook::" className="ml-2 h-3 w-3"/></Button>
            </div>
             <h3 className="text-xl font-semibold font-orbitron text-secondary">Размеры</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><VibeContentRenderer content="::FaPlus::" /></Button>
            </div>
            <h3 className="text-xl font-semibold font-orbitron text-secondary">Состояния</h3>
             <div className="flex flex-wrap gap-4 items-center">
              <Button variant="default">Normal</Button>
              <Button variant="default" className="hover:bg-primary/90">Hover</Button>
              <Button variant="default" className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">Focus</Button>
              <Button variant="default" disabled>Disabled</Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaKeyboard::" /> Элементы Форм</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold font-orbitron text-secondary">Поля Ввода</h3>
              <div>
                <Label htmlFor="input-goal">High-Level Goal</Label>
                <Input id="input-goal" placeholder="e.g., 'Create a new landing page for a product'" className="input-cyber" />
              </div>
              <div>
                <Label htmlFor="textarea-context">Full Context & Requirements</Label>
                <Textarea id="textarea-context" placeholder="Provide all necessary context, requirements, constraints, and examples here. Think like a Product Manager for the AI." className="textarea-cyber simple-scrollbar" /> 
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold font-orbitron text-secondary">Выбор и Переключатели</h3>
              <Select>
                <SelectTrigger className="input-cyber">
                  <SelectValue placeholder="Select Codebase Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leaf">Leaf Node (UI, Safe) <VibeContentRenderer content="::FaLeaf::"/></SelectItem>
                  <SelectItem value="branch">Branch (Core Logic - Use Caution) <VibeContentRenderer content="::FaCodeBranch::"/></SelectItem>
                  <SelectItem value="trunk">Trunk (Architecture - Human Review!) <VibeContentRenderer content="::FaTriangleExclamation::"/></SelectItem>
                </SelectContent>
              </Select>
               <div className="flex items-center space-x-2 pt-4">
                <Checkbox id="checkbox-terms" />
                <Label htmlFor="checkbox-terms" className="text-sm font-medium leading-none">I understand this change will be deployed to prod</Label>
              </div>
               <div className="flex items-center space-x-2">
                 <Switch id="switch-dark" defaultChecked className="data-[state=checked]:bg-primary"/>
                 <Label htmlFor="switch-dark">Embrace The Exponential <VibeContentRenderer content="::FaChartLine::" className="inline ml-1"/></Label>
               </div>
               <h3 className="text-xl font-semibold font-orbitron text-secondary mt-6">Vibe Intensity</h3>
              <Slider defaultValue={[66]} max={100} step={1} className="[&>span:first-child]:bg-primary"/>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaLayerGroup::" /> Карточки Принципов</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-card border-border shadow-lg"> 
              <CardHeader>
                <CardTitle className="font-orbitron text-accent-text">1. Focus on Leaf Nodes</CardTitle>
                <CardDescription className="font-mono">Изолируй риски</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">It's okay if there is tech debt in these leaf nodes because nothing else depends on them. They're unlikely to change. This is the perfect place to let the AI cook.</p>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" size="sm">Create Leaf <VibeContentRenderer content="::FaLeaf::" className="ml-2"/></Button>
              </CardFooter>
            </Card>
             <Card className="bg-card border-primary/60 shadow-xl shadow-pink-glow">
              <CardHeader>
                <CardTitle className="font-orbitron text-primary">2. Be the AI's PM</CardTitle>
                <CardDescription className="font-mono">Обеспечь контекст</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">If it was a human's first day on the job, you wouldn't just say 'implement this feature'. Give a tour of the codebase, set requirements, and define constraints to set it up for success.</p>
              </CardContent>
              <CardFooter>
                 <Button variant="default" size="sm">Write Brief <VibeContentRenderer content="::FaPencil::" className="ml-2"/></Button>
              </CardFooter>
            </Card>
             <Card className="bg-gradient-to-br from-accent/5 via-card to-secondary/5 border-border shadow-inner">
               <CardHeader>
                <CardTitle className="font-orbitron text-accent">3. Design for Verifiability</CardTitle>
                 <CardDescription className="font-mono">Доверяй, но проверяй</CardDescription>
               </CardHeader>
               <CardContent>
                 <p className="text-sm">Design the system to have easily human-verifiable inputs and outputs. Create stress tests for stability so you can be confident without reading all the code.</p>
               </CardContent>
              <CardFooter>
                 <Button className="w-full" variant="accent">Run Stress Test <VibeContentRenderer content="::FaBolt::" className="ml-2"/></Button>
              </CardFooter>
             </Card>
          </div>
        </section>
        
        <section>
          <h2 className="text-3xl font-orbitron mb-6 text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaScroll::" /> Свиток Мудрости</h2>
          <div className="space-y-4">
              <div className="h-48 overflow-y-auto simple-scrollbar border border-border rounded p-4 text-sm bg-card"> 
                <h4 className="font-bold mb-2 font-orbitron text-secondary">Case Study: The 22,000-Line PR</h4>
                <p>We recently merged a 22,000-line change to our production reinforcement learning codebase that was written heavily by Claude. How on earth did we do this responsibly? First, we embraced our roles as the product manager for Claude. The change was largely concentrated in leaf nodes where we knew it was okay for there to be some tech debt because we didn't expect these parts of the codebase to need to change in the near future.</p><br/>
                <p>The parts of it that we did think were important, we did heavy human review of those parts. And lastly, we carefully designed stress tests for stability and designed the whole system so that it would have very easily human verifiable inputs and outputs. This let us create verifiable checkpoints so that we could make sure this was correct even without reading the full underlying implementation.</p><br/>
                <p>Ultimately, by combining those things we were able to become just as confident in this change as any other change that we made to our codebase but deliver it in a tiny fraction of the time and effort.</p>
             </div>
          </div>
        </section>

      </div>
    </div>
  );
}