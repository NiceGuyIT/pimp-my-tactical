#!/usr/bin/env nu

# Connect to TRMM. --env allows exporting environment variables.
export def --env "trmm connect" [
	--json-connection: string,		# JSON file that contains the host and API key
]: nothing -> nothing {
	# .trmm.json file format:
	# {
	# 	"host": "api.example.com",
	# 	"api_key": "....API_KEY_HERE...."
	# }
	let t = (open .trmm.json)

	# Save the connection details in an environment variable.
	$env.TRMM = {
		# HTTP headers as an array.
		# "X-API-KEY XXX" is for API keys.
		# "Authorization Token XXX" is for agent authorization.
		headers: [
			"Content-Type" "application/json"
			"X-API-KEY" $t.api_key
		]
		# Used in url join
		# https://www.nushell.sh/commands/docs/url_join.html
		url: {
			scheme: https,
			host: $t.host,
		}
		options: {
			# https://www.nushell.sh/commands/docs/http_get.html
			# timeout period in seconds
			max_time: 5
		}
	}
}

# Helper function for GET requests to TRMM.
export def "trmm get" [
	path: string,				# URL path to get
	query: string = nil,		# URL query string
]: nothing -> any {
	let trmm = $env.TRMM
	http get --max-time $trmm.options.max_time --headers $trmm.headers (
		{...$trmm.url, path: $path, query: $query} | url join
	)
}

# Helper function for PUT requests to TRMM. $in is the body.
export def "trmm put" [
	path: string,				# URL path to get
	query: string = nil,		# URL query string
]: any -> any {
	let input = $in
	let trmm = $env.TRMM
	http put --max-time $trmm.options.max_time --headers $trmm.headers (
		{...$trmm.url, path: $path, query: $query} | url join
	) $input
}

# Helper function for POST requests to TRMM. $in is the body.
export def "trmm post" [
	path: string,				# URL path to get
	query: string = nil,		# URL query string
]: any -> any {
	let input = $in
	let trmm = $env.TRMM
	http post --max-time $trmm.options.max_time --headers $trmm.headers (
		{...$trmm.url, path: $path, query: $query} | url join
	) $input
}

# Get all agents, minus their details.
export def "trmm agents" []: nothing -> any {
	trmm get "/agents/" "details=false"
}

# Get all agents and their custom fields.
export def "trmm agent customfields" []: any -> any {
	# TRMM connection details are input.
	let input = $in
	# Get all custom fields to be used as a lookup.
	let custom_fields = ($input | trmm core customfields)

	# Get the agents and their custom fields. Note: The custom fields are only IDs, not names.
	$input | trmm agents | each {|it|
		# Nushell variables are immutable by default (using "let").
		# https://www.nushell.sh/book/thinking_in_nu.html#variables-are-immutable
		# $agent needs to be mutable so it can be assigned.
		mut agent = ($it | select agent_id hostname site_name client_name custom_fields)
		$agent.custom_fields = ($agent.custom_fields | each {|f|
			let left = ($f | select id field agent value)
			let right = ($custom_fields | where id == $f.field | select id model name | get 0)
			# merge will merge two records or tables
			# https://www.nushell.sh/commands/docs/merge.html
			$left | merge $right | select agent model name value
		})
		$agent
	}
}

# Get all custom fields.
export def "trmm core customfields" []: nothing -> any {
	trmm get "/core/customfields/"
}

# Get the Windows updates for agents
export def "trmm winupdate" []: any -> any {
	where plat == "windows" | each {|it|
		trmm get $"/winupdate/($it.agent_id)/"
	} | flatten
}

# Get the Windows updates that are not installed
export def "trmm winupdate pending" []: any -> any {
	where plat == "windows" | each {|it|
		trmm get $"/winupdate/($it.agent_id)/"
			| where installed == false
	} | flatten
}

# Approve Windows updates
export def "trmm winupdate approve" []: any -> any {
	each {|it|
		{action: approve} | to json | trmm put $"/winupdate/($it.id)/"
	} | flatten
}

# Install Windows updates
export def "trmm winupdate install" []: any -> any {
	where plat == "windows" | each {|it|
		{} | to json | trmm post $"/winupdate/($it.agent_id)/install/"
	} | flatten
}


export def main [
	--json-connection: string = ".trmm.json",		# JSON file that contains the host and API key
	action?: string,								# Action to take: [agent-customfields|agents|core-customfields]
]: [nothing -> any] {
	let json_connection = $json_connection
	let action = $action
	trmm connect --json-connection $json_connection
	$env.TRMM

	
	if $action == 'agent-customfields' {
		trmm agent customfields

	} else if $action == 'agents' {
		trmm agents | transpose

	} else if $action == 'agents-list' {
		trmm agents | reject alert_template monitoring_type description needs_reboot pending_actions_count status overdue_text_alert overdue_email_alert overdue_dashboard_alert last_seen boot_time checks maintenance_mode italic block_policy_inheritance plat goarch operating_system public_ip cpu_model graphics local_ips make_model physical_disks serial_number

	} else if $action == 'core-customfields' {
		trmm core customfields

	} else if $action == 'version' {
		trmm get "/core/version/"

	} else if $action == 'winupdate' {
		trmm agents | trmm winupdate

	} else if $action == 'winupdate-pending' {
		trmm agents | trmm winupdate pending | reject description title support_url

	} else if $action == 'winupdate-approve' {
		# Approve specific Windows updates
		# trmm agents | trmm winupdate pending | where kb == "KB890830" | trmm winupdate approve

		# Approve all Windows updates
		trmm agents | trmm winupdate pending | trmm winupdate approve

	} else if $action == 'winupdate-install' {
		trmm agents | trmm winupdate install

	} else {
		# Self help :)
		^$env.CURRENT_FILE --help
	}

}
