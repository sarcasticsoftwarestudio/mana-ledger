'use strict';

// Distribution channel, read synchronously from the preload (main.js passes
// it via additionalArguments). Leaf module — no imports — so any module can
// read it at load time without import-cycle TDZ surprises.
export const CHANNEL = globalThis.window?.api?.app?.channelName || 'github';

// Steam review rejects off-store donation links (Ko-fi) and optional
// third-party services the player must sign up for (PriceCharting, the
// CardTrader API). The GitHub build keeps them; the Steam build hides every
// path to them.
export const STORE_BUILD = CHANNEL === 'steam';
