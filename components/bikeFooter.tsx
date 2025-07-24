"use client";

import Link from 'next/link';
import { VibeContentRenderer } from './VibeContentRenderer';

const SocialLink = ({ href, icon, ariaLabel }: { href: string; icon: string; ariaLabel: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className="text-muted-foreground hover:text-brand-cyan transition-colors">
        <VibeContentRenderer content={icon} className="h-6 w-6" />
    </a>
);

export default function bikeFooter() {
    return (
        <footer className="bg-black/80 backdrop-blur-sm border-t border-border/20 mt-auto">
            <div className="container mx-auto max-w-7xl px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* About */}
                    <div className="space-y-2">
                        <h4 className="font-orbitron text-lg text-brand-lime">VibeRide</h4>
                        <p className="text-sm text-muted-foreground">Не просто аренда. Это твой город. Твои правила. Твой экипаж.</p>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-2">
                        <h4 className="font-orbitron text-lg">Навигация</h4>
                        <ul className="space-y-1 text-sm">
                            <li><Link href="/vipbikerental" className="text-muted-foreground hover:text-white">Гараж</Link></li>
                            <li><Link href="/equipment" className="text-muted-foreground hover:text-white">Экипировка</Link></li>
                            <li><Link href="/crews" className="text-muted-foreground hover:text-white">Экипажи</Link></li>
                            <li><Link href="/paddock" className="text-muted-foreground hover:text-white">Паддок</Link></li>
                        </ul>
                    </div>

                    {/* Contacts & Socials */}
                     <div className="space-y-2">
                        <h4 className="font-orbitron text-lg">Контакты</h4>
                        <div className="flex items-center gap-4">
                            <SocialLink href="https://t.me/I_O_S_NN" icon="::FaTelegram::" ariaLabel="Telegram" />
                            <SocialLink href="https://vk.com/vip_bike" icon="::FaVk::" ariaLabel="VK" />
                            <SocialLink href="https://www.instagram.com/vipbikerental_nn" icon="::FaInstagram::" ariaLabel="Instagram" />
                        </div>
                         <p className="text-sm text-muted-foreground pt-2">Работаем для вас 24/7</p>
                    </div>
                </div>
                <div className="mt-8 border-t border-border/10 pt-4 text-center text-xs text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} VibeRide. All rights reserved. Built on oneSitePls.</p>
                </div>
            </div>
        </footer>
    );
}