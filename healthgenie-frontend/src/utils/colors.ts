const categoryColors: { [key: string]: string } = {
  menu: '#BDC3C7',      // Gray for menu items
  effect: '#4ECDC4',    // Teal for effects
  A1: '#45B7D1',       // Blue for category A1
  A2: '#96CEB4',       // Green for category A2
  A3: '#FFEEAD',       // Yellow for category A3
  B1: '#D4A5A5',       // Pink for category B1
  B2: '#9B59B6',       // Purple for category B2
  B3: '#3498DB',       // Light blue for category B3
  D: '#95A5A6'         // Gray for category D
};

export function getNodeColor(category: string): string {
  return categoryColors[category] || '#BDC3C7'; // Default gray if category not found
} 