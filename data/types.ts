// data/types.ts
export interface Question {
  id: number;
  text: string;
  answers: Answer[];
}

export interface Answer {
  text: string;
  nextQuestion?: number;
  result?: string;
}

export interface Result {
  car: string;
  description: string;
  vibe: 'neon' | 'flames' | 'luxury';
}

export interface Node {
  id: string;
  x: number;
  y: number;
  text: string;
  isAnswer: boolean;
  connectedTo?: string[];
}

