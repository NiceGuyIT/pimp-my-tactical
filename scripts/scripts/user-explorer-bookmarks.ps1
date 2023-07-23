<#
Bookmark (save) the Windows Explorer paths in a file that can be restored later by opening explorer windows to
all the paths.

Two versions of the script need to be maintained (issue #1574):
1. One version with the "Run As User" checked. Set this up as a task in TRMM to run every X minutes. This will
   save the open explorer windows for the logged in user.
2. One version without the "Run As User" checked. Set this up as a check or run it manually. Add the "install"
   parameter to install the script to the TacticalRMM directory, modify the registry to add the Right-Click
   menu, and add a scheduled task to run the script upon login.

Note: The right-click menu and scheduled tasks run the script in the TacticalRMM directory. If the script is
modified, re-run it with the "reinstall" command. This will update (uninstall/install) the script, right-click
menu and scheduled task.

Note 2: Due to issue #1573, an alert will be generated if the user is not logged in. Set the alert to
informational or create a separate policy for user scripts ("Run As User" checked).

Environmental variables are always stored as strings. Type casting needs to take place, either implicitly or
explicitly.
#>

# ENV:EB_MAX_NUM_FILES is the maximum number of bookmark files to save
# Default: 20
# Hard limit: 1000
$MaxNumFiles = 20
if ($null -ne $ENV:EB_MAX_NUM_FILES) {
	$tmpMaxNumFiles = [int]$ENV:EB_MAX_NUM_FILES
	if (($tmpMaxNumFiles -gt 0) -and ($tmpMaxNumFiles -le 1000)) {
		$MaxNumFiles = $tmpMaxNumFiles
	} else {
		Write-Warning ("EB_MAX_NUM_FILES is not a number between 1 and 1000 inclusive: '{0}'" -f [int]$ENV:EB_MAX_NUM_FILES)
	}
}

# ENV:EB_BOOKMARKS_DIR is the directory to save the explorer bookmark files
# Do not check if the directory exists because it will be created later.
# Default: Documents\Explorer-Bookmarks\
$BookmarksDir = "${ENV:UserProfile}\Documents\Explorer-Bookmarks"
if ($null -ne $ENV:EB_BOOKMARKS_DIR) {
	$BookmarksDir = $ENV:EB_BOOKMARKS_DIR
}

# ENV:EB_FILENAME_PREFIX is the filename prefix to use
$FilenamePrefix = "ExplorerBookmarks"
if ($null -ne $ENV:EB_FILENAME_PREFIX) {
	$FilenamePrefix = $ENV:EB_FILENAME_PREFIX
}

# Name to use for the scheduled task.
$TaskName = "Restore-Explorer-Bookmarks"

# Filename pattern is used to search for all bookmark filenames
$FilenamePattern = $( '{0}-*.txt' -f $FilenamePrefix )

# BookmarkFilename is the current bookmark file to create
$BookmarkFilename = $( '{0}-{1}.txt' -f $FilenamePrefix, $( Get-Date -format "yyyyMMdd-HHmmss" ) )

# ENV:EB_RESTORE_MAX_FILE_SIZE is the maximum file size to restore
# Default: 10k
$RestoreMaxFileSize = 10*1024
if ($null -ne $ENV:EB_RESTORE_MAX_FILE_SIZE) {
	$tmpRestoreMaxFileSize = [int]$ENV:EB_RESTORE_MAX_FILE_SIZE
	if (($tmpRestoreMaxFileSize -gt 0) -and ($tmpRestoreMaxFileSize -le 1000)) {
		$RestoreMaxFileSize = $tmpRestoreMaxFileSize
	} else {
		Write-Warning ("EB_RESTORE_MAX_FILE_SIZE is not a number between 1 and 1000 inclusive: '{0}'" -f [int]$ENV:EB_RESTORE_MAX_FILE_SIZE)
	}
}

# ENV:EB_RESTORE_MAX_WINDOWS is the maximum number of windows to restore. Technically this is calculated by counting
# the number of lines in the file to restore.
# Default: 100
# Hard limit: 250
$RestoreMaxWindows = 100
if ($null -ne $ENV:EB_RESTORE_MAX_WINDOWS) {
	$tmpRestoreMaxWindows = [int]$ENV:EB_RESTORE_MAX_WINDOWS
	if (($tmpRestoreMaxWindows -gt 0) -and ($tmpRestoreMaxWindows -le 250)) {
		$RestoreMaxWindows = $tmpRestoreMaxWindows
	} else {
		Write-Warning ("EB_RESTORE_MAX_WINDOWS is not a number between 1 and 1000 inclusive: '{0}'" -f [int]$ENV:EB_RESTORE_MAX_WINDOWS)
	}
}

# ENV:EB_RESTORE_DELAY_SECONDS is the delay in seconds between opening windows. This can be a fraction.
# Default: 0.5
# Hard limit: 30
$RestoreDelaySeconds = 0.5
if ($null -ne $ENV:EB_RESTORE_DELAY_SECONDS) {
	$tmpRestoreDelaySeconds = [decimal]$ENV:EB_RESTORE_DELAY_SECONDS
	if (($tmpRestoreDelaySeconds -gt 0) -and ($tmpRestoreDelaySeconds -le 30)) {
		$RestoreDelaySeconds = $tmpRestoreDelaySeconds
	} else {
		Write-Warning ("EB_RESTORE_DELAY_SECONDS is not a number between 0 and 1000 inclusive: '{0}'" -f [int]$ENV:EB_RESTORE_DELAY_SECONDS)
	}
}

# ENV:EB_SCRIPT_PATH is the path to the script to install. This script will be copied to this path.
# Default: TacticalRMM directory, "C:\ProgramData\TacticalRMM\Explorer-Bookmarks.ps1"
$ScriptPath = "C:\ProgramData\TacticalRMM\Explorer-Bookmarks.ps1"
if ($null -ne $ENV:EB_SCRIPT_PATH) {
	$ScriptPath = $ENV:EB_SCRIPT_PATH
}

# ENV:EB_LOG_LEVEL is the log level of the script.
# Default: Verbose
$LogLevel = "Verbose"
if ($null -ne $ENV:EB_LOG_LEVEL) {
	$LogLevel = $ENV:EB_LOG_LEVEL
}

# https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1#erroractionpreference
# Continue is preferred over SilentlyContinue to get the output.
switch ( $LogLevel.ToLower()) {
	"error" {
		$ErrorActionPreference = "Continue"
		$WarningPreference = "SilentlyContinue"
		$InformationPreference = "SilentlyContinue"
		$VerbosePreference = "SilentlyContinue"
		$DebugPreference = "SilentlyContinue"
	}
	"warning" {
		$ErrorActionPreference = "Continue"
		$WarningPreference = "Continue"
		$InformationPreference = "SilentlyContinue"
		$VerbosePreference = "SilentlyContinue"
		$DebugPreference = "SilentlyContinue"
	}
	"info" {
		$ErrorActionPreference = "Continue"
		$WarningPreference = "Continue"
		$InformationPreference = "Continue"
		$VerbosePreference = "SilentlyContinue"
		$DebugPreference = "SilentlyContinue"
	}
	"verbose" {
		$ErrorActionPreference = "Continue"
		$WarningPreference = "Continue"
		$InformationPreference = "Continue"
		$VerbosePreference = "Continue"
		$DebugPreference = "SilentlyContinue"
	}
	"debug" {
		$ErrorActionPreference = "Continue"
		$WarningPreference = "Continue"
		$InformationPreference = "Continue"
		$VerbosePreference = "Continue"
		$DebugPreference = "Continue"
	}
	Default {
		# Info
		$ErrorActionPreference = "Continue"
		$WarningPreference = "Continue"
		$InformationPreference = "Continue"
		$VerbosePreference = "SilentlyContinue"
		$DebugPreference = "SilentlyContinue"
	}
}

function New-ExplorerDir() {
	if (!(Test-Path $BookmarksDir)) {
		Write-Verbose ("Creating directory to store bookmark files: '{0}'" -f $BookmarksDir)
		$null = New-Item -ItemType Directory $BookmarksDir
	}
}

function Save-ExplorerBookmarks() {
	Write-Output ("Bookmarking the open explorer paths")
	(New-Object -ComObject 'Shell.Application').Windows() | ForEach-Object {
		$localPath = $_.Document.Folder.Self.Path
		Write-Output $localPath
	} | Set-Content $( Join-Path $BookmarksDir $BookmarkFilename )
}

function Start-Cleanup() {
	Write-Output ("Cleaning up the bookmark files")

	# Remove the current file if it's empty.
	$CurrentFile = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
			Sort-Object -Property CreationTime -Descending |
			Select-Object -First 1
	if ($CurrentFile.Length -eq 0) {
		Write-Output ("Removing empty files.")
		Write-Verbose ("Removing empty file: '{0}'" -f $File.Name)
		$File | Remove-Item
	}

	# Remove the current file if it's a duplicate of the previous bookmark file.
	$LastTwo = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
			Sort-Object -Property CreationTime -Descending |
			Select-Object -First 2 |
			Get-FileHash
	if (($LastTwo.Length -eq 2) -and ($LastTwo[0].Hash -eq $LastTwo[1].Hash)) {
		Write-Output ("Removing the current file since it's a duplicate of the previous file.")
		Write-Verbose ("Removing file: '{0}'" -f $LastTwo[0].Path)
		Remove-Item -Path $LastTwo[0].Path
	}

	# Remove files matching the bookmark file pattern that are more than the maximum number of files.
	$MatchingFiles = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
			Sort-Object -Property CreationTime -Descending
	if ($MatchingFiles.Length -gt $MaxNumFiles) {
		Write-Output ("Removing files more than the maximum number of files configured ({0})" -f $MaxNumFiles)
		ForEach ($File in $MatchingFiles[($MaxNumFiles)..($MatchingFiles.Length)]) {
			Write-Verbose ("Removing: '{0}'" -f $File.FullName)
			Remove-Item -Path $File.FullName
		}
	}
}

function Add-Integration() {
	Write-Output ("Adding the integration into explorer's right-click menu.")
	# Another way of doing this:
	# https://stackoverflow.com/questions/10618977/how-to-add-an-entry-in-the-windows-context-menu-for-files-with-a-specific-extens

	# HKCR is not mounted by default
	# https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

	# KeyPath and KeyName are used to create the they registry key.
	$KeyPath = "HKCR:\SystemFileAssociations\.txt"
	$KeyName = "Shell"
	$Path = "HKCR:\SystemFileAssociations\.txt\Shell"
	if (-not(Test-Path -Path $Path)) {
		$null = New-Item -Path $KeyPath -Name $KeyName
	}

	# KeyPath and KeyName are used to create the they registry key.
	$KeyPath = "HKCR:\SystemFileAssociations\.txt\Shell"
	$KeyName = "Explorer-Bookmarks"
	$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
	$Name = "(Default)"
	$Value = "Restore my Explorer Bookmarks"
	$Type = "String"
	# Need to check for the key and create it before checking for and creating the property.
	if (-not(Test-Path -Path $Path)) {
		# Create the key
		$null = New-Item -Path $KeyPath -Name $KeyName
		if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
			$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
		}
	}

	# KeyPath and KeyName are used to create the they registry key.
	$KeyPath = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
	$KeyName = "Command"
	$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks\Command"
	$Name = "(Default)"
	# https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1
	$Value = ("powershell.exe -ExecutionPolicy Bypass -NonInteractive -NoProfile -NoLogo -InputFormat text -OutputFormat text -WindowStyle Hidden -File `"{0}`" `"%1`"" -f $ScriptPath)
	if ("debug" -eq $LogLevel.ToLower()) {
		$Value = ("powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -InputFormat text -OutputFormat text -File `"{0}`" `"%1`"" -f $ScriptPath)
	}
	$Type = "String"
	# Need to check for the key and create it before checking for and creating the property.
	if (-not(Test-Path -Path $Path)) {
		# Create the key
		$null = New-Item -Path $KeyPath -Name $KeyName
		if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
			$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
		}
	}
}

function Remove-Integration() {
	Write-Output ("Removing the integration from explorer's right-click menu.")
	# HKCR is not mounted by default
	# https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

	$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks\Command"
	if (Test-Path -Path $Path) {
		$null = Remove-Item -Path $Path -Confirm:$false
	}

	$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
	if (Test-Path -Path $Path) {
		$null = Remove-Item -Path $Path -Confirm:$false
	}

	$Path = "HKCR:\SystemFileAssociations\.txt\Shell"
	if (Test-Path -Path $Path) {
		$null = Remove-Item -Path $Path -Confirm:$false
	}
}

function Add-ScheduledTask() {
	if (-not(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
		# Create the scheduled task to run when the user logs in.
		Write-Output ("Creating scheduled task to run when the user logs in.")
		$Arguments = ("-ExecutionPolicy Bypass -NonInteractive -NoProfile -NoLogo -InputFormat text -OutputFormat text -WindowStyle Hidden -File `"{0}`" task" -f $ScriptPath)
		$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument $Arguments
		$Trigger = New-ScheduledTaskTrigger -AtLogon
		$Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Users"
		$null = Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Principal $Principal
	}
}

function Remove-ScheduledTask() {
	if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
		# Remove the scheduled task to run when the user logs in.
		Write-Output ("Removing scheduled task that runs when the user logs in.")
		$null = Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
	}
}

function Install-Script() {
	# Copy the script to the TacticalRMM directory so it can be used outside Tactical.
	if (-not(Test-Path $ScriptPath)) {
		Write-Output ("Installing the script for use outside TacticalRMM.")
		Copy-Item -Path $PSCommandPath -Destination $ScriptPath
	}
}

function Uninstall-Script() {
	# Remove the script from the TacticalRMM directory.
	if (Test-Path $ScriptPath) {
		Write-Output ("Uninstalling the script from the TacticalRMM directory.")
		Remove-Item -Path $ScriptPath
	}
}

function Open-ExplorerBookmarks([string] $File) {
	Write-Output ("Opening file {0}" -f $File)

	if (!(Test-Path $File)) {
		Write-Error ("File does not exist: '{0}'" -f $File)
		return $false
	}

	$Size = (Get-Item -Path $File).Length
	if ($RestoreMaxFileSize -le $Size) {
		Write-Error ("File size is too large. File size limit: '{0}'" -f $RestoreMaxFileSize)
		Write-Error ("File path: '{0}'" -f $File)
		Write-Error ("File size: '{0}'" -f $Size)
		return $false
	}

	$Bookmarks = Get-Content -Path $File
	if ($RestoreMaxWindows -le $Bookmarks.Length) {
		Write-Error ("Number of explorer windows to restore is too large. Restore limit: '{0}'" -f $RestoreMaxWindows)
		Write-Error ("File path: '{0}'" -f $File)
		Write-Error ("Number of Explorer windows to restore: '{0}'" -f $Bookmarks.Length)
		return $false
	}

	$PrevFile = $null
	ForEach ($Bookmark in $Bookmarks) {
		$Bookmark = $Bookmark.Trim()
		if (Test-Path -Path $Bookmark -PathType Container) {
			if ($PrevFile -ne $Bookmark) {
				Write-Output ("Opening Explorer to '{0}'" -f $Bookmark)
				# More command line switches:
				# https://superuser.com/questions/21394/explorer-command-line-switches
				& "$ENV:SystemRoot\explorer.exe" "$Bookmark"
				Start-Sleep -Seconds $RestoreDelaySeconds
				# Don't open the same window multiple times if they are next to each other.
				# The window will be opened if they are not next to each other.
				$PrevFile = $Bookmark
			}
		}
	}
}

function Test-IsAdmin() {
	# Test-Admin will return true if the script is running as an administrator.
	# Mandatory Label\High Mandatory Level is when the script is run from an elevated session.
	# Mandatory Label\System Mandatory Level is when the script is run from SYSTEM.
	$Whoami = & "C:/Windows/System32/whoami.exe" /groups
	if (($Whoami -match "Mandatory Label\\High Mandatory Level") -or
			($Whoami -match "Mandatory Label\\System Mandatory Level")) {
		return $true
	}
	return $false
}

function Test-IsInteractiveShell {
	# https://stackoverflow.com/questions/9738535/powershell-test-for-noninteractive-mode
	# Test each Arg for match of abbreviated '-NonInteractive' command.
	$NonInteractive = [Environment]::GetCommandLineArgs() | Where-Object{ $_ -like '-NonI*' }

	if ([Environment]::UserInteractive -and -not$NonInteractive) {
		# We are in an interactive shell.
		return $true
	}
	return $false
}

function Get-Help() {
	Write-Output ("explorer-bookmarks.ps1")
	Write-Output ("    Bookmark the Windows Explorer paths in a file.")
	Write-Output ("")
	Write-Output ("explorer-bookmarks.ps1 <file>")
	Write-Output ("    Load the bookmarks from a file. This is usually done from a right-click menu.")
	Write-Output ("")
	Write-Output ("explorer-bookmarks.ps1 task")
	Write-Output ("    This command is run from the scheduled task to restore the last bookmarks saved.")
	Write-Output ("")
	Write-Output ("explorer-bookmarks.ps1 <install | uninstall | reinstall>")
	Write-Output ("    Install/uninstall/reinstall the integration: Script, right click menu and scheduled task.")
	Write-Output ("")
	Write-Output ("Environmental variables:")
	Write-Output ("")
	Write-Output ("    EB_BOOKMARKS_DIR - Directory to save the explorer bookmark files.")
	Write-Output ("    EB_MAX_NUM_FILES - Maximum number of bookmark files to save.")
	Write-Output ("    EB_FILENAME_PREFIX - Filename prefix to use for the bookmark files.")
	Write-Output ("    EB_RESTORE_MAX_FILE_SIZE - Maximum file size to restore.")
	Write-Output ("    EB_RESTORE_MAX_WINDOWS - Maximum number of windows to restore.")
	Write-Output ("      Note: This counts the lines in the file, not actual windows.")
	Write-Output ("    EB_RESTORE_DELAY_SECONDS - Delay in seconds between opening each window.")
	Write-Output ("    EB_SCRIPT_PATH - Where to install this script for the integration.")
	Write-Output ("    EB_LOG_LEVEL - Set the log level of the script.")
	Write-Output ("")
}

if ($args.Length -eq 0) {
	if (Test-IsAdmin) {
		Write-Warning ("This script should not be run as an administrator.")
		if (Test-IsInteractiveShell) {
			return
		} else {
			$host.SetShouldExit(1)
			Exit
		}
	}

	# Zero args: Save the windows
	# User configuration
	New-ExplorerDir
	Save-ExplorerBookmarks
	Start-Cleanup
} elseif ($args.Length -eq 1) {
	if (($args[0].ToLower() -match "-*help") -or ($args[0].ToLower() -match "-h")) {
		Get-Help
	} elseif ("task" -eq $args[0].ToLower()) {
		# Scheduled task to open the bookmarks in the last saved file.
		if (Test-IsAdmin) {
			Write-Warning ("The scheduled task should not be run as an administrator.")
			if (Test-IsInteractiveShell) {
				return
			} else {
				$host.SetShouldExit(1)
				Exit
			}
		}
		$CurrentFile = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
				Sort-Object -Property CreationTime -Descending |
				Select-Object -First 1
		if ($null -ne $CurrentFile) {
			# Sleep 5 seconds to allow the desktop and other tasks to load.
			Start-Sleep -Seconds 5
			Open-ExplorerBookmarks($CurrentFile.FullName)
		}

	} elseif ("install" -eq $args[0].ToLower()) {
		if (-not(Test-IsAdmin)) {
			# The install needs to be run as admin
			Write-Warning ("Failed to install the integration. Administrator permission is required.")
			if (Test-IsInteractiveShell) {
				return
			} else {
				$host.SetShouldExit(1)
				Exit
			}
		}
		Install-Script
		Add-Integration
		Add-ScheduledTask

	} elseif ("uninstall" -eq $args[0].ToLower()) {
		if (-not(Test-IsAdmin)) {
			# The uninstall needs to be run as admin
			Write-Warning ("Failed to uninstall the integration. Administrator permission is required.")
			if (Test-IsInteractiveShell) {
				return
			} else {
				$host.SetShouldExit(1)
				Exit
			}
		}
		Uninstall-Script
		Remove-Integration
		Remove-ScheduledTask

	} elseif ("reinstall" -eq $args[0].ToLower()) {
		if (-not(Test-IsAdmin)) {
			# The uninstall needs to be run as admin
			Write-Warning ("Failed to uninstall the integration. Administrator permission is required.")
			if (Test-IsInteractiveShell) {
				return
			} else {
				$host.SetShouldExit(1)
				Exit
			}
		}
		# Uninstall
		Uninstall-Script
		Remove-Integration
		Remove-ScheduledTask
		Write-Output ""

		# Install
		Install-Script
		Add-Integration
		Add-ScheduledTask

	} else {
		# One arg: Open the file from right-click menu
		Open-ExplorerBookmarks($args[0])
		if ("debug" -eq $LogLevel.ToLower()) {
			Start-Sleep -Seconds 5
		}
	}

} else {
	Write-Error ("Wrong number of arguments: '{0}'" -f $args.Length)
	Get-Help
}
