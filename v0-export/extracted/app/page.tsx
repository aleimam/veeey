import { AnnouncementBar } from "@/components/announcement-bar"
import { SiteHeader } from "@/components/site-header"
import { HeroSection } from "@/components/hero-section"
import { TrustStrip } from "@/components/trust-strip"
import { ShopByGoal } from "@/components/shop-by-goal"
import { Bestsellers } from "@/components/bestsellers"
import { ExpiryPricing } from "@/components/expiry-pricing"
import { SpecialOrder } from "@/components/special-order"
import { Membership } from "@/components/membership"
import { Testimonials } from "@/components/testimonials"
import { BlogTeaser } from "@/components/blog-teaser"
import { SiteFooter } from "@/components/site-footer"
import { WhatsAppButton } from "@/components/whatsapp-button"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <SiteHeader />
      <main>
        <HeroSection />
        <TrustStrip />
        <ShopByGoal />
        <Bestsellers />
        <ExpiryPricing />
        <SpecialOrder />
        <Membership />
        <Testimonials />
        <BlogTeaser />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </div>
  )
}
