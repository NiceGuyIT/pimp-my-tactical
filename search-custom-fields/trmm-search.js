javascript:
	async function trmm_search() {
		let custom_field_name = prompt('Custom Field Name');
		/* If you don't want to enter the custom field name every time,
		 * replace the line above with this line.
		 * const custom_field_name = "Custom Field Name";
		 */
		let custom_field_value = prompt('Value to search');
		let custom_field_id = 0;

		await fetch(window._env_.PROD_URL + '/core/customfields/', {
			headers: { Authorization: 'Token ' + localStorage.getItem('access_token') },
		}).then((response) => response.json()).then((data) => {
			for (let field of data) {
				if (field.name.toUpperCase() === custom_field_name.toUpperCase()) {
					custom_field_id = field.id;
					console.log('Field name:' + field.name);
					console.log('Field ID:' + custom_field_id);
					return;
				}
			}
		});

		let agents = [];
		let agent_list = [];
		await fetch(window._env_.PROD_URL + '/agents/?detail=false', {
			headers: { Authorization: 'Token ' + localStorage.getItem('access_token') },
		}).then((response) => response.json()).then((data) => {
			for (let agent of data) {
				console.log('Agent:', agent);
				agents.push(agent.agent_id);
				agent_list[agent.agent_id] = {
					client: agent.client,
					site: agent.site,
					hostname: agent.hostname
				};
			}
		});
		console.log('Agents:', agents);

		let results = [];
		for (let agent_id of agents) {
			console.log('Agent ID:', agent_id);
			await fetch(window._env_.PROD_URL + '/agents/' + agent_id, {
				headers: { Authorization: 'Token ' + localStorage.getItem('access_token') },
			}).then((response) => response.json()).then((data) => {
				for (let field of data.custom_fields) {
					if (field.field === custom_field_id) {
						if (typeof (field.value) == 'object') {
							console.log('Field value is an object: '+field.value);
							if (Array.isArray(field.value)) {
								console.log('Custom field is array');
								let found = field.value.filter(function (pattern) {
									return new RegExp(pattern, 'i').test(custom_field_value);
								});
								if (found.length > 0) {
									console.log('Found:' + found);
									console.log('Agent ID:' + agent_id);
									results.push(agent_id);
								}
								continue;
							}
							console.log('Custom field is an object');
							if (Object.values(field.value).includes(custom_field_value)) {
								results.push(agent_id);
							}
						} else {
							console.log('Field value is not an object: '+field.value);
							if (field.value.match(new RegExp(custom_field_value, 'i'))) {
								results.push(agent_id);
							}
						}
					}
				}
			});
		}
		console.log('Results:', results);

		if (results.length === 0) {
			window.alert(`Agent not found.
custom_field_name: ${custom_field_name}
custom_field_id: ${custom_field_id}`);
		} else if (results.length === 1) {
			window.open(window.location + 'agents/' + results[0]);
		} else {
			let msg = 'Multiple agents found:\n';
			for (let result of results) {
				msg += `${agent_list[result].client} - ${agent_list[result].site} - ${agent_list[result].hostname}:\n`;
				msg += `${window.location}agents/${result}\n\n`;
			}
			window.alert(msg);
		}
	}
trmm_search().then();
