/*** modules ***/
	var http = require("http")
	var fs   = require("fs")
	var qs   = require("querystring")
	var ws   = require("websocket").server
	var main = require("./main/logic")

/*** server ***/
	var port = main.getEnvironment("port")
	var server = http.createServer(handleRequest)
		server.listen(port, function (error) {
			if (error) {
				main.logError(error)
			}
			else {
				main.logStatus("listening on port " + port)
			}
		})

/*** socket ***/
	var canvases = {}
	var socket = new ws({
		httpServer: server,
		autoAcceptConnections: false
	})
		socket.on("request", handleSocket)

/*** cleanCanvases ***/
	var cleanLoop = setInterval(cleanCanvases, 1000 * 60 * 5)
	function cleanCanvases() {
		try {
			var keys = Object.keys(canvases)
			for (var i = keys.length - 1; i >= 0; i--) {
				if (!Object.keys(canvases[keys[i]].clients).length) {
					delete canvases[keys[i]]
				}
			}
		}
		catch (error) {
			main.logError("unable to clean canvases")
		}
	}

/*** handleRequest ***/
	function handleRequest(request, response) {
		// collect data
			var data = ""
			request.on("data", function (chunk) {
				data += chunk
			})
			request.on("end", parseRequest)

		/* parseRequest */
			function parseRequest(data) {
				try {
					// get request info
						request.get    = qs.parse(request.url.split("?")[1]) || {}
						request.path   = request.url.split("?")[0].split("/") || []
						request.url    = request.url.split("?")[0] || "/"
						request.post   = data ? JSON.parse(data) : {}
						request.cookie = request.headers.cookie ? qs.parse(request.headers.cookie.replace(/; /g, "&")) : {}
						request.ip     = request.headers["x-forwarded-for"] || request.connection.remoteAddress || request.socket.remoteAddress || request.connection.socket.remoteAddress

					// log it
						if (request.url !== "/favicon.ico") {
							main.logStatus((request.cookie.session || "new") + " @ " + request.ip + "\n[" + request.method + "] " + request.path.join("/") + "\n" + JSON.stringify(request.method == "GET" ? request.get : request.post))
						}

					// where next ?
						if ((/[.](ico|png|jpg|jpeg|gif|svg|pdf|txt|css|js)$/).test(request.url)) { // serve asset
							routeRequest()
						}
						else { // get session and serve html
							main.determineSession(request, routeRequest)
						}
				}
				catch (error) {
					_403("unable to parse request")
				}
			}

		/* routeRequest */
			function routeRequest() {
				try {
					// assets
						if (!request.session) {
							switch (true) {
								// logo
									case (/\/favicon[.]ico$/).test(request.url):
									case (/\/icon[.]png$/).test(request.url):
									case (/\/logo[.]png$/).test(request.url):
									case (/\/apple\-touch\-icon[.]png$/).test(request.url):
									case (/\/apple\-touch\-icon\-precomposed[.]png$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "image/png"})
											fs.readFile("./main/logo.png", function (error, file) {
												if (error) {
													_404(error)
												}
												else {
													response.end(file, "binary")
												}
											})
										}
										catch (error) {_404(error)}
									break

								// banner
									case (/\/banner[.]png$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "image/png"})
											//response.end(fs.readFileSync("./main/banner.png"), "binary")
											fs.readFile("./main/banner.png", function (error, file) {
												if (error) {
													_404(error)
												}
												else {
													response.end(file, "binary")
												}
											})
										}
										catch (error) {_404(error)}
									break

								// stylesheet
									case (/\/stylesheet[.]css$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "text/css"})
											fs.readFile("./" + request.path[1] + "/stylesheet.css", "utf8", function (error, file) {
												if (error) {
													_404(error)
												}
												else {
													response.end(file)
												}
											})
										}
										catch (error) {_404(error)}
									break

								// script
									case (/\/script[.]js$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "text/javascript"})
											fs.readFile("./" + request.path[1] + "/script.js", "utf8", function (error, file) {
												if (error) {
													_404(error)
												}
												else {
													response.end("window.onload = function() { \n" + file + "\n}")
												}
											})
										}
										catch (error) {_404(error)}
									break

								// others
									default:
										_404()
									break
							}
						}
						
					// get
						else if (request.method == "GET") {
							response.writeHead(200, {
								"Set-Cookie": String( "session=" + request.session.id + "; expires=" + (new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7)).toUTCString()) + "; path=/; domain=" + main.getEnvironment("domain") ),
								"Content-Type": "text/html; charset=utf-8"
							})

							switch (true) {
								// home
									case (/^\/$/).test(request.url):
										try {
											var id = main.generateRandom(null, 8).toLowerCase()
											_302("../../draw/" + main.generateRandom(null, 8).toLowerCase())
										}
										catch (error) {_404(error)}
									break

								// about
									case (/^\/about\/?$/).test(request.url):
										try {
											request.canvases = canvases
											main.renderHTML(request, "./about/index.html", function (html) {
												response.end(html)
											})
										}
										catch (error) {_404(error)}
									break

								// draw
									case (/^\/draw\/[a-zA-Z0-9]{8}$/).test(request.url):
										try {
											main.renderHTML(request, "./draw/index.html", function (html) {
												response.end(html)
											})
										}
										catch (error) {_404(error)}
									break

								// others
									default:
										_404()
									break
							}
						}

					// others
						else {
							_403()
						}
				}
				catch (error) {
					_403("unable to route request")
				}
			}

		/* _302 */
			function _302(data) {
				main.logStatus("redirecting to " + (data || "/"))
				var id = request.session ? request.session.id : 0
				response.writeHead(302, {
					"Set-Cookie": String( "session=" + id + "; expires=" + (new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7)).toUTCString()) + "; path=/; domain=" + main.getEnvironment("domain") ),
					Location: data || "../../../../"
				})
				response.end()
			}

		/* _403 */
			function _403(data) {
				main.logError(data)
				var id = request.session ? request.session.id : 0
				response.writeHead(403, {
					"Set-Cookie": String( "session=" + id + "; expires=" + (new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7)).toUTCString()) + "; path=/; domain=" + main.getEnvironment("domain") ),
					"Content-Type": "text/json"
				})
				response.end( JSON.stringify({success: false, error: data}) )
			}

		/* _404 */
			function _404(data) {
				main.logError(data)
				var id = request.session ? request.session.id : 0
				response.writeHead(404, {
					"Set-Cookie": String( "session=" + id + "; expires=" + (new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7)).toUTCString()) + "; path=/; domain=" + main.getEnvironment("domain") ),
					"Content-Type": "text/html; charset=utf-8"
				})
				main.renderHTML(request, "./main/_404.html", function (html) {
					response.end(html)
				})
			}
	}

/*** handleSocket ***/
	function handleSocket(request) {
		// collect data
			if ((request.origin.replace("https://","").replace("http://","") !== main.getEnvironment("domain")) && (request.origin !== "http://" + main.getEnvironment("domain") + ":" + main.getEnvironment("port"))) {
				request.reject()
				main.logStatus("[REJECTED]: " + request.origin + " @ " + (request.socket._peername.address || "?"))
			}
			else {
				request.connection = request.accept(null, request.origin)
				parseSocket()
			}

		/* parseSocket */
			function parseSocket() {
				try {
					// get request info
						request.url     = (request.httpRequest.headers.host || "") + (request.httpRequest.url || "")
						request.path    = request.httpRequest.url.split("?")[0].split("/") || []
						request.cookie  = request.httpRequest.headers.cookie ? qs.parse(request.httpRequest.headers.cookie.replace(/; /g, "&")) : {}
						request.headers = {}
						request.headers["user-agent"] = request.httpRequest.headers['user-agent']
						request.headers["accept-language"] = request.httpRequest.headers['accept-language']
						request.ip      = request.connection.remoteAddress || request.socket._peername.address

					// log it
						main.logStatus((request.cookie.session || "new") + " @ " + request.ip + "\n[WEBSOCKET] " + request.path.join("/"))

					// get session and wait for messages
						main.determineSession(request, routeSocket)
				}
				catch (error) {
					_400("unable to parse socket")
				}
			}

		/* routeSocket */
			function routeSocket() {
				// on connect
					var canvas = canvases[request.path[2]] || false
					
					if (!canvas) {
						var canvas = {
							id:      request.path[2],
							created: new Date().getTime(),
							updated: new Date().getTime(),
							clients: {},
							paths:   {}
						}
						canvas.clients[request.session.id] = request.connection
						canvases[canvas.id] = canvas
					}
					else {
						canvas.clients[request.session.id] = request.connection
					}

				// on close
					request.connection.on("close", function (reasonCode, description) {
						main.logStatus("[CLOSED]: " + request.path.join("/") + " @ " + (request.ip || "?"))
						delete canvas.clients[request.session.id]

						if (Object.keys(canvas.clients).length == 0) {
							delete canvases[canvas.id]
						}
					})
				
				// on message
					request.connection.on("message", function (message) {
						try {
							var data = JSON.parse(message.utf8Data) || null
							if (data && data.erase) { // clearing
								canvas.paths = {}
							}
							else if (data) {
								var keys = Object.keys(data)
								for (var k in keys) {
									if (data[keys[k]].erase) { // erasing
										delete canvas.paths[keys[k]]
									}
									else if (canvas.paths[keys[k]] == undefined || canvas.paths[keys[k]].coordinates.length < data[keys[k]].coordinates.length) { // drawing
										canvas.paths[keys[k]] = data[keys[k]]
									}
								}
								canvas.updated = new Date().getTime()
							}

							for (var i = Object.keys(canvas.clients).length - 1; i >= 0; i--) {
								var connection = canvas.clients[Object.keys(canvas.clients)[i]]
									connection.sendUTF(JSON.stringify(canvas.paths))
							}
						}
						catch (error) {
							main.logError(error)
						}
					})
			}

		/* _400 */
			function _400(data) {
				main.logError(data)
				request.connection.sendUTF(data || "unknown websocket error")
			}
	}
