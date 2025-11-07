export interface Product {
  title: string;
  description: string;
  price: number;
  image: { web: string; mobile: string };
  link: string;
  theme: { bg: string; text: string };
  tags: string[];
  layout: 'default' | 'horizontal' | 'vertical';
}

export interface Story {
  quote: string;
  name: string;
  platform: string;
  image: string;
  link: string;
  verified?: boolean;
  followers?: string;
}

export interface Benefit {
  title: string;
  description: string;
  image: { web: string; mobile: string };
  theme: { bg: string; text: string };
  variant: 'default' | 'center';
}

export interface ReferralStep {
  title: string;
  description: string;
  image: { web: string; mobile: string };
}

export interface HeroSlide {
  title: string;
  subtitle: string;
  cta: { text: string; link: string };
  theme: { bg: string; text: string };
  images: { web: string; mobile: string };
}