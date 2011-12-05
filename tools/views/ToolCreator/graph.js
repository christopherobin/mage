function Graph (connectorTypes) {
	this.output = {};
	this.input = {};

	var dropOptions = {
		tolerance:'touch',
		hoverClass:'dropHover',
		activeClass:'dragActive'
	};

	for (var connectorType in connectorTypes)
	{
		var info = connectorTypes[connectorType];
		var color = 'grey';
		if(info.connector && info.connector.color)
			color = info.connector.color;

		this.output[connectorType] = {
//			endpoint: new jsPlumb.Endpoints.Rectangle(),
			endpoint: ['Rectangle', { width: 20, height: 10 }],
			paintStyle: {
				fillStyle: (info.endpoint && info.endpoint.color) ? info.connector.color : 'grey' 
			},
/*			style: { 
				width: 20,
				height: 10,
				fillStyle: (info.endpoint && info.endpoint.color) ? info.connector.color : 'grey' 
			},*/
			isSource: true,
			isTarget: true,
			scope: connectorType,
			connectorStyle : {
				gradient: {stops:[[0, color], [0.5, color], [1, color]]},
				lineWidth: (info.connector && info.connector.width) ? info.connector.width : 5,
				strokeStyle: color
			},
			connector: ['Straight'],
			dropOptions : dropOptions,
		};

		this.input[connectorType] = {
/*			endpoint: new jsPlumb.Endpoints.Rectangle(),
			style: { 
				width: 20,
				height: 10,
				fillStyle: (info.endpoint && info.endpoint.color) ? info.connector.color : 'grey' 
			},*/
			endpoint: ['Rectangle', { width: 20, height: 10 }],
			paintStyle: {
				fillStyle: (info.endpoint && info.endpoint.color) ? info.connector.color : 'grey' 
			},
			isSource: true,
			isTarget: true,
			scope: connectorType,
			connectorStyle : {
				gradient: {stops:[[0, color], [0.5, color], [1, color]]},
				lineWidth: (info.connector && info.connector.width) ? info.connector.width : 5,
				strokeStyle: color
			},
			connector: ['Straight'],
			dropOptions : dropOptions,
		};
	}
}
