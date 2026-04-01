import { ExternalLink, Star } from "lucide-react";

interface ProductCardProps {
  name: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  price?: string;
  rating?: string;
  onClickTrack: () => void;
}

const ProductCard = ({ name, imageUrl, affiliateLink, category, price, rating, onClickTrack }: ProductCardProps) => {
  const handleBuy = () => {
    onClickTrack();
    window.open(affiliateLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors group">
      <div className="aspect-square overflow-hidden bg-secondary">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground truncate" title={name}>{name}</h3>
        <span className="inline-block text-xs px-3 py-1 rounded-full bg-category-badge/20 text-category-badge-foreground">
          {category}
        </span>
        {rating && (
          <div className="flex items-center gap-1">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-foreground">{rating}</span>
          </div>
        )}
        {price && (
          <p className="text-lg font-bold text-primary">
            R$ {price}
          </p>
        )}
        <button
          onClick={handleBuy}
          className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm"
        >
          <ExternalLink size={16} /> Comprar
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
