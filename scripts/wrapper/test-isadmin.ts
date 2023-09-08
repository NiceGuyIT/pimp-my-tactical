import * as colors from "https://deno.land/std@0.201.0/fmt/colors.ts";
import * as log from "https://deno.land/std@0.201.0/log/mod.ts";
import * as tslib from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.0.8/scripts/ts-lib/mod.ts";
// import * as tslib from "../ts-lib/mod.ts";

/**
 * Configure the logging system.
 */
log.setup(tslib.MyLogConfig);
const logger = log.getLogger();

// Are we developers?
const dev = true;

if (dev) {
	// Enable color logging
	if (!colors.getColorEnabled()) {
		colors.setColorEnabled(true);
	}
	logger.debug(`(main) Color enabled:`, colors.getColorEnabled());
} else {
	// Disable color logging
	if (colors.getColorEnabled()) {
		colors.setColorEnabled(false);
	}

}

const isAdmin = await tslib.TestIsAdmin();
logger.info(`(main) isAdmin: ${isAdmin}`);
