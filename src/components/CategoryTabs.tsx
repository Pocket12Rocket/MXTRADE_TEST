/** One category tab. */
export interface CategoryTab<K extends string = string> {
  key: K;
  label: string;
}

/** Props of `CategoryTabs`. */
interface CategoryTabsProps<K extends string> {
  tabs: CategoryTab<K>[];
  activeTab: K | null;
  onTabHover: (key: K) => void;
  onTabSelect: (tab: CategoryTab<K>) => void;
}

/**
 * Why: Gives every storefront category switcher the same quiet selected state
 * and keyboard-visible focus treatment, instead of reimplementing tab styling
 * inside each navigation surface.
 * @param props - Category-tab configuration and interaction callbacks.
 * @param props.tabs - Categories to show.
 * @param props.activeTab - Key of the category currently expanded.
 * @param props.onTabHover - Opens a category from pointer hover.
 * @param props.onTabSelect - Opens or closes a category from a click.
 * @returns A horizontally scrollable category tab list.
 * @example
 * <CategoryTabs tabs={tabs} activeTab="Gear" onTabHover={openTab} onTabSelect={toggleTab} />
 */
export default function CategoryTabs<K extends string>({
  tabs,
  activeTab,
  onTabHover,
  onTabSelect,
}: CategoryTabsProps<K>) {
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
