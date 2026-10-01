/**
 * Why: Gives every storefront category switcher the same quiet selected state
 * and keyboard-visible focus treatment, instead of reimplementing tab styling
 * inside each navigation surface.
 * @param {Object} props - Category-tab configuration and interaction callbacks.
 * @param {Array<{key: string, label: string}>} props.tabs - Categories to show.
 * @param {string|null} props.activeTab - Key of the category currently expanded.
 * @param {(key: string) => void} props.onTabHover - Opens a category from pointer hover.
 * @param {(tab: Object) => void} props.onTabSelect - Opens or closes a category from a click.
 * @returns {JSX.Element} A horizontally scrollable category tab list.
 * @example
 * <CategoryTabs tabs={tabs} activeTab="Gear" onTabHover={openTab} onTabSelect={toggleTab} />
 */
export default function CategoryTabs({ tabs, activeTab, onTabHover, onTabSelect }) {
  return (
    <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto py-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            onMouseEnter={() => onTabHover(tab.key)}
            onClick={() => onTabSelect(tab)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--mx-primary)] focus-visible:ring-offset-2 ${
              isActive
                ? 'bg-white/80 text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
