// Searchable, end-user documentation for Mana Ledger (Help -> Mana Ledger Guide).
// Keep the language practical: this is a handbook for collectors, not a technical reference.

import { showModal } from './modals.js';
import { esc } from './utils.js';

export const HELP_GROUPS = [
  'Start here',
  'Your collection',
  'Explore & plan',
  'Reports & decisions',
  'Settings & safety',
];

export const DASHBOARD_PANEL_NAMES = [
  'Total value', 'Cards value', 'Sealed value', 'Cost basis', 'Binders', 'Want list',
  'Realized gains', 'Last refresh', 'Value over time', 'Realized gains by year',
  'Secret Lair index', 'Card of the day', 'Top movers', 'Value by binder',
  'Top 10 cards', 'Value by color', 'Value by card type', 'Value by mana value',
  'Value by rarity', 'Collection stats', 'Card count by set', 'Value by set',
  'Card count by year',
];

export const HELP_GUIDES = [
  {
    id: 'welcome', group: 'Start here', icon: '⌂', title: 'Welcome to Mana Ledger',
    summary: 'A quick tour, the best first steps, and what Mana Ledger keeps track of.',
    keywords: 'start tour first launch basics local desktop overview',
    body: `
      <section class="help-section help-hero-card">
        <h3>A calm home for your Magic collection</h3>
        <p>Mana Ledger brings cards, sealed products, decks, precons, Secret Lairs, prices, want-list targets, and Wizards news into one desktop app. Your collection stays on this computer, and most views update automatically as you add items or refresh prices.</p>
      </section>
      <section class="help-section"><h3>A good first session</h3>
        <ol class="help-steps">
          <li><strong>Add your collection.</strong> Use <b>File → Import…</b> or press <b>Ctrl+I</b>. You can import cards, sealed products, or decks.</li>
          <li><strong>Refresh prices.</strong> Press <b>F5</b> or choose <b>Tools → Refresh Prices</b>. The first full refresh can take longer than later ones.</li>
          <li><strong>Arrange the Dashboard.</strong> Hide panels you do not need, drag your favorites into place, and add charts that answer your own questions.</li>
          <li><strong>Explore.</strong> Check deck readiness, browse precons and Secret Lairs, or add cards to your Want List.</li>
          <li><strong>Make a backup.</strong> Open <b>Settings → Data & Backups</b> and choose <b>Back up now</b> before any major cleanup.</li>
        </ol>
      </section>
      <section class="help-section"><h3>What counts—and what does not</h3>
        <p>Owned card and sealed entries count toward collection totals. Decks are planning lists, so their displayed value is not added again. Sold entries remain in your history for realized gains but no longer count as owned. Want List entries and missing deck cards never count as owned.</p>
        <div class="help-note"><strong>Tip:</strong> Hover over card art for a quick preview. Click for details. Right-click cards, deck entries, sealed products, and some Secret Lair items to find useful actions that do not need permanent buttons.</div>
      </section>`,
    related: ['navigation', 'importing', 'dashboard', 'backups'],
  },
  {
    id: 'navigation', group: 'Start here', icon: '⌘', title: 'Finding your way around',
    summary: 'Tabs, global search, the ticker, activity log, menus, and common controls.',
    keywords: 'navigation tabs sidebar ticker activity log hover right click shortcuts menu search',
    body: `
      <section class="help-section"><h3>Main workspaces</h3>
        <p>Use the left side of the app to move between Dashboard, Card Collection, Sealed Collection, Briefing, Secret Lair Explorer, Precon Explorer, Decks, Want List, Failed Lookups, and any optional workspaces you have enabled. Settings is at the bottom of the sidebar.</p>
      </section>
      <section class="help-section"><h3>The top bar</h3>
        <ul><li><strong>Global search</strong> finds a card anywhere it appears and can search live card catalogs.</li><li><strong>Refresh Prices</strong> updates card and sealed estimates, target-price checks, and the next portfolio snapshot.</li><li><strong>Ticker tape</strong> scrolls selected collection cards across the top. Change its speed and eligible binders or sets in Settings.</li><li><strong>Update badge</strong> appears when a new GitHub version is available. Steam editions are updated by Steam.</li></ul>
      </section>
      <section class="help-section"><h3>Common controls</h3>
        <ul><li><strong>Hover</strong> over a card for a quick image and price preview.</li><li><strong>Click</strong> a card to open its details and available printings.</li><li><strong>Right-click</strong> for actions such as moving a card, changing quantity, adding to a deck, selling, or working with a product.</li><li><strong>Activity Log</strong> at the bottom records imports, refreshes, and problems. Press <b>Ctrl+L</b> to open or close it.</li><li><strong>Escape</strong> closes most dialogs and floating panels.</li></ul>
      </section>`,
    related: ['search', 'keyboard', 'settings'],
  },
  {
    id: 'importing', group: 'Start here', icon: '↑', title: 'Importing cards, sealed, and decks',
    summary: 'Bring in an existing collection safely and understand the review screen.',
    keywords: 'import csv manabox cards sealed decks map columns review merge reconcile duplicate file ctrl i',
    body: `
      <section class="help-section"><h3>Open the Import chooser</h3>
        <p>Choose <b>File → Import…</b>, press <b>Ctrl+I</b>, or use the Import button inside Card Collection or Sealed Collection. Pick <b>Cards</b>, <b>Sealed</b>, or <b>Decks</b>.</p>
      </section>
      <section class="help-section"><h3>Cards and sealed products</h3>
        <ol class="help-steps"><li><strong>Choose a CSV file.</strong> ManaBox exports are recognized, and other spreadsheets can work too.</li><li><strong>Map the columns.</strong> Match each item on the left to the column in your file. Required fields are marked. Review any automatic choices before continuing.</li><li><strong>Review.</strong> Check the sample rows, warnings, skipped items, and duplicate handling.</li><li><strong>Import.</strong> Confirm only after the totals make sense.</li></ol>
        <p>Repeated ManaBox card imports can merge with what is already present or reconcile the rows managed by that export. Reconcile is useful when the CSV is your source of truth. It does not overwrite records you marked sold. Cards are matched by their printing identity and finish; sealed products use their product name, type, and set information.</p>
      </section>
      <section class="help-section"><h3>Decks</h3>
        <p>Paste a deck list or choose a deck file. Lists from Moxfield, Archidekt, ManaBox, MTG Arena, and ordinary quantity-and-name text are supported. After importing, open the deck to check unresolved cards, boards, format, and ownership.</p>
        <div class="help-note"><strong>Before a very large import:</strong> create a manual backup. If the review screen looks wrong, cancel and adjust the column mapping—nothing has been added yet.</div>
      </section>`,
    related: ['cards', 'sealed', 'decks', 'backups'],
  },
  {
    id: 'dashboard', group: 'Start here', icon: '▦', title: 'Dashboard and panels',
    summary: 'Arrange, resize, filter, hide, restore, and understand every built-in panel.',
    keywords: 'dashboard panels arrange customize drag resize collapse hide binder filter history range reset auto layout',
    body: `
      <section class="help-section"><h3>Shape the Dashboard around your questions</h3>
        <ul><li><strong>Customize</strong> opens the panel list. Check or uncheck panels to show or hide them.</li><li><strong>New chart</strong> creates a chart from your card collection. See the dedicated chart guide for a walkthrough.</li><li><strong>Arrange</strong> tidies all visible panels into an automatic layout.</li><li><strong>Reset</strong> restores the curated starting layout after confirmation.</li></ul>
      </section>
      <section class="help-section"><h3>Move and focus panels</h3>
        <p>Drag a panel by its header. Drag its right edge, bottom edge, or lower corner to resize it. Moving a panel switches the Dashboard to manual placement; <b>Arrange</b> returns it to automatic placement. The small header buttons show a description, filter by binder, collapse the panel, or hide it. Custom charts also have a delete button.</p>
        <p>The binder filter has three states: neutral includes the binder normally, include limits the panel to selected binders, and exclude removes selected binders. Click a binder repeatedly to cycle states.</p>
      </section>
      <section class="help-section"><h3>History range</h3>
        <p>The range near the top changes <b>Value over time</b>, <b>Secret Lair index</b>, <b>Realized gains</b>, and <b>Top movers</b>. Other panels show current collection data and are not changed by that range.</p>
      </section>
      <section class="help-section"><h3>Built-in panels</h3>
        <div class="help-panel-list"><div><strong>At a glance</strong><span>Total value · Cards value · Sealed value · Cost basis · Binders · Want list · Realized gains · Last refresh</span></div><div><strong>History and decisions</strong><span>Value over time · Realized gains by year · Secret Lair index · Card of the day · Top movers</span></div><div><strong>Breakdowns</strong><span>Value by binder · Top 10 cards · Value by color · Value by card type · Value by mana value · Value by rarity</span></div><div><strong>Collection shape</strong><span>Collection stats · Card count by set · Value by set · Card count by year</span></div></div>
        <div class="help-note"><strong>Values in plain English:</strong> Total Value combines card low prices with sealed market estimates. Cost Basis is what your entries say you paid. Gain/Loss is current value minus that cost. Prices are estimates, not guaranteed sale proceeds.</div>
      </section>`,
    related: ['charts', 'pricing', 'selling'],
  },
  {
    id: 'charts', group: 'Start here', icon: '▥', title: 'Creating Dashboard charts',
    summary: 'Build a useful chart from scratch, with examples for each choice.',
    keywords: 'new chart dashboard custom chart bar horizontal pie donut group by x axis value y axis copies unique cost gain language condition cmc',
    body: `
      <section class="help-section"><h3>Create a chart in six steps</h3>
        <ol class="help-steps"><li>Open <b>Dashboard</b> and select <b>New chart</b>.</li><li>Give it a title, or leave the title blank and Mana Ledger will make one.</li><li>Choose a shape: <b>Bar</b>, <b>Horizontal bar</b>, <b>Pie</b>, or <b>Donut</b>.</li><li>Choose <b>Group by</b>. This decides the labels or slices: Binder, Color, Rarity, Set, Card Type, Mana Cost, Condition, or Language.</li><li>Choose <b>Value</b>. This decides what is measured: Market Value, Copies, Unique Cards, Cost Basis, Average Price per Copy, or Gain/Loss.</li><li>Choose how many leading groups to show, from 5 to 50, then add the chart.</li></ol>
      </section>
      <section class="help-section"><h3>Think “group” and “measure”</h3>
        <p><b>Group by</b> answers “split my cards by what?” <b>Value</b> answers “compare those groups using what number?” For example, <b>Set + Copies</b> shows which sets make up most of your physical card count. <b>Binder + Gain/Loss</b> compares the paper gains or losses in each binder.</p>
        <div class="help-example-grid"><div><strong>Collection value by binder</strong><span>Bar · Binder · Market Value</span></div><div><strong>Most collected sets</strong><span>Horizontal bar · Set · Copies</span></div><div><strong>Rarity mix</strong><span>Donut · Rarity · Unique Cards</span></div><div><strong>Cost by language</strong><span>Pie · Language · Cost Basis</span></div><div><strong>Average card price by type</strong><span>Bar · Card Type · Avg Price per Copy</span></div><div><strong>Paper result by binder</strong><span>Bar · Binder · Gain/Loss</span></div></div>
      </section>
      <section class="help-section"><h3>Choose a readable shape</h3>
        <ul><li><strong>Horizontal bars</strong> are best for long set, binder, or type names.</li><li><strong>Vertical bars</strong> are easy to compare when labels are short.</li><li><strong>Pie and donut</strong> work best with a small number of categories. Use Top 5 or Top 10 if the chart feels crowded.</li></ul>
        <p>New charts use owned cards, not sealed products or deck lists. After adding one, you can resize it, move it, filter it by binder, collapse it, or delete it from its header. Dashboard layout and custom charts are saved automatically.</p>
      </section>`,
    related: ['dashboard', 'cards', 'pricing'],
  },
  {
    id: 'keyboard', group: 'Start here', icon: '⌨', title: 'Keyboard shortcuts',
    summary: 'Move quickly between workspaces and common actions.',
    keywords: 'keyboard shortcut ctrl command f5 escape fullscreen import search log settings save load',
    body: `
      <section class="help-section"><h3>Move between workspaces</h3><div class="help-shortcuts"><span><kbd>Ctrl+1</kbd> Dashboard</span><span><kbd>Ctrl+2</kbd> Card Collection</span><span><kbd>Ctrl+3</kbd> Sealed Collection</span><span><kbd>Ctrl+5</kbd> Secret Lair Explorer</span><span><kbd>Ctrl+6</kbd> Failed Lookups</span><span><kbd>Ctrl+7</kbd> Decks</span><span><kbd>Ctrl+8</kbd> Want List</span><span><kbd>Ctrl+9</kbd> Precon Explorer</span></div></section>
      <section class="help-section"><h3>Common actions</h3><div class="help-shortcuts"><span><kbd>Ctrl+K</kbd> Global search</span><span><kbd>Ctrl+I</kbd> Import chooser</span><span><kbd>Ctrl+D</kbd> Import deck</span><span><kbd>F5</kbd> Refresh prices</span><span><kbd>Ctrl+L</kbd> Activity Log</span><span><kbd>Ctrl+,</kbd> Settings</span><span><kbd>Ctrl+S</kbd> Save collection JSON</span><span><kbd>Ctrl+O</kbd> Load collection JSON</span><span><kbd>Esc</kbd> Close dialog or panel</span><span><kbd>F11</kbd> Fullscreen</span></div><p>On a Mac keyboard, use Command where the menu shows Ctrl/Command.</p></section>`,
    related: ['navigation', 'importing', 'search'],
  },
  {
    id: 'cards', group: 'Your collection', icon: '▤', title: 'Card Collection',
    summary: 'Browse, filter, edit, organize, add, sell, and understand card prices.',
    keywords: 'cards collection table gallery binder filters color rarity condition language foil columns sort quantity right click edit scryfall id',
    body: `
      <section class="help-section"><h3>Find the cards you need</h3>
        <p>Switch between <b>Table</b> and <b>Gallery</b>. Search by name, set, type, or card text. Use color identity pips, binders, ownership status, finish, rarity, condition, and language to narrow the view. Click column headings or sort controls to order results. The Columns button lets you simplify the table without deleting information.</p>
      </section>
      <section class="help-section"><h3>Organize and maintain entries</h3>
        <p>Right-click an owned card to move it to another binder, create a binder, change quantity, add it to a deck, sell or dispose of copies, or remove a mistaken entry. Deleting is for mistakes; selling keeps the record and gain/loss history. Click the pencil in the table only when a card is linked to the wrong Scryfall printing.</p>
        <p>Click a gallery card or card name for details. From card details and live search results, <b>Add owned card</b> records the exact printing, finish, quantity, condition, cost, acquired date, currency, language, and binder.</p>
      </section>
      <section class="help-section"><h3>Read the price columns</h3>
        <ul><li><strong>Low (SCR)</strong> is the lowest active listing reported through Scryfall and can include an outlier.</li><li><strong>Mkt (TCG)</strong> reflects recent TCGplayer sales and is often a steadier market reference.</li><li><strong>Cost</strong> is the amount stored on your entry. An imported app may have supplied a market value from the day it was added rather than your literal receipt price.</li><li><strong>Δ Price</strong> compares the two latest refreshes. <strong>Trend</strong> shows the stored price history.</li></ul>
      </section>`,
    related: ['importing', 'selling', 'search', 'exporting'],
  },
  {
    id: 'sealed', group: 'Your collection', icon: '▰', title: 'Sealed Collection',
    summary: 'Add exact products, record opening or sale, and keep product prices current.',
    keywords: 'sealed product collection add catalog browse set price sync opened open into collection sell undo sale edit linked cards tcgcsv',
    body: `
      <section class="help-section"><h3>Add a product</h3>
        <p>Select <b>Add Product</b> to search the product catalog or browse by set. Choosing the closest exact product gives better price matching than a hand-typed general name. Record quantity, purchase price, purchase date, status, and any available product details. You can also import sealed rows from CSV.</p>
      </section>
      <section class="help-section"><h3>Keep the record useful</h3>
        <ul><li><strong>Sync Price Data</strong> refreshes the built-in sealed catalog and market estimates.</li><li><strong>Edit</strong> corrects ownership details.</li><li><strong>Update Price</strong> records or replaces a product estimate when needed.</li><li><strong>Mark Opened</strong> changes status without creating card entries.</li><li><strong>Open into Collection</strong> is available when the exact contained cards are known. It creates those card entries and keeps a link back to the sealed product.</li><li><strong>Cards</strong> shows the linked or generated contents. <strong>Undo opening</strong> reverses an app-created opening when possible.</li><li><strong>Sell</strong> records proceeds, costs, and date. <strong>Undo sale</strong> returns the item to owned status.</li></ul>
        <div class="help-note"><strong>Good habit:</strong> use Sell instead of Delete for a real sale. Delete removes a mistaken record; a sale contributes to realized-gain history.</div>
      </section>`,
    related: ['importing', 'selling', 'pricing', 'secret-lair'],
  },
  {
    id: 'selling', group: 'Your collection', icon: '$', title: 'Sales and realized gains',
    summary: 'Record sales correctly, including partial card sales, fees, and history.',
    keywords: 'sell dispose sale proceeds fees shipping realized gains partial quantity undo sold cost basis profit loss',
    body: `
      <section class="help-section"><h3>Record a card sale</h3>
        <p>Right-click an owned card and choose <b>Sell / dispose</b>. Enter copies sold, total proceeds, fees or shipping, date, and an optional note. If you sell only part of an entry, Mana Ledger keeps the remaining copies owned and creates a separate sold record for the sold copies.</p>
      </section>
      <section class="help-section"><h3>Record a sealed sale</h3>
        <p>Use <b>Sell</b> on the sealed row. Enter the real sale details rather than deleting the product. You can undo a sealed sale if it was recorded by mistake.</p>
      </section>
      <section class="help-section"><h3>How the result is calculated</h3>
        <p><b>Realized gain or loss = proceeds − fees/shipping − stored cost basis.</b> The result appears on the Dashboard and in sold views. Current market changes do not alter an already recorded result. If cost basis was missing or imported as a reference value, the result will only be as accurate as that stored cost.</p>
      </section>`,
    related: ['cards', 'sealed', 'dashboard', 'pricing'],
  },
  {
    id: 'exporting', group: 'Your collection', icon: '↓', title: 'Exporting and portable copies',
    summary: 'Create card or sealed lists for spreadsheets, sharing, or safekeeping.',
    keywords: 'export csv json markdown text preset columns portable save collection load collection',
    body: `
      <section class="help-section"><h3>Export a useful list</h3>
        <p>Open Card Collection or Sealed Collection and select <b>Export</b>. Choose a ready-made preset or Custom, select a format, and choose the columns you want. CSV is best for spreadsheets, JSON keeps structured details, Markdown is easy to paste into notes, and text is useful for simple lists.</p>
      </section>
      <section class="help-section"><h3>Full collection JSON</h3>
        <p><b>File → Save Collection</b> or <b>Ctrl+S</b> creates a portable collection file. <b>File → Load Collection</b> or <b>Ctrl+O</b> loads that legacy-style file. A database backup is the better choice for full recovery because it preserves all app-managed information in one restorable copy.</p>
        <div class="help-note"><strong>Privacy:</strong> exports are files you control. Mana Ledger does not upload them automatically.</div>
      </section>`,
    related: ['cards', 'sealed', 'backups'],
  },
  {
    id: 'search', group: 'Explore & plan', icon: '⌕', title: 'Global search and printings',
    summary: 'Find where a card appears, compare printings, and add the exact copy.',
    keywords: 'global search ctrl k scryfall tcgcsv printings tabs collection decks secret lair precon sealed add owned',
    body: `
      <section class="help-section"><h3>Search from anywhere</h3>
        <p>Click the search box in the top bar or press <b>Ctrl+K</b>. Results can show where the card already appears in your binders, decks, Secret Lairs, precons, and sealed products. Live catalog sections help when the card is not already in your data.</p>
      </section>
      <section class="help-section"><h3>Use result tabs</h3>
        <p>Opening full results creates a search tab so you can keep several searches available. Close a tab with its ×. Collection results reflect your entries; Scryfall and TCGCSV results come from their current catalogs.</p>
      </section>
      <section class="help-section"><h3>Choose the right printing</h3>
        <p>Select <b>printings</b> beside a result to compare versions. Use <b>add</b> on the exact printing you own, then choose its finish and collection details. This improves pricing, Secret Lair completion, precon matching, and card art throughout the app.</p>
      </section>`,
    related: ['cards', 'decks', 'want-list'],
  },
  {
    id: 'decks', group: 'Explore & plan', icon: '♜', title: 'Decks and ownership checks',
    summary: 'Create, import, edit, validate, price, and complete deck lists.',
    keywords: 'decks new import moxfield archidekt manabox arena format legality commander main side maybe owned missing buy want copy export value',
    body: `
      <section class="help-section"><h3>Create or import</h3>
        <p>Select <b>New Deck</b> to name a deck and choose its format, or <b>Import Deck</b> to paste or load a list. Open a deck and click its title to rename it. Change the format beside the title when you want construction checks for Commander, Standard, Modern, and other supported formats; Casual does not enforce rules.</p>
      </section>
      <section class="help-section"><h3>Add and arrange cards</h3>
        <p><b>Add Cards</b> searches your collection first and can continue to Scryfall. Place cards on the Commander, Main, Sideboard, or Maybeboard. You can also right-click cards elsewhere in Mana Ledger and add them to a deck. Use List or Gallery view and filter to All, Owned, or Missing.</p>
      </section>
      <section class="help-section"><h3>Finish the deck</h3>
        <p>The stats strip shows total cards, how many you own, full deck value, value already owned, and estimated cost to complete. For missing cards you can open TCGplayer Mass Entry, add them to the Want List, or copy a text list. Ownership uses required quantities; owning one copy does not satisfy a four-copy slot.</p>
        <p><b>Export</b> creates formats suited to Moxfield, Archidekt, and ManaBox. The deck value is informational: owned copies are already counted in binders, and missing cards never enter collection totals.</p>
      </section>`,
    related: ['importing', 'search', 'want-list', 'insights'],
  },
  {
    id: 'precons', group: 'Explore & plan', icon: '♛', title: 'Precon Explorer',
    summary: 'Browse official decks, compare ownership, and decide whether a precon is worth it.',
    keywords: 'precon explorer commander deck line gallery table ownership completion exact printing finish worth it msrp singles sealed jumpstart missing',
    body: `
      <section class="help-section"><h3>Browse from product line to deck</h3>
        <p>Start with a product line, then choose a deck. Search by deck, commander, or set code and sort by date, name, or completion. Jumpstart contains hundreds of half-decks, so its toggle is off on the landing page until you need it.</p>
      </section>
      <section class="help-section"><h3>Read completion</h3>
        <p>Open a deck in Gallery or Table view to see exact cards, boards, and finish-aware ownership. The completion bar compares the deck list to owned copies. Select <b>Want missing</b> to add unresolved needs to your Want List.</p>
      </section>
      <section class="help-section"><h3>Use the “Worth it?” comparison</h3>
        <p>The banner compares estimated MSRP, the current value of the included singles, and an available sealed-market estimate. Use <b>Price the singles</b> when a deck has not been calculated yet. This is a starting point, not a buying instruction: condition, shipping, availability, and reprint risk still matter.</p>
        <p><b>Check for New Precons</b> looks for official deck records released after the built-in catalog was prepared and adds only the new deck lists.</p>
      </section>`,
    related: ['decks', 'want-list', 'pricing', 'insights'],
  },
  {
    id: 'secret-lair', group: 'Explore & plan', icon: '◇', title: 'Secret Lair Explorer',
    summary: 'Browse drops and exact contents, track ownership, and use the product tools.',
    keywords: 'secret lair explorer superdrop drop products sku foil nonfoil gallery table pnl index intelligence product truth exact completion bonus watch grouping note refresh',
    body: `
      <section class="help-section"><h3>Browse the catalog</h3>
        <p>The Explorer moves from superdrops to individual drops and exact purchasable versions. Foil, nonfoil, etched, rainbow foil, and special products remain separate when the source catalog treats them separately. Search and sorting work at each level; breadcrumbs take you back.</p>
      </section>
      <section class="help-section"><h3>Views with different jobs</h3>
        <ul><li><strong>Explorer / Gallery / Table</strong> browse products and cards.</li><li><strong>P&amp;L</strong> compares recorded or fallback cost with current card value.</li><li><strong>Index</strong> ranks Secret Lair holdings and performance.</li><li><strong>Intelligence</strong> holds decision tools, purchase lots, watches, bonus observations, and market comparisons.</li><li><strong>Upcoming</strong> and <strong>Announcements</strong> appear when relevant source data and feature settings are available.</li></ul>
      </section>
      <section class="help-section"><h3>Open a drop</h3>
        <p>Cards show exact printing and finish ownership. <b>Product Truth</b> explains the guaranteed contents, identifiers, source confidence, prices, and available history. <b>Exact Completion</b> checks required quantities and finishes; a normal copy does not complete a foil requirement. <b>Log bonus</b> records what you actually opened without pretending the bonus was guaranteed. <b>Watch</b> saves a local target. You can also add missing cards to the Want List.</p>
      </section>
      <section class="help-section"><h3>Refresh and personal corrections</h3>
        <p><b>Check for New Cards</b> refreshes exact products and contents, superdrop grouping and MSRP, the bonus-card catalog, and official launch articles. If one source has a bad day, Mana Ledger keeps its last good copy. Use <b>✎ Edit</b> to make a personal grouping fix or note; your correction stays local.</p>
      </section>`,
    related: ['secret-lair-decisions', 'upcoming', 'want-list', 'pricing'],
  },
  {
    id: 'secret-lair-decisions', group: 'Explore & plan', icon: '↗', title: 'Secret Lair cost, value, and Intelligence',
    summary: 'Use P&L, the Index, crack-or-keep, bundle costs, watches, and market comparisons responsibly.',
    keywords: 'secret lair pnl intelligence index crack keep sealed singles bundle purchase lot allocate msrp cost basis fees shipping cardtrader pricecharting watch bonus market quote',
    body: `
      <section class="help-section"><h3>Give Mana Ledger a real cost when you can</h3>
        <p>Link a Secret Lair to an owned sealed product or record a purchase lot for a bundle. A lot can spread subtotal, tax, shipping, and fees across exact products by their relative MSRP or equally. This is more useful than treating every item as though it cost the advertised drop price.</p>
        <p>If no linked cost exists, Mana Ledger uses the drop’s known MSRP. If that is unavailable, it uses the foil or nonfoil fallback saved in <b>Settings → Secret Lair</b>. An ≈ symbol tells you the cost is assumed.</p>
      </section>
      <section class="help-section"><h3>Use the decision views</h3>
        <ul><li><strong>Index</strong> can filter by year, superdrop, finish, subtype, holding state, and confidence; sort it by return, gain, value, cost, or name and export the full report to CSV.</li><li><strong>Crack-or-keep</strong> compares a sealed estimate with expected net singles proceeds after your fee and shipping assumptions.</li><li><strong>Watches</strong> keep local targets for products you want to revisit.</li><li><strong>Observed bonuses</strong> are your journal of actual pulls. Unknown odds and random bonuses are never added to guaranteed value.</li><li><strong>CardTrader</strong> and <strong>PriceCharting</strong> can add labeled comparisons after you enter optional tokens in Settings. They do not silently replace the main estimate.</li></ul>
      </section>
      <section class="help-section"><h3>Know the confidence limits</h3>
        <p>Strong comparisons require an exact sealed product match and priced exact card printings in the required finishes. Low-confidence catalog fallbacks are labeled. A positive spread is a reason to review the evidence, not a promise of profit—selling time, fees, condition, demand, and missing prices can change the outcome.</p>
      </section>`,
    related: ['secret-lair', 'settings', 'pricing', 'insights'],
  },
  {
    id: 'upcoming', group: 'Explore & plan', icon: '◌', title: 'Upcoming Secret Lairs (experimental)',
    summary: 'Turn on previews, read exact versus reference cards, and understand special set codes.',
    keywords: 'upcoming secret lair experimental previews announced future scryfall storefront special set code slz zeta reference printing exact preview official announcement',
    body: `
      <section class="help-section"><h3>Turn it on</h3>
        <p>Open <b>Settings → Features</b>, enable <b>Upcoming Secret Lairs</b>, and save. Mana Ledger then checks recent official Wizards announcements, future Scryfall card records, and official Secret Lair storefront titles. The Upcoming view appears inside Secret Lair Explorer.</p>
      </section>
      <section class="help-section"><h3>Read the labels carefully</h3>
        <ul><li><strong>Exact preview</strong> means an upcoming printing has its own future card identity, collector number, finish information, and art.</li><li><strong>Reference printing</strong> means a card name was announced but the future printing is not available yet; an older printing is shown only as a visual reference.</li><li><strong>Official storefront set</strong> covers special Secret Lair releases whose set code is not SLD. Mana Ledger includes one only when its Scryfall set name can be matched conservatively to an official storefront product.</li></ul>
        <div class="help-note"><strong>Important:</strong> a gallery for a storefront-linked set—such as a special release using its own set code—shows announced cards in that set. It does not claim that every sealed pack contains every card.</div>
      </section>
      <section class="help-section"><h3>When something is missing</h3>
        <p>Use <b>Check for New Cards</b> after Wizards or Scryfall publishes new details. Names and pages can change before release, so experimental previews may be incomplete for a while. Turning the feature off hides the view but does not delete its saved cache.</p>
      </section>`,
    related: ['secret-lair', 'settings', 'pricing'],
  },
  {
    id: 'briefing', group: 'Explore & plan', icon: '☷', title: 'Briefing',
    summary: 'Read, filter, save, and search official Wizards articles with collection-aware card galleries.',
    keywords: 'briefing wizards news articles sync import unread new updated saved author set date cards rulings sections parsing details correct match',
    body: `
      <section class="help-section"><h3>Build your news feed</h3>
        <p>Select <b>Sync Wizards</b> to collect supported official articles. <b>Import article</b> lets you add a particular Wizards page. The local archive remembers read status, saves articles, and detects supported changes on later syncs.</p>
      </section>
      <section class="help-section"><h3>Find the right article</h3>
        <p>Filter by article kind, unread/new/updated/saved status, author, set code, whether cards were found, date, and sort order. The main search finds articles; the search inside an open article finds text, sections, cards, and rulings. <b>Jump to newest</b> and <b>Mark all read</b> help manage a busy feed.</p>
      </section>
      <section class="help-section"><h3>Use the reader</h3>
        <ul><li><strong>Overview</strong> summarizes the article and its outline.</li><li><strong>Cards</strong> shows owned, missing, wanted, and unmatched cards. Add all missing cards to the Want List if useful.</li><li><strong>Sections</strong> presents the article in collapsible parts.</li><li><strong>Card rulings</strong> collects card-specific release notes.</li><li><strong>Parsing details</strong> explains what Mana Ledger could read and lets you retry matching or re-read the official source.</li></ul>
        <p>Click card art for a larger viewer, zoom the source image, open card details, or correct a mistaken card match. A manual correction can be removed later to restore automatic matching.</p>
      </section>`,
    related: ['want-list', 'search', 'failures'],
  },
  {
    id: 'want-list', group: 'Explore & plan', icon: '★', title: 'Want List and target prices',
    summary: 'Track cards you need, group Secret Lair wants, and watch for target-price hits.',
    keywords: 'want list target price alert add card missing group by drop gallery table current price at target remove',
    body: `
      <section class="help-section"><h3>Add cards from anywhere</h3>
        <p>Use <b>Add card</b> in Want List, or add missing cards from Decks, Precon Explorer, Secret Lair Explorer, Briefing, and Insights. When you add an exact wanted printing to Card Collection, Mana Ledger can remove the matching want automatically.</p>
      </section>
      <section class="help-section"><h3>Set a target</h3>
        <p>Enter the highest price you are comfortable paying. After a price refresh, items at or below that target are highlighted and counted in the Want List summary. A blank target means “watch this card” without a price alert.</p>
      </section>
      <section class="help-section"><h3>Choose a view</h3>
        <p>Use Table for prices and editing or Gallery for visual browsing. Search within the list, and turn on <b>Group by drop</b> to collect Secret Lair wants under their source drop. Remove an item with × when you no longer need it.</p>
      </section>`,
    related: ['search', 'pricing', 'decks', 'secret-lair'],
  },
  {
    id: 'insights', group: 'Reports & decisions', icon: '✦', title: 'Insights workspace',
    summary: 'See build readiness, review explainable opportunities, and save custom reports.',
    keywords: 'insights optional build readiness opportunities scanner reports custom dataset filters columns csv playable exact precon saved decks',
    body: `
      <section class="help-section"><h3>Enable Insights</h3>
        <p>Open <b>Settings → Features</b>, turn on <b>Insights workspace</b>, and save. The workspace appears in the sidebar. Turning it off later hides it but keeps saved reports.</p>
      </section>
      <section class="help-section"><h3>What can I build?</h3>
        <p>Compare owned quantities with saved decks and official precons. Saved decks accept any printing with the same card name. Precons can use <b>playable</b> matching for any printing or <b>exact product</b> matching for the original printing and finish. Filter by source and missing count, sort by completion or completion cost, and add missing cards to the Want List.</p>
      </section>
      <section class="help-section"><h3>Opportunity scanner</h3>
        <p>Review collection facts that may deserve attention, such as target-price hits, buildable lists, value movement, or exact Secret Lair spreads. Each item shows why it appeared and links back to its source. These are review prompts, not automatic buying or selling advice.</p>
      </section>
      <section class="help-section"><h3>User-defined reports</h3>
        <p>Start with a template—90%+ buildable decks, high-value cards, target hits, or Secret Lair spreads—or choose <b>New</b>. Pick Cards, Sealed, Decks, Precons, Want List, or Opportunities; then add text, status, value, gain, completion, and missing-count filters. Choose the columns and sort, save the recipe, and export the current rows to CSV. Saved reports always rerun on the latest local data.</p>
      </section>`,
    related: ['local-intelligence', 'decks', 'precons', 'settings'],
  },
  {
    id: 'local-intelligence', group: 'Reports & decisions', icon: 'AI', title: 'Local Intelligence (experimental)',
    summary: 'Understand the offline assistant, what it can flag, and what it will never do.',
    keywords: 'local intelligence experimental offline ai data guardian entity matching natural language report attention ranking privacy model no api',
    body: `
      <section class="help-section"><h3>Enable it</h3>
        <p>Local Intelligence lives inside Insights. In <b>Settings → Features</b>, turn on Local Intelligence; Insights will turn on too. It needs no account or API key, and collection data stays on this computer.</p>
      </section>
      <section class="help-section"><h3>Four tools, four limits</h3>
        <ul><li><strong>Ask your collection</strong> turns requests such as “show foil cards under $40 with gains” into a visible report recipe. It understands a bounded set of collection questions; it is not a general chat bot.</li><li><strong>Data Guardian</strong> points out records and unusual price-history changes worth checking. It never edits them.</li><li><strong>Attention ranking</strong> reorders existing opportunity signals using size, intent, evidence, and match quality. It does not predict guaranteed future prices.</li><li><strong>Identity suggestions</strong> compares owned sealed names with exact Secret Lair products. Suggestions above its threshold still require your review and are never linked automatically.</li></ul>
      </section>
      <section class="help-section"><h3>Best way to use it</h3>
        <p>Treat every result as a shortcut to evidence. Open the underlying card, product, price history, or report before making a decision. More complete costs, exact printing IDs, price history, target prices, and saved decks give the tools more useful material.</p>
        <div class="help-note"><strong>Privacy boundary:</strong> the embedded tools cannot browse the web, upload your collection, train on it, or change source records.</div>
      </section>`,
    related: ['insights', 'pricing', 'failures', 'settings'],
  },
  {
    id: 'pricing', group: 'Reports & decisions', icon: '↻', title: 'Prices, refreshes, and value history',
    summary: 'Know where estimates come from, when to refresh, and why some values are blank.',
    keywords: 'prices refresh f5 scryfall bulk api tcgcsv tcgplayer market low sealed history portfolio snapshot pricecharting cardtrader missing',
    body: `
      <section class="help-section"><h3>Refresh the whole picture</h3>
        <p>Press <b>F5</b> or choose <b>Refresh Prices</b>. Card estimates come from exact Scryfall printings and finishes; sealed estimates primarily use exact TCGCSV/TCGplayer products. The same refresh rechecks Want List targets and records the next daily collection-value snapshot.</p>
      </section>
      <section class="help-section"><h3>Choose the card-price method</h3>
        <p><b>Use Scryfall bulk data</b> is on by default. It downloads a large price catalog—about 500 MB—roughly once per day, then makes a large collection refresh faster and less likely to hit request limits. Turn it off in <b>Settings → Pricing</b> for a slower, lower-bandwidth method that asks for cards in smaller groups.</p>
      </section>
      <section class="help-section"><h3>Optional sealed comparisons</h3>
        <p>TCGCSV is built in and requires no key. A paid PriceCharting token can add another current product estimate. A CardTrader profile token can add exact marketplace listings when the product has a matching blueprint. Tokens are optional; without them the rest of Mana Ledger continues to work.</p>
      </section>
      <section class="help-section"><h3>Why a value can be missing</h3>
        <p>The exact printing may have no current USD price, the finish may not be listed, the ID may be stale, a sealed product may not have an exact catalog match, or a source refresh may have failed. Check Failed Lookups and the Activity Log. Never assume that a fallback or missing price means the item has no value.</p>
      </section>`,
    related: ['failures', 'cards', 'sealed', 'settings'],
  },
  {
    id: 'failures', group: 'Reports & decisions', icon: '⚠', title: 'Failed Lookups and Activity Log',
    summary: 'Understand missing prices and retry the problems that may be temporary.',
    keywords: 'failed lookup issues no price missing id scryfall id not found batch error rate limit retry activity log errors',
    body: `
      <section class="help-section"><h3>Read the issue groups</h3>
        <ul><li><strong>Rate limit / batch error</strong> is usually temporary. Wait briefly and use Retry.</li><li><strong>ID not found</strong> means the stored card identity is stale or wrong. Open the source link, find the correct printing, then edit the Scryfall ID on the card row.</li><li><strong>No price</strong> means the exact printing or finish has no current USD value from Scryfall.</li><li><strong>No Scryfall ID</strong> means the imported row could not be tied to an exact card yet.</li></ul>
        <p>Filter the page by issue type. The Retry button appears for temporary batch problems; it does not guess new IDs or invent missing prices.</p>
      </section>
      <section class="help-section"><h3>Use the Activity Log</h3>
        <p>Open the log from the bottom status bar or press <b>Ctrl+L</b>. It records recent refresh, import, save, and source messages. The log is especially useful when an action finishes with a partial result. Clearing the visible log does not delete collection entries.</p>
      </section>`,
    related: ['pricing', 'cards', 'navigation'],
  },
  {
    id: 'settings', group: 'Settings & safety', icon: '⚙', title: 'Settings guide',
    summary: 'A plain-language tour of every Settings section and the choices that are easy to miss.',
    keywords: 'settings general ticker features optional pricing tokens secret lair msrp data backups updates support save cancel',
    body: `
      <section class="help-section"><h3>General</h3>
        <p>Change ticker speed and choose which binders or sets may appear. If no binder or set chip is selected, the whole collection is eligible. These filters affect only the ticker, not collection totals.</p>
      </section>
      <section class="help-section"><h3>Features</h3>
        <p><b>Insights</b> adds build readiness, opportunity review, and saved reports. <b>Local Intelligence</b> is an experimental offline section inside Insights. <b>Upcoming Secret Lairs</b> is an experimental preview view inside Secret Lair Explorer. Optional features are off by default. Turning one off hides it without deleting its reports, collection records, or saved preview cache.</p>
      </section>
      <section class="help-section"><h3>Pricing</h3>
        <p>Choose the large, faster Scryfall bulk catalog or the slower lower-bandwidth method. TCGCSV sealed pricing works without a key. PriceCharting and CardTrader fields are optional connections for people who already have those tokens.</p>
      </section>
      <section class="help-section"><h3>Secret Lair</h3>
        <p>Open the detailed source guide or change fallback nonfoil and foil MSRP. Those amounts are used only when a drop has neither a linked owned sealed cost nor a known drop-specific MSRP. They do not rewrite your collection purchases.</p>
      </section>
      <section class="help-section"><h3>Data & Backups</h3>
        <p>Create and restore backups, open their folder, or clear only cards, sealed products, or price history. Reset Entire Database wipes all app data after two warnings. Read the recovery guide before using cleanup controls.</p>
      </section>
      <section class="help-section"><h3>Updates & Support</h3>
        <p>GitHub editions can check release notes, download an update, and restart to install. Steam editions are managed by Steam. This section also contains Ko-fi support and the feedback form. Most settings take effect only after you select <b>Save Settings</b>; Cancel leaves them unchanged.</p>
      </section>`,
    related: ['insights', 'local-intelligence', 'upcoming', 'backups'],
  },
  {
    id: 'backups', group: 'Settings & safety', icon: '▰', title: 'Backups, recovery, and cleanup',
    summary: 'Protect your collection, restore an earlier day, and avoid accidental data loss.',
    keywords: 'backup recovery restore daily latest 10 pre restore folder cleanup clear cards sealed history reset database danger',
    body: `
      <section class="help-section"><h3>Automatic and manual backups</h3>
        <p>Mana Ledger writes a verified backup automatically each day and keeps the latest 10. In <b>Settings → Data & Backups</b>, select <b>Back up now</b> before a large import, cleanup, or other major change. <b>Open backups folder</b> shows the files so you can make an extra copy elsewhere.</p>
      </section>
      <section class="help-section"><h3>Restore an earlier copy</h3>
        <ol class="help-steps"><li>Open Data & Backups.</li><li>Find the date you want and choose <b>Restore</b>.</li><li>Read the confirmation carefully and continue.</li><li>The app sets the current database aside in a pre-restore folder, loads the selected backup, and restarts.</li></ol>
        <p>A restore replaces the app’s current state with that earlier state. Export anything added after the backup if you may need it.</p>
      </section>
      <section class="help-section"><h3>Cleanup choices</h3>
        <ul><li><strong>Clear All Cards</strong> removes card collection records only.</li><li><strong>Clear All Sealed</strong> removes sealed collection records only.</li><li><strong>Clear Price History</strong> removes stored price movement and portfolio history; current collection entries remain.</li><li><strong>Reset Entire Database</strong> removes cards, sealed, prices, metadata, settings, optional features, saved reports, and cached Secret Lair data.</li></ul>
        <div class="help-warning"><strong>These cleanup actions are permanent.</strong> Create a backup first. Use Delete on an individual item only to correct a mistake; use Sell for a real sale so history is preserved.</div>
      </section>`,
    related: ['importing', 'exporting', 'settings'],
  },
  {
    id: 'updates-privacy', group: 'Settings & safety', icon: '♥', title: 'Updates, privacy, and support',
    summary: 'Keep the app current and understand what stays on your computer.',
    keywords: 'updates github steam download restart install release notes privacy local first telemetry cloud feedback support kofi database folder',
    body: `
      <section class="help-section"><h3>Install updates</h3>
        <p>In a GitHub edition, open <b>Settings → Updates & Support</b> or <b>Help → Check for Updates</b>. Review What’s New, download the update, then choose Restart & Install when ready. Save any work before restarting. A Steam edition receives updates through Steam instead.</p>
      </section>
      <section class="help-section"><h3>Your collection stays local</h3>
        <p>Mana Ledger does not require a collection account, cloud sync, or telemetry. Collection records, saved reports, watches, corrections, news state, and Local Intelligence work stay on this computer. The app connects to card, product, news, and update sources when you ask it to refresh or when a supported scheduled check runs.</p>
        <p>Optional marketplace tokens are stored with your local settings and sent only to the service they belong to. Exports and backups remain files under your control.</p>
      </section>
      <section class="help-section"><h3>Get help or share an idea</h3>
        <p>Use <b>Send Feedback</b> for a bug report or feature request. The About window shows the installed version and a pricing glossary. <b>Open Database Folder</b> is available for advanced recovery help; avoid moving or editing its files while Mana Ledger is open. Ko-fi support is optional and does not unlock features.</p>
      </section>`,
    related: ['settings', 'backups', 'pricing'],
  },
];

const stripMarkup = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export function helpGuideById(id) {
  return HELP_GUIDES.find(guide => guide.id === id) || HELP_GUIDES[0];
}

export function searchHelpGuides(query) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [...HELP_GUIDES];
  return HELP_GUIDES.filter(guide => {
    const haystack = `${guide.title} ${guide.summary} ${guide.keywords || ''} ${stripMarkup(guide.body)}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

function guideNavigation(activeId) {
  return HELP_GROUPS.map(group => `
    <div class="help-nav-group">
      <span>${esc(group)}</span>
      ${HELP_GUIDES.filter(guide => guide.group === group).map(guide => `
        <button type="button" class="help-nav-item${guide.id === activeId ? ' active' : ''}" data-help-guide="${esc(guide.id)}">
          <i>${esc(guide.icon)}</i><span><strong>${esc(guide.title)}</strong><small>${esc(guide.summary)}</small></span>
        </button>`).join('')}
    </div>`).join('');
}

function relatedGuides(guide) {
  const related = (guide.related || []).map(helpGuideById).filter(item => item && item.id !== guide.id);
  if (!related.length) return '';
  return `<section class="help-related"><h3>Keep exploring</h3><div>${related.map(item => `<button type="button" data-help-guide="${esc(item.id)}"><i>${esc(item.icon)}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small></span></button>`).join('')}</div></section>`;
}

function guideArticle(guide) {
  return `<article class="help-article">
    <header><span>${esc(guide.group)}</span><div><i>${esc(guide.icon)}</i><h2>${esc(guide.title)}</h2></div><p>${esc(guide.summary)}</p></header>
    ${guide.body}
    ${relatedGuides(guide)}
  </article>`;
}

function searchResults(query, guides) {
  return `<section class="help-search-results">
    <header><span>Search results</span><h2>${guides.length ? `${guides.length} guide${guides.length === 1 ? '' : 's'} for “${esc(query)}”` : `Nothing found for “${esc(query)}”`}</h2><p>${guides.length ? 'Choose a guide below, or keep typing to narrow the list.' : 'Try a feature name such as “chart,” “import,” “Secret Lair,” “backup,” or “price.”'}</p></header>
    ${guides.length ? `<div>${guides.map(guide => `<button type="button" data-help-guide="${esc(guide.id)}"><i>${esc(guide.icon)}</i><span><strong>${esc(guide.title)}</strong><small>${esc(guide.summary)}</small><em>${esc(guide.group)}</em></span></button>`).join('')}</div>` : ''}
  </section>`;
}

export function showHelpCenter(initialGuide = 'welcome') {
  let active = helpGuideById(initialGuide).id;
  showModal(`
    <div class="help-app">
      <header class="help-header">
        <div class="help-header-mark">?</div>
        <div><h2>Mana Ledger Guide</h2><p>Practical help for every workspace, tool, and setting.</p></div>
        <label class="help-search"><span>⌕</span><input id="help-search" type="search" placeholder="Search guides…" autocomplete="off" aria-label="Search Mana Ledger guides"></label>
      </header>
      <div class="help-layout">
        <nav class="help-nav" id="help-nav" aria-label="Help topics">${guideNavigation(active)}</nav>
        <main class="help-stage" id="help-stage" tabindex="-1">${guideArticle(helpGuideById(active))}</main>
      </div>
      <footer class="help-footer"><span>Tip: press Ctrl+K from the main app to search your collection.</span><button class="btn btn-primary" data-act="hideModal">Close guide</button></footer>
    </div>`, 'settings');

  const app = document.querySelector('.help-app');
  const nav = document.getElementById('help-nav');
  const stage = document.getElementById('help-stage');
  const input = document.getElementById('help-search');
  if (!app || !nav || !stage || !input) return;

  const openGuide = id => {
    active = helpGuideById(id).id;
    input.value = '';
    nav.innerHTML = guideNavigation(active);
    stage.innerHTML = guideArticle(helpGuideById(active));
    stage.scrollTop = 0;
    stage.focus({ preventScroll: true });
  };

  app.addEventListener('click', event => {
    const button = event.target.closest('[data-help-guide]');
    if (button) openGuide(button.dataset.helpGuide);
  });

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (!query) {
      nav.innerHTML = guideNavigation(active);
      stage.innerHTML = guideArticle(helpGuideById(active));
      return;
    }
    const matches = searchHelpGuides(query);
    nav.querySelectorAll('.help-nav-item').forEach(button => {
      button.hidden = !matches.some(guide => guide.id === button.dataset.helpGuide);
    });
    nav.querySelectorAll('.help-nav-group').forEach(group => {
      group.hidden = !group.querySelector('.help-nav-item:not([hidden])');
    });
    stage.innerHTML = searchResults(query, matches);
    stage.scrollTop = 0;
  });

  requestAnimationFrame(() => input.focus());
}
