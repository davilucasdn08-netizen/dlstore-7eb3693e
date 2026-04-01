import { MessageCircle, Phone } from "lucide-react";

const ContactSection = () => {
  const phoneNumber = "5531971638543";
  const displayNumber = "(31) 97163-8543";

  return (
    <section className="bg-card border-t border-border py-10">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Contato</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Dúvidas, sugestões ou precisa de ajuda? Fale conosco!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`https://wa.me/${phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={20} />
            WhatsApp
          </a>
          <a
            href={`tel:+${phoneNumber}`}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary border border-border text-foreground font-semibold hover:border-primary/40 transition-colors"
          >
            <Phone size={20} />
            {displayNumber}
          </a>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
