"use client";
import { useState } from 'react';
import { Menu, X, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";

export function FixedHeader() {
  const { dbUser } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "#", label: "Главная" },
    { href: "#features", label: "Возможности" },
    { href: "#pricing", label: "Тарифы" },
    { href: "#audit-tool", label: "Аудит" },
    { href: "#invite", label: "Пригласить команду" }, // Add ID to the Invite section in page.tsx
    { href: "https://github.com/salavey13/carTest", label: "GitHub", external: true },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
            alt="Логотип" 
            width={40} 
            height={40} 
            className="rounded-full"
          />
          <span className="font-bold text-xl text-blue-600">WarehouseBot</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className="text-gray-700 hover:text-blue-600 transition-colors"
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User/Login + Hamburger */}
        <div className="flex items-center gap-4">
          {dbUser ? (
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {dbUser.username || 'Профиль'}
            </Button>
          ) : (
            <Button variant="outline">Войти</Button>
          )}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <nav className="md:hidden bg-white border-t py-4 px-4">
          <ul className="space-y-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link 
                  href={link.href} 
                  className="block text-gray-700 hover:text-blue-600"
                  onClick={() => setIsMenuOpen(false)}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}