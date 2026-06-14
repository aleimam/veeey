export function AnnouncementBar() {
  return (
    <div className="bg-slate text-slate-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <p className="flex-1 text-pretty text-center sm:text-left">
          Free shipping nationwide · UltraFast delivery 3–6h in Greater Cairo
        </p>
        <div className="hidden items-center gap-2 sm:flex" aria-label="Language switch">
          <button className="font-medium text-slate-foreground transition-colors hover:text-lime">
            EN
          </button>
          <span className="text-slate-foreground/40">|</span>
          <button className="text-slate-foreground/70 transition-colors hover:text-lime" lang="ar">
            العربية
          </button>
        </div>
      </div>
    </div>
  )
}
