export const colors = [
  {
    category: "A1",
    color: "rgb(81,132,178)",
    content: "Grains"
  },
  {
    category: "A2",
    color: "rgb(170,212,248)",
    content: "Vegetables"
  },
  {
    category: "A3",
    color: "rgb(119,194,243)",
    content: "Fruits"
  },
  {
    category: "B1",
    color: "rgb(213,82,118)",
    content: "Meat"
  },
  {
    category: "B2",
    color: "rgb(241,167,181)",
    content: "Egg & Dairy"
  },
  {
    category: "B3",
    color: "rgb(169,111,176)",
    content: "Seafood"
  },
  {
    category: "C",
    color: "rgb(139,95,162)",
    content: "Processed food"
  },
  {
    category: "D",
    color: "rgb(182,136,203)",
    content: "Condiments"
  },
];

export const getCategoryColor = (type: string) => {
  const item = colors.find((color: any) => color.category === type);

  if (item) {
    return item.color;
  }
  return "rgb(247,238,246)";
};
