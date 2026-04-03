// Shared product categories used across the app
// Keep in sync with the edge function extract-product/index.ts

export const CATEGORIES = [
  "Eletrônicos e Informática",
  "Celulares e Smartphones",
  "Computadores e Notebooks",
  "Games e Consoles",
  "TV, Áudio e Vídeo",
  "Moda Feminina",
  "Moda Masculina",
  "Moda Infantil",
  "Calçados e Tênis",
  "Bolsas e Acessórios",
  "Relógios e Joias",
  "Beleza e Cuidados Pessoais",
  "Saúde e Bem-Estar",
  "Casa e Decoração",
  "Cozinha e Utilidades",
  "Eletrodomésticos",
  "Ferramentas e Construção",
  "Esportes e Fitness",
  "Brinquedos e Jogos",
  "Bebês e Maternidade",
  "Livros e Papelaria",
  "Pet Shop",
  "Automotivo",
  "Jardim e Piscina",
  "Alimentos e Bebidas",
  "Instrumentos Musicais",
  "Escritório e Material Escolar",
] as const;

export type CategoryName = typeof CATEGORIES[number];

// Primary categories shown as quick-filter chips
export const PRIMARY_CATEGORIES = [
  "Eletrônicos e Informática",
  "Moda Feminina",
  "Moda Masculina",
  "Casa e Decoração",
  "Beleza e Cuidados Pessoais",
  "Esportes e Fitness",
] as const;
