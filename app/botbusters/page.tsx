// page.tsx
"use client"
import { useTelegram } from '@/hooks/useTelegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// BotBustersHeader: Navigation bar for the app
function BotBustersHeader() {
  return (
    <header className="bg-gray-800 p-4 pt-24 sticky top-0 z-10">
      <nav className="flex justify-between items-center container mx-auto">
        <div className="text-xl font-bold">BotBusters</div>
        <div className="space-x-4">
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Home
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Submit Blocklist
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Tips
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Automa Scripts
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Stats
          </Button>
        </div>
      </nav>
    </header>
  );
}

// BotBustersHeroSection: Bold introduction with CTA
function BotBustersHeroSection() {
  return (
    <section className="text-center py-16 bg-gray-900">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Join the Fight Against Bots on 9GAG!
      </h1>
      <p className="text-lg md:text-xl mb-8 text-gray-300">
        Help us keep 9GAG bot-free with powerful tools and community action.
      </p>
      <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
        Get Started
      </Button>
    </section>
  );
}

// BotBustersFeaturesSection: Showcase core tools
function BotBustersFeaturesSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">Our Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 container mx-auto px-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Block'em All</CardTitle>
          </CardHeader>
          <CardContent>Batch-block known bots with one click.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Purge'em All</CardTitle>
          </CardHeader>
          <CardContent>Report and cleanse bot activity in bulk.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Hunter</CardTitle>
          </CardHeader>
          <CardContent>Find new bots by tracing their network.</CardContent>
        </Card>
      </div>
    </section>
  );
}

// BotBustersBlocklistFormSection: Form for submitting bot usernames
function BotBustersBlocklistFormSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">Submit Your Blocklist</h2>
      <form className="max-w-md mx-auto space-y-4">
        <Input
          placeholder="Enter bot usernames (comma-separated)"
          className="bg-gray-800 border-gray-700 text-white"
        />
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
          Submit
        </Button>
      </form>
    </section>
  );
}

// BotBustersTipsSection: Tips for spotting bots
function BotBustersTipsSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">How to Spot a Bot</h2>
      <ul className="list-disc list-inside max-w-md mx-auto text-gray-300">
        <li>Repetitive comments like "lol nice" on every post.</li>
        <li>Usernames with random numbers (e.g., User12345).</li>
        <li>Accounts with hundreds of posts but no followers.</li>
      </ul>
    </section>
  );
}

// BotBustersAutomaScriptsSection: Automa script downloads and explanation
function BotBustersAutomaScriptsSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">Download Automa Scripts</h2>
      <p className="text-center mb-8 max-w-2xl mx-auto text-gray-300">
        Our tools are powered by{' '}
        <a href="https://www.automa.app/" className="text-blue-400 hover:underline">
          Automa
        </a>
        , a browser extension that automates tasks with real clicks and smart JavaScript. From
        scraping bot data to blocking them in bulk, Automa handles it all—no complex setups needed.
        With built-in scheduling, you can set it to run daily and keep 9GAG clean!
      </p>
      <div className="flex justify-center space-x-4">
        <Button className="bg-blue-600 hover:bg-blue-700">Block'em All</Button>
        <Button className="bg-blue-600 hover:bg-blue-700">Purge'em All</Button>
        <Button className="bg-blue-600 hover:bg-blue-700">Hunter</Button>
      </div>
    </section>
  );
}

// BotBustersDailyStatsSection: Placeholder for bot-hunting stats
function BotBustersDailyStatsSection() {
  return (
    <section className="py-16 bg-gray-900 text-center">
      <h2 className="text-3xl font-bold mb-4">Daily Bot-Hunting Stats</h2>
      <div className="text-gray-300">
        <p>Bots Blocked: 0</p>
        <p>Reports Filed: 0</p>
        <p>Queen Bots Dethroned: 0</p>
      </div>
    </section>
  );
}

// BotBustersFooter: Links to Telegram, newsletter, and support
function BotBustersFooter() {
  return (
    <footer className="bg-gray-800 p-4 text-center">
      <div className="space-x-4">
        <Button variant="link" className="text-gray-300 hover:text-white">
          Telegram Group
        </Button>
        <Button variant="link" className="text-gray-300 hover:text-white">
          Newsletter
        </Button>
        <Button variant="link" className="text-gray-300 hover:text-white">
          Support Us
        </Button>
      </div>
    </footer>
  );
}

// Main Home component: The default export of page.tsx
export default function BotBustersHome() {
  const { dbUser } = useTelegram();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <BotBustersHeader />
        <BotBustersHeroSection />
        <BotBustersFeaturesSection />
        {dbUser && <BotBustersBlocklistFormSection />} {/* Only show if authenticated */}
        <BotBustersTipsSection />
        <BotBustersAutomaScriptsSection />
        <BotBustersDailyStatsSection />
      <BotBustersFooter />
    </div>
  );
}
