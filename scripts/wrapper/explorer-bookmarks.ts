import * as path from "https://deno.land/std@0.198.0/path/mod.ts";
import * as fmt from "https://deno.land/std@0.198.0/fmt/printf.ts";
import * as datetime from "https://deno.land/std@0.198.0/datetime/mod.ts";
import * as log from "https://deno.land/std@0.198.0/log/mod.ts";
import CommandOutput = Deno.CommandOutput;

/**
 * EB_LOG_LEVEL is the log level of the script.
 * Default: Verbose
 * @see https://deno.land/std@0.198.0/log/mod.ts
 */
// FIXME: This can be improved.
let levelName: log.LevelName;
switch ((Deno.env.get("EB_LOG_LEVEL") ?? "").toUpperCase()) {
	case "NOTSET":
		levelName = "NOTSET";
		break;
	case "DEBUG":
		levelName = "DEBUG";
		break;
	case "INFO":
		levelName = "INFO";
		break;
	case "WARNING":
		levelName = "WARNING";
		break;
	case "ERROR":
		levelName = "ERROR";
		break;
	case "CRITICAL":
		levelName = "CRITICAL";
		break;
	default:
		levelName = "WARNING";
		break;
}

log.setup({
	// Define handlers
	handlers: {
		console: new log.handlers.ConsoleHandler("DEBUG", {
			formatter: (logRecord) => {
				const timestamp = datetime.format(logRecord.datetime, "HH:mm:ss.SSS");
				let msg = `${timestamp} [${logRecord.levelName}] ${logRecord.msg}`;
				logRecord.args.forEach((arg) => {
					switch (typeof (arg)) {
						case "undefined":
							msg += " {undefined}";
							break;
						case "object":
							msg += fmt.sprintf(" %i", arg);
							break;
						default:
							msg += fmt.sprintf(" {%v}", arg);
					}
				});
				return msg;
			},
		}),
	},
	// Assign handlers to loggers
	loggers: {
		default: {
			handlers: ["console"],
			level: levelName,
		}
	}
});
const logger = log.getLogger();

/**
 * Bookmarks config definition
 */
interface BookmarksConfig {
	install: {
		/**
		 * Path to the script to install. This script will be copied to this path.
		 * TODO: Old name: ScriptPath
		 * Environmental variable: EB_SCRIPT_PATH
		 * FIXME: Change this to .ts and compile with Deno
		 * FIXME: Uninstall the .ps1 file
		 */
		path: string;

		/**
		 * Path to the Deno executable.
		 * FIXME: This probably isn't needed.
		 */
		deno: string;
	},

	save: {
		/**
		 * Directory to save the explorer bookmarks file
		 * Do not check if the directory exists because it will be created later.
		 * TODO: Old name: $BookmarksDir
		 * Environmental variable: EB_BOOKMARKS_DIR
		 * Default: $ENV:UserProfile\Documents\Explorer-Bookmarks\
		 */
		dir: string;

		/**
		 * Filename of the current bookmark file to create
		 * TODO: Old name: $FilenamePrefix
		 * Environmental variable: EB_BOOKMARKS_DIR
		 * Default: ExplorerBookmarks-{yyyyMMdd-HHmmss}.txt
		 */
		filename: string;

		/**
		 * Prefix of the explorer bookmarks file
		 * TODO: Old name: $FilenamePrefix
		 * Environmental variable: EB_FILENAME_PREFIX
		 * Default: ExplorerBookmarks
		 */
		prefix: string;

		/**
		 * Filename pattern to search for all bookmark filenames
		 * TODO: Old name: FilenamePattern
		 */
		pattern: RegExp;
	},

	scheduledTask: {
		/**
		 * Scheduled task name in Windows
		 * TODO: Old name: TaskName
		 */
		name: string;
	},

	/**
	 * Maximum number of bookmark files to save
	 * TODO: Old name: MaxNumFiles
	 * Environmental variable: EB_MAX_NUM_FILES
	 */
	maxNumFiles: {
		min: number;
		max: number;
		default: number;
		current: number;
	},

	/**
	 * Maximum file size to restore
	 * TODO: Old name: MaxNumFiles
	 * Environmental variable: EB_RESTORE_MAX_FILE_SIZE
	 */
	restoreMaxFileSize: {
		min: number;
		max: number;
		default: number;
		current: number;
	},

	/**
	 * Maximum number of windows to restore. Technically this is calculated by counting the number of lines in the
	 * file to restore.
	 * TODO: Old name: RestoreMaxWindows
	 * Environmental variable: EB_RESTORE_MAX_WINDOWS
	 */
	restoreMaxWindows: {
		min: number;
		max: number;
		default: number;
		current: number;
	},

	/**
	 * Delay in seconds between opening windows. This can be a fraction.
	 * TODO: Old name: RestoreDelaySeconds
	 * Environmental variable: EB_RESTORE_DELAY_SECONDS
	 */
	restoreDelaySeconds: {
		min: number;
		max: number;
		default: number;
		current: number;
	},

}

/**
 * Bookmarks config object
 */
const bookmarksConfig: BookmarksConfig = {
	install: {
		path: `C:/ProgramData/TacticalRMM/Explorer-Bookmarks.exe`,
		deno: `C:/ProgramData/exec-wrapper/bin/deno.exe`,
	},
	save: {
		dir: path.join(Deno.env.get("UserProfile") ?? "", `/Documents/Explorer-Bookmarks`),
		filename: "ExplorerBookmarks-yyyyMMdd-HHmmss.txt",
		prefix: "ExplorerBookmarks",
		pattern: new RegExp(`ExplorerBookmarks-.*\.txt`),
	},
	scheduledTask: {
		name: "Restore-Explorer-Bookmarks",
	},
	maxNumFiles: {
		min: 1,
		max: 1000,
		default: 20,
		current: 20,
	},
	restoreMaxFileSize: {
		min: 1,
		max: 4096,
		default: 1024,
		current: 1024,
	},
	restoreMaxWindows: {
		min: 1,
		max: 100,
		default: 50,
		current: 50,
	},
	restoreDelaySeconds: {
		min: 0,
		max: 10,
		default: 0.5,
		current: 0.5,
	},

};

/**
 * Process the environmental variables and bookmarksConfig.
 */
function processConfig() {
	if (Deno.env.has("EB_SCRIPT_PATH")) {
		bookmarksConfig.install.path = Deno.env.get("EB_SCRIPT_PATH")!;
	}

	if (Deno.env.has("EB_BOOKMARKS_DIR")) {
		bookmarksConfig.save.dir = Deno.env.get("EB_BOOKMARKS_DIR")!;
	}

	if (Deno.env.has("EB_FILENAME_PREFIX")) {
		bookmarksConfig.save.prefix = Deno.env.get("EB_FILENAME_PREFIX")!;
	}

	bookmarksConfig.save.pattern = new RegExp(`${bookmarksConfig.save.prefix}-.*\.txt`);
	bookmarksConfig.save.filename = `${bookmarksConfig.save.prefix}-${datetime.format(new Date(), "yyyyMMdd-HHmmss")}.txt`;

	if (Deno.env.has("EB_MAX_NUM_FILES")) {
		const envMaxNumFiles = Number(Deno.env.get("EB_FILENAME_PREFIX")!);
		if ((envMaxNumFiles < bookmarksConfig.maxNumFiles.min) ||
			(envMaxNumFiles > bookmarksConfig.maxNumFiles.max)) {
			logger.warning(`(main) EB_MAX_NUM_FILES is not within the allowable range: ` +
				`${bookmarksConfig.maxNumFiles.min} <= ${envMaxNumFiles} <= ${bookmarksConfig.maxNumFiles.max}`);
			logger.warning(`(main) EB_MAX_NUM_FILES: Using default of ${bookmarksConfig.maxNumFiles.default}`);
		} else {
			bookmarksConfig.maxNumFiles.current = Number(Deno.env.get("EB_MAX_NUM_FILES")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_MAX_FILE_SIZE")) {
		const envRestoreMaxFileSize = Number(Deno.env.get("EB_RESTORE_MAX_FILE_SIZE")!);
		if ((envRestoreMaxFileSize < bookmarksConfig.restoreMaxFileSize.min) ||
			(envRestoreMaxFileSize > bookmarksConfig.restoreMaxFileSize.max)) {
			logger.warning(`(main) EB_MAX_NUM_FILES is not within the allowable range: ` +
				`${bookmarksConfig.restoreMaxFileSize.min} <= ${envRestoreMaxFileSize} <= ${bookmarksConfig.restoreMaxFileSize.max}`);
			logger.warning(`(main) EB_MAX_NUM_FILES: Using default of ${bookmarksConfig.restoreMaxFileSize.default}`);
		} else {
			bookmarksConfig.restoreMaxFileSize.current = Number(Deno.env.get("EB_RESTORE_MAX_FILE_SIZE")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_MAX_WINDOWS")) {
		const envRestoreMaxWindows = Number(Deno.env.get("EB_RESTORE_MAX_WINDOWS")!);
		if ((envRestoreMaxWindows < bookmarksConfig.restoreMaxWindows.min) ||
			(envRestoreMaxWindows > bookmarksConfig.restoreMaxWindows.max)) {
			logger.warning(`(main) EB_RESTORE_MAX_WINDOWS is not within the allowable range: ` +
				`${bookmarksConfig.restoreMaxWindows.min} <= ${envRestoreMaxWindows} <= ${bookmarksConfig.restoreMaxWindows.max}`);
			logger.warning(`(main) EB_RESTORE_MAX_WINDOWS: Using default of ${bookmarksConfig.restoreMaxWindows.default}`);
		} else {
			bookmarksConfig.restoreMaxWindows.current = Number(Deno.env.get("EB_RESTORE_MAX_WINDOWS")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_DELAY_SECONDS")) {
		const envRestoreDelaySeconds = Number(Deno.env.get("EB_RESTORE_DELAY_SECONDS")!);
		if ((envRestoreDelaySeconds < bookmarksConfig.restoreDelaySeconds.min) ||
			(envRestoreDelaySeconds > bookmarksConfig.restoreDelaySeconds.max)) {
			logger.warning(`(main) EB_RESTORE_DELAY_SECONDS is not within the allowable range: ` +
				`${bookmarksConfig.restoreDelaySeconds.min} <= ${envRestoreDelaySeconds} <= ${bookmarksConfig.restoreDelaySeconds.max}`);
			logger.warning(`(main) EB_RESTORE_DELAY_SECONDS: Using default of ${bookmarksConfig.restoreDelaySeconds.default}`);
		} else {
			bookmarksConfig.restoreDelaySeconds.current = Number(Deno.env.get("EB_RESTORE_DELAY_SECONDS")!);
		}
	}

}

/**
 * newExplorerDir will create the Explorer Bookmarks directory if it does not already exist.
 * @param dir
 * @constructor
 */
function newExplorerDir(dir: string) {
	logger.info(`(NewExplorerDir) Creating directory to store bookmark files: '${dir}'`);
	try {
		Deno.mkdirSync(dir, {
			recursive: true,
		});
	} catch (err) {
		if (!(err instanceof Deno.errors.AlreadyExists)) {
			logger.error(`(newExplorerDir) Error creating directory: '${dir}'`);
			logger.error(`(newExplorerDir) err:`, err);
			throw err;
		}
	}
}

/**
 * Save the explorer paths to the bookmarks file.
 * If no explorer windows are open, a 0 byte file will be saved. This indicates all windows are closed and no windows
 * are restored upon login.
 */
async function saveExplorerBookmarks() {
	logger.info(`(saveExplorerBookmarks) Bookmarking the open explorer paths`);
	const script = `
		(New-Object -ComObject 'Shell.Application').Windows() | ForEach-Object {
			Write-Output $_.Document.Folder.Self.Path
		}
	`;
	try {
		const [code, stdout, stderr] = await powershell(script);
		if (code === 0) {
			logger.info(`(saveExplorerBookmarks) stdout:`, stdout);
		} else {
			logger.warning(`(saveExplorerBookmarks) return code:`, code);
			logger.warning(`(saveExplorerBookmarks) stdout:`, stdout);
			logger.warning(`(saveExplorerBookmarks) stderr:`, stderr);
		}

		// Stripe the tailing newline
		const paths = stdout.trim();
		logger.debug(`(saveExplorerBookmarks) Saving ${paths.split("\r\n").length} paths to ${bookmarksConfig.save.filename}`);
		await Deno.writeTextFile(path.join(bookmarksConfig.save.dir, bookmarksConfig.save.filename), paths);
	} catch (err) {
		logger.error(`(saveExplorerBookmarks) Error saving the explorer path to the bookmarks file`);
		logger.error(`(saveExplorerBookmarks) err:`, err);
		throw err;
	}
}

/**
 * Clean up duplicate files and files more than the configured maximum.
 * @constructor
 */
async function startCleanup() {
	logger.info(`(startCleanup) Cleaning up the bookmark files`);

	// fileArray is used to sort the files by last modified time.
	let fileArray: [string, Date][] = [];
	for await (const dirEntry of Deno.readDir(bookmarksConfig.save.dir)) {
		if (dirEntry.isFile && (dirEntry.name.match(bookmarksConfig.save.pattern) !== null)) {
			const fileInfo = Deno.statSync(path.join(bookmarksConfig.save.dir, dirEntry.name));
			fileArray.push([dirEntry.name, fileInfo.mtime ?? new Date(0)]);
		}
	}
	fileArray = fileArray.sort((a, b) => {
		return a[1].getTime() - b[1].getTime();
	});

	if (fileArray.length >= 2) {
		// Remove the current file if it's a duplicate of the previous bookmark file.
		const contentsLastOne = await Deno.readTextFile(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 1][0]));
		const contentsLastTwo = await Deno.readTextFile(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 2][0]));
		if (contentsLastOne == contentsLastTwo) {
			logger.info(`(startCleanup) The last two files are identical. Removing the last file: ${fileArray[fileArray.length - 2][0]}`);
			Deno.removeSync(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 2][0]));
			fileArray.pop();
		}
	}

	if (fileArray.length > bookmarksConfig.maxNumFiles.current) {
		// Remove files more than the configured maximum.
		logger.info(`(startCleanup) Removing files more than the configured maximum: ${bookmarksConfig.maxNumFiles.current}`);
		while (fileArray.length > bookmarksConfig.maxNumFiles.current) {
			logger.info(`(startCleanup) Removing file: ${fileArray[0][0]}`);
			Deno.removeSync(path.join(bookmarksConfig.save.dir, fileArray[0][0]));
			fileArray.shift();
		}
	}

}

/**
 * Add the Explorer Bookmarks integration to the right-click menu for *.txt files.
 *
 * Another way of doing this:
 * @see https://stackoverflow.com/questions/10618977/how-to-add-an-entry-in-the-windows-context-menu-for-files-with-a-specific-extens
 * @constructor
 */
async function addIntegration() {
	logger.info(`(addIntegration) Adding the integration into explorer's right-click menu`);

	const psScript = `
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

		// KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt"
		$KeyName = "Shell"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		if (-not(Test-Path -Path $Path)) {
			$null = New-Item -Path $KeyPath -Name $KeyName
		}

		// KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		$KeyName = "Explorer-Bookmarks"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		$Name = "(Default)"
		$Value = "Restore my Explorer Bookmarks"
		$Type = "String"
		// Need to check for the key and create it before checking for and creating the property.
		if (-not(Test-Path -Path $Path)) {
			// Create the key
			$null = New-Item -Path $KeyPath -Name $KeyName
			if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
				$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
			}
		}

		// KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		$KeyName = "Command"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks\\Command"
		$Name = "(Default)"
		$Value = ("${bookmarksConfig.install.path} \`"%1\`"")
		$Type = "String"
		// Need to check for the key and create it before checking for and creating the property.
		if (-not(Test-Path -Path $Path)) {
			// Create the key
			$null = New-Item -Path $KeyPath -Name $KeyName
			if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
				$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
			}
		}
	`;

	let code = 0;
	let stdout = "";
	let stderr = "";
	try {
		logger.info(`(addIntegration) Adding the right-click integration`);
		[code, stdout, stderr] = await powershell(psScript);
		if (code !== 0) {
			// PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
			// handle as necessary.
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(addIntegration) Error adding the integration`);
				logger.warning(`(addIntegration) This script needs to be run with Administrator permission`);
				logger.warning(`(addIntegration) stderr:`, stderr);
			} else if (stderr.match(/Requested registry access is not allowed/)) {
				logger.warning(`(addIntegration) Error adding the integration`);
				logger.warning(`(addIntegration) This script needs to be run with Administrator permission`);
				logger.warning(`(addIntegration) stderr:`, stderr);
			} else {
				logger.warning(`(addIntegration) return code:`, code);
				logger.warning(`(addIntegration) stdout:`, stdout);
				logger.warning(`(addIntegration) stderr:`, stderr);
			}
		}
	} catch (err: unknown) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(addIntegration) Error adding the integration`);
			logger.warning(`(addIntegration) This script needs to be run with Administrator permission`);
			logger.warning(`(addIntegration) err:`, err);
		} else {
			logger.error(`(addIntegration) Error adding the integration`);
			logger.error(`(addIntegration) stderr:`, stderr);
			logger.error(`(addIntegration) err:`, err);
			throw err;
		}
	}

}

/**
 * Remove the Explorer Bookmarks integration from the right-click menu of *.txt files.
 * @constructor
 */
async function removeIntegration() {
	logger.info(`(removeIntegration) Removing the integration from explorer's right-click menu`);
	// HKCR is not mounted by default
	// @see https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	const psScript = `
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks\\Command"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}
	`;

	let code = 0;
	let stdout = "";
	let stderr = "";
	try {
		logger.info(`(removeIntegration) Removing the right-click integration`);
		[code, stdout, stderr] = await powershell(psScript);
		if (code !== 0) {
			// PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
			// handle as necessary.
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(removeIntegration) Error removing the integration`);
				logger.warning(`(removeIntegration) This script needs to be run with Administrator permission`);
				logger.warning(`(removeIntegration) stderr:`, stderr);
			} else if (stderr.match(/Requested registry access is not allowed/)) {
				logger.warning(`(removeIntegration) Error removing the integration`);
				logger.warning(`(removeIntegration) This script needs to be run with Administrator permission`);
				logger.warning(`(removeIntegration) stderr:`, stderr);
			} else {
				logger.warning(`(removeIntegration) return code:`, code);
				logger.warning(`(removeIntegration) stdout:`, stdout);
				logger.warning(`(removeIntegration) stderr:`, stderr);
			}
		}
	} catch (err: unknown) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(removeIntegration) Error removing the integration`);
			logger.warning(`(removeIntegration) This script needs to be run with Administrator permission`);
			logger.warning(`(removeIntegration) err:`, err);
		} else {
			logger.error(`(removeIntegration) Error removing the integration`);
			logger.error(`(removeIntegration) stderr:`, stderr);
			logger.error(`(removeIntegration) err:`, err);
			throw err;
		}
	}

}

/**
 * Check if the scheduled task exists.
 * @constructor
 * @param taskName - Name of the task to check.
 */
async function existsScheduledTask(taskName: string) {
	const countPS = `
		(Get-ScheduledTask -TaskName ${taskName} -ErrorAction SilentlyContinue | measure).Count`;

	let code = 0;
	let stdout = "";
	let stderr = "";

	try {
		logger.debug(`(existsScheduledTask) Checking if scheduled task exists:`, taskName);
		[code, stdout, stderr] = await powershell(countPS);
		if (code !== 0) {
			logger.warning(`(existsScheduledTask) return code:`, code);
			logger.warning(`(existsScheduledTask) stdout:`, stdout);
			logger.warning(`(existsScheduledTask) stderr:`, stderr);
		}
	} catch (err) {
		logger.error(`(existsScheduledTask) Error checking if the scheduled task exists`);
		logger.error(`(existsScheduledTask) stderr:`, stderr);
		logger.error(`(existsScheduledTask) err:`, err);
		throw err;
	}

	logger.debug(`(existsScheduledTask) Result:`, (stdout.trim() !== "0"));
	return (stdout.trim() !== "0");
}

/**
 * Add the scheduled task to run when the user logs in.
 * @constructor
 */
async function addScheduledTask() {
	const taskExists = await existsScheduledTask(bookmarksConfig.scheduledTask.name);
	if (taskExists) {
		logger.info(`(addScheduledTask) Scheduled Task ${bookmarksConfig.scheduledTask.name} exists`);
		return;
	}

	const addTaskPS = `
		$Arguments = ("task")
		$Action = New-ScheduledTaskAction -Execute "${bookmarksConfig.install.path}" -Argument $Arguments
		$Trigger = New-ScheduledTaskTrigger -AtLogon
		$Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\\Users"
		$null = Register-ScheduledTask -TaskName "${bookmarksConfig.scheduledTask.name}" -Trigger $Trigger -Action $Action -Principal $Principal
	`;

	let code = 0;
	let stdout = "";
	let stderr = "";
	try {
		logger.info(`(addScheduledTask) Adding Scheduled Task: '${bookmarksConfig.scheduledTask.name}'`);
		[code, stdout, stderr] = await powershell(addTaskPS);
		if (code !== 0) {
			// PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
			// handle as necessary.
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(addScheduledTask) Error adding the Scheduled Task`);
				logger.warning(`(addScheduledTask) This script needs to be run with Administrator permission`);
				logger.warning(`(addScheduledTask) stderr:`, stderr);
			} else {
				logger.warning(`(addScheduledTask) return code:`, code);
				logger.warning(`(addScheduledTask) stdout:`, stdout);
				logger.warning(`(addScheduledTask) stderr:`, stderr);
			}
		}

		// TODO: This is here for future reference
		/**
		 * This soothes WebStorm but not Deno.
		 * @typedef {Object} scheduledTask - Scheduled Task object
		 * @property {string} TaskName - Task name of the Scheduled Task
		 */
		/** @type {scheduledTask} */
		/*
		const scheduledTask = JSON.parse(stdout);
		if (scheduledTask.TaskName == bookmarksConfig.scheduledTask.name) {
			logger.warning(`(addScheduledTask) Scheduled Task already exists:`, bookmarksConfig.scheduledTask.name);
			return;
		}
		*/
	} catch (err: unknown) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(addScheduledTask) Error adding the Scheduled Task`);
			logger.warning(`(addScheduledTask) This script needs to be run with Administrator permission`);
			logger.warning(`(addScheduledTask) err:`, err);
		} else {
			logger.error(`(addScheduledTask) Error adding the Scheduled Task`);
			logger.error(`(addScheduledTask) stderr:`, stderr);
			logger.error(`(addScheduledTask) err:`, err);
			throw err;
		}
	}

}

/**
 * Remove the scheduled task.
 */
async function removeScheduledTask() {
	const taskExists = await existsScheduledTask(bookmarksConfig.scheduledTask.name);
	if (!taskExists) {
		logger.info(`(removeScheduledTask) Scheduled Task does not ${bookmarksConfig.scheduledTask.name} exists`);
		return;
	}

	const addTaskPS = `
		$null = Unregister-ScheduledTask -TaskName ${bookmarksConfig.scheduledTask.name} -Confirm:$false
	`;

	let code = 0;
	let stdout = "";
	let stderr = "";

	try {
		logger.info(`(removeScheduledTask) Removing Scheduled Task: '${bookmarksConfig.scheduledTask.name}'`);
		[code, stdout, stderr] = await powershell(addTaskPS);
		if (code !== 0) {
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(removeScheduledTask) Error adding the Scheduled Task`);
				logger.warning(`(removeScheduledTask) This script needs to be run with Administrator permission`);
				logger.warning(`(removeScheduledTask) stderr:`, stderr);
			} else {
				logger.warning(`(removeScheduledTask) return code:`, code);
				logger.warning(`(removeScheduledTask) stdout:`, stdout);
				logger.warning(`(removeScheduledTask) stderr:`, stderr);
			}
		}

		// TODO: This is here for future reference
		/**
		 * This soothes WebStorm but not Deno.
		 * @typedef {Object} scheduledTask - Scheduled Task object
		 * @property {string} TaskName - Task name of the Scheduled Task
		 */
		/** @type {scheduledTask} */
		/*
		const scheduledTask = JSON.parse(stdout);
		if (scheduledTask.TaskName == bookmarksConfig.scheduledTask.name) {
			logger.warning(`(addScheduledTask) Scheduled Task already exists:`, bookmarksConfig.scheduledTask.name);
			return;
		}
		*/
	} catch (err) {
		logger.error(`(removeScheduledTask) Error removing the scheduled task`);
		logger.error(`(removeScheduledTask) stderr:`, stderr);
		logger.error(`(removeScheduledTask) err:`, err);
		throw err;
	}

}

/**
 * Compile the script and save it in the TacticalRMM directory for use by the user outside Tactical.
 * @constructor
 */
async function installScript() {
	const source = path.fromFileUrl(Deno.mainModule);
	const cmd = Deno.execPath();
	const args = [
		"compile",
		"--no-terminal",
		"--no-prompt",
		// These are the permissions needed by the script.
		"--allow-read",
		"--allow-write",
		"--allow-run",
		"--allow-sys",
		"--allow-env",
		// Save location
		"--output",
		bookmarksConfig.install.path,
		source,
	];

	let stderrText = "";
	let commandOutput: CommandOutput;
	try {
		// define command used to create the subprocess
		const command = new Deno.Command(cmd, {
			args: args,
			stdout: "piped",
			stderr: "piped",
		});

		// create subprocess and collect output
		logger.debug(`(installScript) Compiling '${source}' to executable '${bookmarksConfig.install.path}'`);
		commandOutput = await command.output();
		stderrText = new TextDecoder().decode(commandOutput.stderr);
	} catch (err) {
		logger.error(`(installScript) Error executing command:`, cmd);
		logger.error(`(installScript) err:`, err);
		logger.error(`(installScript) stderr:`, stderrText);
		throw err;
	}

	// Capture any errors
	if ((commandOutput.code !== 0) || (!commandOutput.success)) {
		logger.error(`(installScript) Error executing command '${cmd}'`);
		logger.error(`(installScript) Return code:`, commandOutput.code);
		logger.error(`(installScript) Success:`, commandOutput.success);
		throw stderrText;
	}

}

/**
 * Uninstall the Explorer-Bookmarks.exe executable from the system.
 * @constructor
 */
function uninstallScript() {
	try {
		const fileInfo = Deno.statSync(bookmarksConfig.install.path);
		if (fileInfo.isFile) {
			logger.info(`(uninstallScript) Uninstalling executable from ${bookmarksConfig.install.path}`);
			Deno.removeSync(bookmarksConfig.install.path);
		}
	} catch (err) {
		if (!(err instanceof Deno.errors.NotFound)) {
			logger.error(`(uninstallScript) Error removing executable: '${bookmarksConfig.install.path}'`);
			logger.error(`(uninstallScript) err:`, err);
			throw err;
		}
	}

	// Clean up PowerShell version of the script
	const ps1 = `C:/ProgramData/TacticalRMM/Explorer-Bookmarks.ps1`;
	try {
		logger.info(`(uninstallScript) Uninstalling PowerShell script ${ps1}`);
		Deno.removeSync(ps1);
	} catch (err) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(uninstallScript) Error removing PowerShell script: '${ps1}'`);
			logger.warning(`(uninstallScript) err:`, err);
		} else if (!(err instanceof Deno.errors.NotFound)) {
			logger.error(`(uninstallScript) Error removing PowerShell script: '${ps1}'`);
			logger.error(`(uninstallScript) err:`, err);
			throw err;
		}
	}
}

/**
 * Open the bookmarks in the given file.
 * @param bookmarkFile
 * @constructor
 */
async function openExplorerBookmarks(bookmarkFile: string) {
	logger.info(`(openExplorerBookmarks) Opening file ${bookmarkFile}`);

	// Check if the file is larger than the maximum file size.
	// This also checks if the file exists.
	try {
		const fileInfo = await Deno.stat(bookmarkFile);
		if (fileInfo.size > bookmarksConfig.restoreMaxFileSize.current) {
			logger.warning(`(openExplorerBookmarks) Requested file ${bookmarkFile} is more than the maximum file size`);
			logger.warning(`(openExplorerBookmarks) File size: ${fileInfo.size}`);
			logger.warning(`(openExplorerBookmarks) Maximum file size: ${bookmarksConfig.restoreMaxFileSize.current}`);
			return;
		}
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) {
			logger.warning(`(openExplorerBookmarks) Requested file ${bookmarkFile} is not found`);
			logger.warning(`(openExplorerBookmarks) err:`, err);
			return;
		} else {
			logger.error(`(openExplorerBookmarks) Unknown error when opening bookmarks file '${bookmarkFile}'`);
			logger.error(`(openExplorerBookmarks) err:`, err);
			throw err;
		}
	}

	let bookmarkPaths: string[];
	try {
		bookmarkPaths = (await Deno.readTextFile(bookmarkFile)).trim().split(`\n`);
		if (bookmarkPaths.length > bookmarksConfig.restoreMaxWindows.current) {
			logger.warning(`(openExplorerBookmarks) Number of explorer windows to restore is more than the maximum allowed`);
			logger.warning(`(openExplorerBookmarks) Windows to restore: ${bookmarkPaths.length}`);
			logger.warning(`(openExplorerBookmarks) Maximum windows to restore: ${bookmarksConfig.restoreMaxWindows.current}`);
			return;
		}
	} catch (err) {
		logger.error(`(openExplorerBookmarks) Unknown error when reading bookmarks file '${bookmarkFile}'`);
		logger.error(`(openExplorerBookmarks) err:`, err);
		throw err;
	}

	// Get the path to Windows explorer.exe
	let explorer = "";
	if (Deno.env.has("SystemRoot")) {
		explorer = path.join(Deno.env.get("SystemRoot") ?? "C:/Windows", "explorer.exe");
	} else {
		logger.warning(`(openExplorerBookmarks) Environmental variable 'SystemRoot' is not set`);
	}

	bookmarkPaths.forEach(bookmarkPath => {
		try {
			// Trim the trailing carriage return (\r) since the split was on newline (\n).
			const fileInfo = Deno.statSync(bookmarkPath.trim());
			if (fileInfo.isDirectory) {
				logger.debug(`(openExplorerBookmarks) Opening Explorer Bookmark: ${bookmarkPath}`);
				// For additional command line switches:
				// @see https://superuser.com/questions/21394/explorer-command-line-switches
				spawn(explorer, [bookmarkPath.trim()]);
			} else {
				logger.info(`(openExplorerBookmarks) Bookmark was not found: ${bookmarkPath}`);
			}
		} catch (err) {
			if (!(err instanceof Deno.errors.NotFound)) {
				logger.error(`(openExplorerBookmarks) Unknown error when reading bookmarks file '${bookmarkFile}'`);
				logger.error(`(openExplorerBookmarks) err:`, err);
				throw err;
			}
		}
	});
}

/**
 * testIsAdmin will return true if the current user is an administrator.
 * For Windows:
 *   "Mandatory Label\High Mandatory Level" is when the script is run from an elevated session.
 *   "Mandatory Label\System Mandatory Level" is when the script is run from SYSTEM.
 * @constructor
 */
async function testIsAdmin() {
	let cmd: string;
	let args: string[] = [];
	if (Deno.build.os === "windows") {
		cmd = "C:/Windows/System32/whoami.exe";
		args = [
			"/groups",
		];
	} else {
		cmd = "/usr/bin/whoami";
	}

	const command = new Deno.Command(cmd, {
		args: args,
	});
	const {code, stdout, stderr} = await command.output();

	// Capture any errors
	if (code !== 0) {
		logger.error(`(testIsAdmin) Error executing command '${cmd}': return code: ${code}`);
		const stderrText = new TextDecoder().decode(stderr);
		logger.error(`(testIsAdmin) stderr:\n`, stderrText);
		throw stderrText;
	}

	// Process the output
	const stdoutText = new TextDecoder().decode(stdout);
	if (Deno.build.os === "windows") {
		return (stdoutText.includes("Mandatory Label\\High Mandatory Level") ||
			stdoutText.includes("Mandatory Label\\System Mandatory Level"));
	} else {
		return (stdoutText.includes("root"));
	}
}

/**
 * TestIsInterativeShell will return true if the program is being run interactively.
 * For Linux/macOS:
 *   This checks if stdin is a terminal.
 * For Windows:
 *   This checks if PowerShell was run with the -NonInteractive switch.
 *   @See https://stackoverflow.com/questions/9738535/powershell-test-for-noninteractive-mode
 * @constructor
 */
function testIsInteractiveShell() {
	logger.debug(`(testIsInteractiveShell) isATTY STDIN:`, Deno.isatty(Deno.stdin.rid));
	logger.debug(`(testIsInteractiveShell) isATTY STDOUT:`, Deno.isatty(Deno.stdout.rid));
	return Deno.isatty(Deno.stdin.rid);
}

/**
 * powershell will run the script in powershell and return stdout, stderr and the return code.
 * FIXME: PowerShell's try/catch doesn't work 99% of the time because the error is not a terminating error.
 * TODO: Add '-ErrorAction Stop' to PS scripts to catch the exception and handle it.
 * @see https://stackoverflow.com/questions/41476550/try-catch-not-working-in-powershell-script
 * @see https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.3
 * @param script
 */
async function powershell(script: string): Promise<[number, string, string]> {
	if (Deno.build.os === "windows") {
		// https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1&viewFallbackFrom=powershell-7.2
		const cmd = "c:/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe";
		const args = [
			"-NonInteractive",
			"-NoProfile",
			"-NoLogo",
			"-InputFormat",
			"text",
			"-OutputFormat",
			"text",
			"-Command",
			script,
		];

		let stdoutText = "";
		let stderrText = "";
		let commandOutput: CommandOutput;
		try {
			// define command used to create the subprocess
			// logger.debug(`(powershell) Running powershell script: ${cmd}`);
			// logger.debug(`(powershell) Args:`, args);
			const command = new Deno.Command(cmd, {
				args: args,
				stdout: "piped",
				stderr: "piped",
			});

			// create subprocess and collect output
			commandOutput = await command.output();
			stderrText = new TextDecoder().decode(commandOutput.stderr);
			stdoutText = new TextDecoder().decode(commandOutput.stdout);
		} catch (err) {
			if (err instanceof Deno.errors.NotFound) {
				logger.error(`(powershell) Error executing command:`, cmd);
				logger.error(`(powershell) err:`, err);
				logger.error(`(powershell) stderr:`, stderrText);
				logger.error(`(powershell) File Not Found:`, cmd);
				// throw err;
				return [1, stdoutText, err.message];
			} else {
				logger.error(`(powershell) Error executing command:`, cmd);
				logger.error(`(powershell) err:`, err);
				logger.error(`(powershell) stderr:`, stderrText);
				return [1, stdoutText, err.message];
			}
		}

		// Capture any errors
		if ((commandOutput.code !== 0) || (!commandOutput.success)) {
			logger.error(`(powershell) Error executing command '${cmd}'`);
			logger.error(`(powershell) Return code:`, commandOutput.code);
			logger.error(`(powershell) Success:`, commandOutput.success);
		}
		return [commandOutput.code, stdoutText, stderrText];

	} else {
		logger.warning(`(powershell) Attempt to run powershell command on non-Windows OS`);
		logger.warning(`(powershell)`, script);
		return [0, "", ""];
	}
}

/**
 * Spawn a new process.
 * @param cmd
 * @param args
 */
function spawn(cmd: string, args: string[]) {
	try {
		// define command used to create the subprocess
		const command = new Deno.Command(cmd, {
			args: args,
			// stdout: "inherit",
			// stderr: "inherit",
		});

		// Spawn the subprocess
		const childProcess = command.spawn();
		// Ensure that the status of the child process does not block the Deno process from exiting.
		childProcess.unref();
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) {
			logger.error(`(spawn) Error spawning command:`, cmd);
			logger.error(`(spawn) err:`, err);
			logger.error(`(spawn) File Not Found:`, cmd);
			throw err;
		} else {
			logger.error(`(spawn) Error spawning command:`, cmd);
			logger.error(`(spawn) err:`, err);
			throw err;
		}
	}

}

/**
 * GetHelp will print the help message.
 * @constructor
 */
function GetHelp() {
	const help = `explorer-bookmarks.ps1
	Bookmark the Windows Explorer paths in a file.

explorer-bookmarks.ps1 <file>
	Load the bookmarks from a file. This is usually done from a right-click menu.

explorer-bookmarks.ps1 task
	This command is run from the scheduled task to restore the last bookmarks saved.

explorer-bookmarks.ps1 <install | uninstall | reinstall>
	Install/uninstall/reinstall the integration: Script, right click menu and scheduled task.

Environmental variables:

	EB_BOOKMARKS_DIR - Directory to save the explorer bookmark files.
	EB_MAX_NUM_FILES - Maximum number of bookmark files to save.
	EB_FILENAME_PREFIX - Filename prefix to use for the bookmark files.
	EB_RESTORE_MAX_FILE_SIZE - Maximum file size to restore.
	EB_RESTORE_MAX_WINDOWS - Maximum number of windows to restore.
	  Note: This counts the lines in the file, not actual windows.
	EB_RESTORE_DELAY_SECONDS - Delay in seconds between opening each window.
	EB_SCRIPT_PATH - Where to install this script for the integration.
	EB_LOG_LEVEL - Set the log level of the script.
	`;
	console.log(help);
}

processConfig();

const isAdmin = await testIsAdmin();
// Test for interactivity is not needed because Deno doesn't close the shell like PowerShell does.
const _isInteractiveShell = testIsInteractiveShell();
let returnCode = 0;

if (Deno.build.os !== "windows") {
	logger.warning(`(main) This script is designed for Windows. Please run it on a Windows OS.`);
	returnCode = 1;
	Deno.exit(returnCode);
}

if (Deno.env.has("EB_ACTION")) {
	switch (Deno.env.get("EB_ACTION")?.toLowerCase()) {

		case "install": {
			if (isAdmin) {
				await installScript();
				await addIntegration();
				await addScheduledTask();
			} else {
				logger.error(`(main) Failed to install the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "uninstall": {
			if (isAdmin) {
				uninstallScript();
				await removeIntegration();
				await removeScheduledTask();
			} else {
				logger.error(`(main) Failed to uninstall the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "reinstall": {
			if (isAdmin) {
				// Uninstall
				uninstallScript();
				await removeIntegration();
				await removeScheduledTask();
				logger.info(`(main)`);

				// Install
				await installScript();
				await addIntegration();
				await addScheduledTask();
			} else {
				logger.error(`(main) Failed to reinstall the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "dev": {
			await saveExplorerBookmarks();
			await removeIntegration();
			await addIntegration();
		}
			break;

		case "help":
			GetHelp();
			break;

		default:
			logger.error(`(main) Invalid action: '${Deno.env.get("EB_ACTION")?.toLowerCase()}'`);
			GetHelp();
			returnCode = 1;
			break;
	}
} else {

	switch (Deno.args.length) {
		case 0: {
			if (isAdmin) {
				logger.warning(`(main) This script should not be run as an administrator.`);
				returnCode = 1;
				break;
			}

			// Zero args: Save the Explorer paths
			// User configuration
			newExplorerDir(bookmarksConfig.save.dir);
			await saveExplorerBookmarks();
			await startCleanup();
		}
			break;

		case 1: {
			switch (Deno.args[0].toLowerCase()) {

				case "task": {
					// Scheduled task to open the bookmarks in the last saved file.
					if (isAdmin) {
						logger.warning(`(main) This script should not be run as an administrator.`);
						returnCode = 1;
						break;
					}

					// Open the bookmarks saved in the last bookmark file.
					let fileArray: [string, Date][] = [];
					for await (const dirEntry of Deno.readDir(bookmarksConfig.save.dir)) {
						if (dirEntry.isFile && (dirEntry.name.match(bookmarksConfig.save.pattern) !== null)) {
							const fileInfo = Deno.statSync(path.join(bookmarksConfig.save.dir, dirEntry.name));
							fileArray.push([dirEntry.name, fileInfo.mtime ?? new Date(0)]);
						}
					}
					if (fileArray.length >= 1) {
						fileArray = fileArray.sort((a, b) => {
							return a[1].getTime() - b[1].getTime();
						});
						// Sleep 10 seconds to allow the desktop and other tasks to load.
						const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
						await sleep(10 * 1000);
						await openExplorerBookmarks(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 1][0]));
					}

				}
					break;

				default: {
					// Open the bookmarks from the right-click menu in Explorer.
					await openExplorerBookmarks(Deno.args[0]);
					// FIXME: Should this sleep?
				}
					break;
			}
		}
			break;

		default: {
			logger.error(`(main) Wrong number of arguments: '${Deno.args.length}'`);
			GetHelp();
			returnCode = 1;
		}
	}
}

Deno.exit(returnCode);
