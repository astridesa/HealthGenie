export interface Node {
  id: number;
  chinese: string;
  name: string;
  category: string;
  isShared: boolean;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface Link {
  source: number;
  target: number;
  relation: string;
  isShared: boolean;
} 