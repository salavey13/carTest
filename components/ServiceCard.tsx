import React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';

type ServiceCardItem = {
  icon: string;
  text: string;
};

type ServiceCardProps = {
  title: string;
  icon: string;
  borderColorClass: string;
  items: ServiceCardItem[];
  imageUrl?: string;
};

export const ServiceCard: React.FC<ServiceCardProps> = ({ title, icon, borderColorClass, items, imageUrl }) => {
  return (
    <Card className={cn("bg-card/50 backdrop-blur-sm border-t-4 rounded-lg overflow-hidden h-full flex flex-col", borderColorClass)}>
      <CardHeader className="flex flex-row items-center gap-3">
        <VibeContentRenderer content={icon} className="w-8 h-8" />
        <CardTitle className="font-orbitron text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {imageUrl && (
          <div className="relative h-40 w-full mb-4 rounded-md overflow-hidden">
            <Image src={imageUrl} alt={title} layout="fill" objectFit="cover" />
          </div>
        )}
        <ul className="space-y-3 mt-2 flex-grow">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-3 text-foreground/90">
              <VibeContentRenderer content={item.icon} className="w-5 h-5 text-current" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};