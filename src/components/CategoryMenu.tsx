import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

interface CategoryMenuProps {
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
}

const CategoryMenu = ({ activeCategory, onSelectCategory }: CategoryMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (cat: string) => {
    onSelectCategory(cat);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className={`p-2.5 rounded-full transition-all ${
          isOpen
            ? "gradient-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground border border-border hover:border-primary/40"
        }`}
        aria-label="Todas as categorias"
      >
        {isOpen ? <X size={18} /> : <MoreHorizontal size={18} />}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          onMouseLeave={() => setIsOpen(false)}
          className="absolute right-0 top-full mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-xl bg-card border border-border shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Todas as categorias
            </p>
          </div>

          <button
            onClick={() => handleSelect("Todos")}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
              activeCategory === "Todos"
                ? "gradient-primary text-primary-foreground font-medium"
                : "text-foreground hover:bg-secondary"
            }`}
          >
            🏠 Todos os produtos
          </button>

          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelect(cat)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeCategory === cat
                  ? "gradient-primary text-primary-foreground font-medium"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              {getCategoryEmoji(cat)} {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    "Eletrônicos e Informática": "💻",
    "Celulares e Smartphones": "📱",
    "Computadores e Notebooks": "🖥️",
    "Games e Consoles": "🎮",
    "TV, Áudio e Vídeo": "📺",
    "Moda Feminina": "👗",
    "Moda Masculina": "👔",
    "Moda Infantil": "👶",
    "Calçados e Tênis": "👟",
    "Bolsas e Acessórios": "👜",
    "Relógios e Joias": "⌚",
    "Beleza e Cuidados Pessoais": "💄",
    "Saúde e Bem-Estar": "💊",
    "Casa e Decoração": "🏠",
    "Cozinha e Utilidades": "🍳",
    "Eletrodomésticos": "🔌",
    "Ferramentas e Construção": "🔧",
    "Esportes e Fitness": "⚽",
    "Brinquedos e Jogos": "🧸",
    "Bebês e Maternidade": "🍼",
    "Livros e Papelaria": "📚",
    "Pet Shop": "🐾",
    "Automotivo": "🚗",
    "Jardim e Piscina": "🌿",
    "Alimentos e Bebidas": "🛒",
    "Instrumentos Musicais": "🎸",
    "Escritório e Material Escolar": "✏️",
  };
  return map[cat] || "📦";
}

export default CategoryMenu;
