/*** onload ***/
	/* global variables */
		var canvas = document.getElementById("canvas")
		var drawing = false
		var erasing = false
		var color = "black"
		var size = 5
		var paths = {}
		window.paths = paths

/*** tools ***/
	/*** generateRandom ***/
		function generateRandom(set, length) {
			try {
				set = set || "0123456789abcdefghijklmnopqrstuvwxyz"
				length = length || 32
				
				var output = ""
				for (var i = 0; i < length; i++) {
					output += (set[Math.floor(Math.random() * set.length)])
				}

				if ((/[a-zA-Z]/).test(set)) {
					while (!(/[a-zA-Z]/).test(output[0])) {
						output = (set[Math.floor(Math.random() * set.length)]) + output.substring(1)
					}
				}

				return output
			}
			catch (error) {
				logError(error)
				return null
			}
		}

	/* resizeScreen */
		resizeScreen()
		window.addEventListener("resize", resizeScreen)
		function resizeScreen() {
			if (window.innerWidth > 800) {
				canvas.setAttribute("height", window.innerHeight - 50)
				canvas.setAttribute("width", window.innerWidth)
			}
			else {
				canvas.setAttribute("height", window.innerHeight - 110)
				canvas.setAttribute("width", window.innerWidth)
			}
		}

/*** drawing ***/
	/* startDrawing */
		canvas.addEventListener("mousedown", startDrawing)
		canvas.addEventListener("touchstart", startDrawing)
		function startDrawing(event) {
			drawing = generateRandom()
			canvas.setAttribute("drawing", true)

			var x = ((event.clientX !== undefined) ? event.clientX : event.targetTouches[0].clientX)
			var y = ((event.clientY !== undefined) ? event.clientY : event.targetTouches[0].clientY) - 50
			
			if (!erasing) {
				paths[drawing] = {
					color: color,
					size: size,
					coordinates: [[x,y]]
				}
			}
		}

	/* stopDrawing */
		document.addEventListener("mouseup", stopDrawing)
		document.addEventListener("touchend", stopDrawing)
		function stopDrawing(event) {
			drawing = false
			canvas.setAttribute("drawing", false)
		}

	/* moveDrawing */
		canvas.addEventListener("mousemove", moveDrawing)
		canvas.addEventListener("touchmove", moveDrawing)
		function moveDrawing(event) {
			if (drawing) {
				var x = ((event.clientX !== undefined) ? event.clientX : event.targetTouches[0].clientX)
				var y = ((event.clientY !== undefined) ? event.clientY : event.targetTouches[0].clientY) - 50

				if (!erasing && !paths[drawing]) {
					paths[drawing] = {
						color: color,
						size: size,
						coordinates: [[x,y]]
					}
				}
				else if (!erasing) {
					paths[drawing].coordinates.push([x,y])
				}
				else {
					var ids = Object.keys(paths)
					for (var i = ids.length - 1; i >= 0; i--) {
						if (paths[ids[i]].coordinates.findIndex(function (coordinates) {
							return (coordinates[0] < x + 5) && (coordinates[0] > x - 5) && (coordinates[1] < y + 5) && (coordinates[1] > y - 5)
						}) !== -1) {
							delete paths[ids[i]]
						}
					}
				}
			}
		}

/*** drawLoop ***/
	/* drawScreen */
		var drawLoop = setInterval(drawScreen, 10)
		function drawScreen() {
			var context = canvas.getContext("2d")
				context.clearRect(0,0,window.innerWidth,window.innerHeight)

			for (var p in paths) {
				var path = paths[p]
				
				if (path.coordinates && path.coordinates.length) {
					context.beginPath()
					context.strokeStyle = path.color || "black"
					context.lineWidth = path.size || 5
					
					var firstPoint = path.coordinates[0]
					context.moveTo(firstPoint[0], firstPoint[1])

					for (var c in path.coordinates) {
						var coordinates = path.coordinates[c]
						context.lineTo(coordinates[0], coordinates[1])
					}
				}

				context.stroke()
			}
		}

/*** controls ***/
	/* selectColor */
		Array.from(document.querySelectorAll("#colors button")).forEach(function (button) {
			button.addEventListener("click", selectColor)
		})
		function selectColor(event) {
			Array.from(document.querySelectorAll("#colors button")).forEach(function (button) {
				button.className = ""
			})

			var button = event.path[0].id ? event.path[0] : event.path[1]
				button.className = "selected"
			color = button.value

			if (color == "white") {
				erasing = true
				canvas.setAttribute("erasing", true)
			}
			else {
				erasing = false
				canvas.setAttribute("erasing", false)
			}
		}

	/* selectSize */
		Array.from(document.querySelectorAll("#sizes button")).forEach(function (button) {
			button.addEventListener("click", selectSize)
		})
		function selectSize(event) {
			Array.from(document.querySelectorAll("#sizes button")).forEach(function (button) {
				button.className = ""
			})

			var button = event.path[0].id ? event.path[0] : event.path[1]
				button.className = "selected"
			size = parseInt(button.value)
		}

	/* resetPaths */
		document.getElementById("reset").addEventListener("click", resetPaths)
		function resetPaths(event) {
			paths = {}
			
			if (socket) {
				socket.send(JSON.stringify({erase: true}))
			}
		}

/*** socket ***/
	var socket = new WebSocket(location.href.replace("http","ws"))
	socket.onopen = function() {
		var sendLoop = setInterval(sendData, 100)

		function sendData() {
			socket.send(JSON.stringify(paths))
		}

		socket.onmessage = function(message) {
			try {
				var data = JSON.parse(message.data)
				if (data && typeof data == "object") {
					paths = data || {}
				}
			}
			catch (error) {
				console.log(error)
			}
		}

		socket.onerror = function(error) {
			console.log(error)
		}
	}
	
