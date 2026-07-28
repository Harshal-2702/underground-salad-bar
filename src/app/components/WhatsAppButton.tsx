import { MessageCircle } from "lucide-react";

const whatsappMessage = encodeURIComponent(
  "Hi Underground! I'd like to build my own bowl."
);

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/918208707976?text=${whatsappMessage}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#25D366] hover:bg-[#20BA5A] rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 group"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
    </a>
  );
}
