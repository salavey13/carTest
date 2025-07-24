"use client";

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

const equipmentItems = [
    { name: "Шлем", price: 600, icon: "::FaHelmetSafety::" },
    { name: "Перчатки", price: 300, icon: "::FaGloves::" },
    { name: "Куртка", price: 500, icon: "::FaUserShield::" },
    { name: "Черепаха", price: 500, icon: "::FaShieldAlt::" },
    { name: "Мотоботы", price: 500, icon: "::FaShoePrints::" },
    { name: "Сумка на ногу", price: 300, icon: "::FaShoppingBag::" },
    { name: "Рюкзак", price: 500, icon: "::FaBriefcase::" },
    { name: "Гарнитура", price: 500, icon: "::FaHeadset::" },
    { name: "Экшн-камера", price: 1000, icon: "::FaVideo::" },
];

const EquipmentCard = ({ name, price, icon, delay }: { name: string; price: number; icon: string; delay: number; }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
    >
        <Card className="bg-card/80 backdrop-blur-sm h-full text-center">
            <CardHeader>
                <VibeContentRenderer content={icon} className="text-5xl text-brand-cyan mx-auto mb-2" />
                <CardTitle className="font-orbitron">{name}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold text-brand-yellow">{price} ₽/сутки</p>
            </CardContent>
        </Card>
    </motion.div>
);

export default function EquipmentPage() {
    return (
        <div className="min-h-screen pt-28 pb-16 bg-gradient-to-b from-black via-gray-900 to-black">
            <div className="container mx-auto max-w-5xl px-4">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl md:text-6xl font-orbitron text-shadow-neon">АРЕНДА ЭКИПИРОВКИ</h1>
                    <p className="text-muted-foreground mt-4">Полная защита для максимального вайба на дороге.</p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {equipmentItems.map((item, index) => (
                        <EquipmentCard key={item.name} {...item} delay={index * 0.05} />
                    ))}
                </div>
            </div>
        </div>
    );
}