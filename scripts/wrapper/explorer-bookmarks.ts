import { readLines } from "https://deno.land/std@0.198.0/io/read_lines.ts";
import { exists } from "https://deno.land/std@0.198.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.198.0/path/mod.ts";
import { format } from "https://deno.land/std@0.198.0/datetime/mod.ts";
// import {exec} from "https://deno.land/x/exec/mod.ts";
import * as log from "https://deno.land/std@0.198.0/log/mod.ts";

/*
const isReadableDir = await exists(path, {
	isDirectory: true,
	isReadable: true,
});
*/

const bookmarks = 'test-file.txt';
const fileReader = await Deno.open(bookmarks);

for await (const line of readLines(fileReader)) {
	// console.log('Line is', line);
	if (await exists(line, {
		isDirectory: true,
		isReadable: true,
	})) {
		console.log('Opening directory', line);
	}
}
// await exec('echo ' . contents);


/**
 * EB_BOOKMARKS_DIR is the directory to save the explorer bookmark files
 * Do not check if the directory exists because it will be created later.
 * Default: Documents\Explorer-Bookmarks\
 */
const BookmarksDir = Deno.env.get('EB_BOOKMARKS_DIR') ??
	join(Deno.env.get('UserProfile') ?? "", `/Documents/Explorer-Bookmarks`);

/**
 * EB_FILENAME_PREFIX is the filename prefix to use
 */
const FilenamePrefix = Deno.env.get('EB_FILENAME_PREFIX') ?? "ExplorerBookmarks";

// Name to use for the scheduled task.
const TaskName = "Restore-Explorer-Bookmarks";

// Filename pattern is used to search for all bookmark filenames
const FilenamePattern = `${FilenamePrefix}-*.txt`;

// BookmarkFilename is the current bookmark file to create
const BookmarkFilename = `${FilenamePrefix}-${format(new Date(), "yyyyMMdd-HHmmss")}.txt`;

/**
 * ENV:EB_MAX_NUM_FILES is the maximum number of bookmark files to save
 * Default: 20
 * Hard limit: 1000
 */
let MaxNumFiles = Number(Deno.env.get("EB_MAX_NUM_FILES") ?? 20);
if ((MaxNumFiles < 1) || (MaxNumFiles > 1000)) {
	console.warn(`EB_MAX_NUM_FILES: is not a number between 1 and 1000 inclusive: '${MaxNumFiles}'`);
	console.warn(`EB_MAX_NUM_FILES: Using default of 20`);
	MaxNumFiles = 20;
}

/**
 * EB_RESTORE_MAX_FILE_SIZE is the maximum file size to restore
 * Default: 10k
 */
let RestoreMaxFileSize = Number(Deno.env.get('EB_RESTORE_MAX_FILE_SIZE') ?? 10*1024);
if ((RestoreMaxFileSize < 1) || (RestoreMaxFileSize > 1000)) {
	console.warn(`EB_RESTORE_MAX_FILE_SIZE: is not a number between 1 and 1000 inclusive: '${RestoreMaxFileSize}'`);
	console.warn(`EB_RESTORE_MAX_FILE_SIZE: Using default of 10K`);
	RestoreMaxFileSize = 10*1024;
}

/**
 * EB_RESTORE_MAX_WINDOWS is the maximum number of windows to restore. Technically this is calculated by counting
 * the number of lines in the file to restore.
 * Default: 100
 * Hard limit: 250
*/
let RestoreMaxWindows = Number(Deno.env.get('EB_RESTORE_MAX_WINDOWS') ?? 100);
if ((RestoreMaxWindows < 1) || (RestoreMaxWindows > 250)) {
	console.warn(`EB_RESTORE_MAX_WINDOWS: is not a number between 1 and 250 inclusive: '${RestoreMaxWindows}'`);
	console.warn(`EB_RESTORE_MAX_WINDOWS: Using default of 100`);
	RestoreMaxWindows = 100;
}

/**
 * EB_RESTORE_DELAY_SECONDS is the delay in seconds between opening windows. This can be a fraction.
 * Default: 0.5
 * Hard limit: 30
 */
let RestoreDelaySeconds = Number(Deno.env.get('EB_RESTORE_DELAY_SECONDS') ?? 0.5);
if ((RestoreDelaySeconds < 1) || (RestoreDelaySeconds > 30)) {
	console.warn(`EB_RESTORE_DELAY_SECONDS: is not a number between 1 and 30 inclusive: '${RestoreDelaySeconds}'`);
	console.warn(`EB_RESTORE_DELAY_SECONDS: Using default of 0.5`);
	RestoreDelaySeconds = 0.5;
}

/**
 * ENV:EB_SCRIPT_PATH is the path to the script to install. This script will be copied to this path.
 * Default: TacticalRMM directory, "C:\ProgramData\TacticalRMM\Explorer-Bookmarks.ps1"
 */
const ScriptPath = Deno.env.get('EB_SCRIPT_PATH') ?? `C:/ProgramData/TacticalRMM/Explorer-Bookmarks.ps1`

/**
 * ENV:EB_LOG_LEVEL is the log level of the script.
 * Default: Verbose
 */
const LogLevel = Deno.env.get('EB_LOG_LEVEL') ?? "WARNING";
if (LogLevel in log.LogLevels) {
	log.setup({
		loggers: {
			default: {
				level: LogLevel,
			}
		}
	})
}

