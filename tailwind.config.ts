import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
      colors: {
        // Core UI colors referencing CSS variables
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: {
          DEFAULT: "hsl(var(--input))", // For input background
          border: "hsl(var(--input-border))", // For input border
        },
        ring: "hsl(var(--ring))",
        muted: "hsl(var(--muted))", // Added muted here for bg-muted to work generally
        
        // Brand colors referencing CSS variables
        "brand-purple": "hsl(var(--brand-purple))",
        "brand-pink": "hsl(var(--brand-pink))",
        "brand-cyan": "hsl(var(--brand-cyan))",
        "brand-blue": "hsl(var(--brand-blue))",
        "brand-yellow": "hsl(var(--brand-yellow))",
        "brand-green": "hsl(var(--brand-green))",
        "brand-orange": "hsl(var(--brand-orange))",
        "brand-lime": "hsl(var(--brand-lime))", 
        "neon-lime": "hsl(var(--brand-lime))", 

        // Text specific colors referencing CSS variables
        "light-text": "hsl(var(--light-text))", 
        "accent-text": "hsl(var(--accent-text))", 
        
        // Chart colors referencing CSS variables
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // Sidebar colors referencing CSS variables
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        mono: ["monospace", ...fontFamily.mono],
        orbitron: ["Orbitron", "sans-serif"],
      },
      boxShadow: { // Shadows might need adjustment for light theme if too heavy
        "glow-sm": "0 0 8px rgba(var(--default-glow-rgb), 0.5)",
        "glow-md": "0 0 15px rgba(var(--default-glow-rgb), 0.6)",
        "glow-lg": "0 0 25px rgba(var(--default-glow-rgb), 0.7)",
        "yellow-glow": "0 0 15px hsla(var(--yellow-rgb), 0.4), 0 0 30px hsla(var(--yellow-rgb), 0.2)",
        "purple-glow": "0 0 15px hsla(var(--purple-rgb), 0.4), 0 0 30px hsla(var(--purple-rgb), 0.2)",
        "green-glow": "0 0 15px hsla(var(--green-rgb), 0.4), 0 0 30px hsla(var(--green-rgb), 0.2)",
        "pink-glow": "0 0 15px hsla(var(--pink-rgb), 0.4), 0 0 30px hsla(var(--pink-rgb), 0.2)",
        "blue-glow": "0 0 15px hsla(var(--blue-rgb), 0.4), 0 0 30px hsla(var(--blue-rgb), 0.2)",
        "cyan-glow": "0 0 15px hsla(var(--cyan-rgb), 0.4), 0 0 30px hsla(var(--cyan-rgb), 0.2)",
        "orange-glow": "0 0 15px hsla(var(--orange-rgb), 0.4), 0 0 30px hsla(var(--orange-rgb), 0.2)",
        "lime-glow": "0 0 15px hsla(var(--lime-rgb),0.4),0 0 30px hsla(var(--lime-rgb),0.2)", 
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "page-gradient":"linear-gradient(145deg, hsl(var(--background)), hsl(var(--card)))", // Will adapt to light/dark
        "brand-gradient-purple-blue": "linear-gradient(to right, hsl(var(--brand-purple)), hsl(var(--brand-blue)))",
        "brand-gradient-pink-purple": "linear-gradient(to right, hsl(var(--brand-pink)), hsl(var(--brand-purple)))",
      },
      animation: {
        "subtle-pulse": "subtle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gradient-shift": "gradientShift 10s infinite linear", 
        "glitch": "glitch 1s linear infinite", 
        "glitch-anim-1": "glitch-anim-1 2s infinite linear alternate-reverse", 
        "glitch-anim-2": "glitch-anim-2 2s infinite linear alternate-reverse", 
        "gradient-text-flow": "gradient-text-flow 3s linear infinite", 
        "wiggle": "wiggle 0.5s ease-in-out infinite", 
        "pulse-slow": "pulse-slow 3s infinite ease-in-out", 
        "neon-border-glow": "neon-border-glow 2.5s infinite alternate", 
        "glitch-border": "glitch-border 2s linear infinite", 
        "ticker": "ticker 20s linear infinite",
      },
      keyframes: { // Keyframes remain the same, their perceived effect might change with colors
        "subtle-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".7" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        gradientShift: { '0%': { backgroundPosition: '0% 0%' }, '50%': { backgroundPosition: '100% 100%' }, '100%': { backgroundPosition: '0% 0%' }},
        glitch: { '0%':{textShadow:'0.05em 0 0 hsla(var(--pink-rgb),0.75),-0.05em -0.025em 0 hsla(var(--green-rgb),0.75),-0.025em .05em 0 hsla(var(--cyan-rgb),0.75)'},'14%':{textShadow:'0.05em 0 0 hsla(var(--pink-rgb),0.75),-0.05em -0.025em 0 hsla(var(--green-rgb),0.75),-0.025em .05em 0 hsla(var(--cyan-rgb),0.75)'},'15%':{textShadow:'-0.05em -0.025em 0 hsla(var(--pink-rgb),0.75),.025em .025em 0 hsla(var(--green-rgb),0.75),-0.05em -0.05em 0 hsla(var(--cyan-rgb),0.75)'},'49%':{textShadow:'-0.05em -0.025em 0 hsla(var(--pink-rgb),0.75),.025em .025em 0 hsla(var(--green-rgb),0.75),-0.05em -0.05em 0 hsla(var(--cyan-rgb),0.75)'},'50%':{textShadow:'.025em .05em 0 hsla(var(--pink-rgb),0.75),.05em 0 0 hsla(var(--green-rgb),0.75),0 -.05em 0 hsla(var(--cyan-rgb),0.75)'},'99%':{textShadow:'.025em .05em 0 hsla(var(--pink-rgb),0.75),.05em 0 0 hsla(var(--green-rgb),0.75),0 -.05em 0 hsla(var(--cyan-rgb),0.75)'},'100%':{textShadow:'-.025em 0 0 hsla(var(--pink-rgb),0.75),-.025em -0.025em 0 hsla(var(--green-rgb),0.75),-.025em -0.05em 0 hsla(var(--cyan-rgb),0.75)'}},
        'glitch-anim-1': { '0%':{clip:'rect(44px,9999px,49px,0)'},'5%':{clip:'rect(5px,9999px,100px,0)'},'10%':{clip:'rect(13px,9999px,60px,0)'},'15%':{clip:'rect(80px,9999px,40px,0)'},'20%':{clip:'rect(22px,9999px,75px,0)'},'25%':{clip:'rect(90px,9999px,15px,0)'},'30%':{clip:'rect(50px,9999px,88px,0)'},'35%':{clip:'rect(10px,9999px,45px,0)'},'40%':{clip:'rect(70px,9999px,30px,0)'},'45%':{clip:'rect(25px,9999px,95px,0)'},'50%':{clip:'rect(60px,9999px,20px,0)'},'55%':{clip:'rect(5px,9999px,55px,0)'},'60%':{clip:'rect(75px,9999px,35px,0)'},'65%':{clip:'rect(18px,9999px,80px,0)'},'70%':{clip:'rect(85px,9999px,22px,0)'},'75%':{clip:'rect(40px,9999px,65px,0)'},'80%':{clip:'rect(3px,9999px,90px,0)'},'85%':{clip:'rect(68px,9999px,28px,0)'},'90%':{clip:'rect(33px,9999px,77px,0)'},'95%':{clip:'rect(98px,9999px,10px,0)'},'100%':{clip:'rect(52px,9999px,58px,0)'}},
        'glitch-anim-2': { '0%':{clip:'rect(6px,9999px,94px,0)'},'5%':{clip:'rect(88px,9999px,12px,0)'},'10%':{clip:'rect(38px,9999px,68px,0)'},'15%':{clip:'rect(20px,9999px,85px,0)'},'20%':{clip:'rect(72px,9999px,18px,0)'},'25%':{clip:'rect(10px,9999px,90px,0)'},'30%':{clip:'rect(58px,9999px,32px,0)'},'35%':{clip:'rect(80px,9999px,8px,0)'},'40%':{clip:'rect(28px,9999px,78px,0)'},'45%':{clip:'rect(42px,9999px,52px,0)'},'50%':{clip:'rect(92px,9999px,25px,0)'},'55%':{clip:'rect(15px,9999px,82px,0)'},'60%':{clip:'rect(62px,9999px,42px,0)'},'65%':{clip:'rect(4px,9999px,70px,0)'},'70%':{clip:'rect(77px,9999px,10px,0)'},'75%':{clip:'rect(22px,9999px,88px,0)'},'80%':{clip:'rect(50px,9999px,48px,0)'},'85%':{clip:'rect(95px,9999px,38px,0)'},'90%':{clip:'rect(30px,9999px,60px,0)'},'95%':{clip:'rect(65px,9999px,15px,0)'},'100%':{clip:'rect(8px,9999px,98px,0)'}},
        'gradient-text-flow': { to: { backgroundPosition: '200% center' }},
        wiggle: { '0%, 100%': { transform: 'rotate(-3deg)' },'50%': { transform: 'rotate(3deg)' }},
        'pulse-slow': { '0%, 100%': { opacity: '0.8', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.02)' }},
        'neon-border-glow': { '0%,100%':{borderColor:'hsla(var(--cyan-rgb),0.7)',boxShadow:'0 0 5px hsla(var(--cyan-rgb),0.5), 0 0 10px hsla(var(--cyan-rgb),0.3)'},'50%':{borderColor:'hsla(var(--pink-rgb),0.7)',boxShadow:'0 0 8px hsla(var(--pink-rgb),0.5), 0 0 15px hsla(var(--pink-rgb),0.3), 0 0 5px hsla(var(--purple-rgb),0.2)'}},
        'glitch-border': { '0%,100%':{borderColor:'hsla(var(--cyan-rgb),.3)',boxShadow:'0 0 5px hsla(var(--cyan-rgb),.2),inset 0 0 3px hsla(var(--cyan-rgb),.1)'},'25%':{borderColor:'hsla(var(--pink-rgb),.3)',boxShadow:'0 0 8px hsla(var(--pink-rgb),.3),inset 0 0 3px hsla(var(--pink-rgb),.1)'},'50%':{borderColor:'hsla(var(--yellow-rgb),.3)',boxShadow:'0 0 5px hsla(var(--yellow-rgb),.2),inset 0 0 3px hsla(var(--yellow-rgb),.1)'},'75%':{borderColor:'hsla(var(--green-rgb),.3)',boxShadow:'0 0 8px hsla(var(--green-rgb),.3),inset 0 0 3px hsla(var(--green-rgb),.1)'}},
        ticker: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [typography, animate],
};

export default config;