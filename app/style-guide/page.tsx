// app/style-guide/page.tsx
import {
  Button,
  Input,
  Textarea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Switch,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Slider,
} from "@/components/ui";

export default function StyleGuide() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-12">
        {/* Buttons Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Buttons</h2>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        {/* Input Fields Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Form Elements</h2>
          <div className="space-y-4">
            <Input placeholder="Regular input" className="text-glow" />
            <Textarea placeholder="Textarea" className="text-glow" />
            <Input type="search" placeholder="Search input" />
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Option 1</SelectItem>
                <SelectItem value="2">Option 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Dropdown Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Dropdown</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Open Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Item 1</DropdownMenuItem>
              <DropdownMenuItem>Item 2</DropdownMenuItem>
              <DropdownMenuItem disabled>Disabled Item</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        {/* Toggle Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Toggles</h2>
          <div className="flex items-center space-x-4">
            <Switch id="toggle" />
            <Label htmlFor="toggle">Toggle</Label>
            <Checkbox />
            <Label>Checkbox</Label>
          </div>
        </section>

        {/* Slider Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Slider</h2>
          <Slider defaultValue={[50]} max={100} step={1} />
        </section>

        {/* Card Section */}
        <section>
          <h2 className="text-3xl mb-6 cyber-text">Cards</h2>
          <Card className="w-[350px]">
            <CardHeader>
              <CardTitle className="text-gradient">Card Title</CardTitle>
              <CardDescription className="text-muted-foreground">
                Card description
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-glow">Some card content here</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Card Action</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  );
}
