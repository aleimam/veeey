import { MessageCircle } from "lucide-react"
import { useTranslations } from "next-intl"

export function WhatsAppButton({ phone = "201000000000" }: { phone?: string }) {
  const t = useTranslations("storefront.whatsapp")
  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noreferrer"
      aria-label={t("aria")}
      className="fixed bottom-5 end-5 z-50 flex size-14 items-center justify-center rounded-full bg-green-dark text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
