import { MessageCircle } from "lucide-react"
import { useTranslations } from "next-intl"

export function WhatsAppButton() {
  const t = useTranslations("storefront.whatsapp")
  return (
    <a
      href="https://wa.me/201000000000"
      target="_blank"
      rel="noreferrer"
      aria-label={t("aria")}
      className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
