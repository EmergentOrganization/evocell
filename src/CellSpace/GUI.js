define([
	"CellSpace/Ship", "GLOBALS", "jquery", "Utils", "EvoCell", "story/StoryTeller", "underscore",
	"knockback", "knockout", "data/FileStore",
	"CellSpace/State", "CellSpace/Setup", "CellSpace/Utils"],
function(Ship, GLOBALS, $, utils, EC, storyTeller,_ , kb, ko, fileStore, gameState, csSetup, csUtils) {
	"use strict";

	var oldPauseState = false;
	var buttonWasDown = 0;
    var bounceEsc = 0;

	var getActiveDishName = function() {
		return gameState.drawModel.attributes.selectedLayers[0] || "enemy";
	}

	var getActiveDish = function() {
		return gameState.dishes[getActiveDishName()] || gameState.dishes.enemy;
	};

	var updateSelection = function(evt) {
		if (evt.button === 2) buttonWasDown = true;

		if (gameState.selection.active || evt.button === 2)
		{
			var coords = gameState.canvas.relMouseCoords(evt);
			var x = coords.x;
			var y = gameState.screenH - coords.y;
			var clickedNDC = utils.getNDCFromMouseEvent(gameState.canvas, evt, gameState.screenW, gameState.screenH);	
			var clickedPoint = utils.intersectClick(clickedNDC, gameState.viewMatrix, gameState.cameraAngle/2);
			
			var cx = Math.round(GLOBALS.gameW*(clickedPoint.x+1)/2);
			var cy = Math.round(GLOBALS.gameH*(clickedPoint.y+1)/2);

			// start new
			if (!gameState.selection.active) 
			{
				oldPauseState = gameState.pause;
				gameState.pause = true;
				gameState.selection.downPos = [cx, cy];
				gameState.selection.active = 2;
			}

			var dx = gameState.selection.lastPos[0] - cx;
			var dy = gameState.selection.lastPos[1] - cy;

			if (evt.ctrlKey) 
			{
				gameState.selection.downPos[0] += dx;
				gameState.selection.downPos[1] += dy;
			}
			if (evt.shiftKey) 
			{
				gameState.selection.downPos[0] -= dx;
				gameState.selection.downPos[1] -= dy;
			}

			var ox = gameState.selection.downPos[0];
			var oy = gameState.selection.downPos[1];
			
			var minx = Math.min(cx, ox);
			var miny = Math.min(cy, oy);

			gameState.selection.lastPos = [cx, cy];
			gameState.selection.pos = [minx, miny];
			gameState.selection.size = [Math.abs(cx-ox), Math.abs(cy-oy)];
		}
		if (evt.button != 2) { // not pressed
			if (gameState.selection.active && buttonWasDown) {
				gameState.selection.active--;

				if (!gameState.selection.active)
				{
					var dish = getActiveDish();

					gameState.reactor.mixDish(gameState.shaders.copy, gameState.dishes.buffer, {
						destinationPos: [0, 0], 
						destinationSize: gameState.selection.size,
						texSource: dish, 
						sourcePos: gameState.selection.pos, 
						sourceRes: [GLOBALS.gameW, GLOBALS.gameH],
					}); 

					gameState.pause = oldPauseState;
				}
			}
			buttonWasDown = false;
		}
	};

	var setupDevGUI = function(){
	    // sets up advanced controls not normally available to players
	    var gui = gameState.devGUI;

		var appFolder = gui.addFolder('App');
		appFolder.add(gameState, 'zoom', 0.05, 2).step(0.01);

		// ugly hack to make ro a two decimal nr in datgui
		var oldRot = gameState.rot;
		gameState.rot = 0.01;
		// hack continues below
		var ctrl = appFolder.add(gameState, 'rot', 0, Math.PI*2).step(0.01);
		//ctrl.__precision = 3; // does not help
		//ctrl.__impliedStep = 0.001; // does not help
		// hack!
		gameState.rot = oldRot;
		csUtils.refreshGUI(["rot"]);
		// end of ugly hack

		appFolder.add(gameState, 'randomDensity', 0, 1);

		appFolder.add(gameState, "enemySpeed", 0, 12);
        appFolder.add(GLOBALS, 'shotSpeed', 0, 12);

		appFolder.add(gameState, "weaponExplosionParam");

		appFolder.add(gameState, 'enableScrolling', {yes: 1, no: 0});

		appFolder.add(GLOBALS, 'gameW').onFinishChange(csUtils.onGameSizeChanged);
		appFolder.add(GLOBALS, 'gameH').onFinishChange(csUtils.onGameSizeChanged);

		var shipFolder = gui.addFolder('Ship');
        gameState.ship.addDebugGUI(shipFolder);

		var folder = gui.addFolder('Core');
		var screenWCtrl = folder.add(gameState, 'screenW');
		var screenHCtrl = folder.add(gameState, 'screenH');
		folder.add(gameState, 'renderer', {Fast: "Fast", Simple:"Simple", TV:"TV", Cell:"Cell"});

		folder = gui.addFolder('Debug');
		folder.add(gameState, 'perfStartJSTime');
		folder.add(gameState, 'perfRequireTime');
		folder.add(gameState, 'perfFinishedJSTime');
		folder.add(gameState, "showBuffer");
		folder.add(gameState, "showRule");
        folder.add(gameState, "parallaxX").listen();
        folder.add(gameState, "parallaxY").listen();

        var onResized = function(value) {
			gameState.reactor.setRenderSize(gameState.screenW, gameState.screenH);
		};
		screenWCtrl.onFinishChange(onResized);
		screenHCtrl.onFinishChange(onResized);
	}

	var setupGui = function() {
		window.addEventListener("resize", function () {
			gameState.screenW = window.innerWidth;
			gameState.screenH = window.innerHeight;
			csUtils.onScreenSizeChanged();
		}, false);

		document.getElementById("assignLayerRule").addEventListener('click', function(evt) {
			var ruleName = gameState.drawModel.get("selectedRules")[0];
			var layerName = gameState.drawModel.get("selectedLayers")[0];
			var dish = gameState.dishes[layerName];

			fileStore.loadRule(ruleName, function(loadedRule) {
				gameState.rules[layerName] = gameState.reactor.compileRule(loadedRule.ruleData, dish);
			});

		}, false);

		document.getElementById("loadPattern").addEventListener('click', function(evt) {
			var ruleName = gameState.drawModel.get("selectedRules")[0];

			fileStore.loadRule(ruleName, function(loadedRule) {
				if (loadedRule.ruleData.containsPattern) {
					var rule = gameState.reactor.compileRule(loadedRule.ruleData);

					gameState.selection.size = [loadedRule.ruleData.patternWidth, loadedRule.ruleData.patternHeight];

					gameState.reactor.mixDish(gameState.shaders.copy, gameState.dishes.buffer, {
						destinationPos:[0, 0], 
						destinationSize: gameState.selection.size,
						texSource: rule.getPatternTexture(), 
						sourcePos: [0, 0], 
						sourceRes: gameState.selection.size,
					}); 
				}
			});
		}, false);

		document.getElementById("savePattern").addEventListener('click', function(evt) {
			var ruleName = prompt('Pattern can haz name?','pattern_');

			if (ruleName) 
			{
				// capture pixel from buffer
				var dish = gameState.dishes.buffer;
				var w = gameState.selection.size[0];
				var h = gameState.selection.size[1];
				var patternDataRGBA = new Uint8Array(w*h*4);
				var gl = gameState.reactor.gl;

				gl.bindFramebuffer(gl.FRAMEBUFFER, dish.getCurrentFramebuffer());
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dish.getCurrentTexture(), 0);
				gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, patternDataRGBA);

				var patternData = new Uint8Array(w*h);
				for (var i = w*h-1; i >= 0; i--) {
					patternData[i] = patternDataRGBA[4*i +3];
				}

				// construct ECFile
				var ruleData = {
					containsPattern: true,
					patternWidth: gameState.selection.size[0],
					patternHeight: gameState.selection.size[1], 
					patternData: patternData,
				};

				fileStore.storeRule(ruleName, ruleData,  function() {
					csUtils.refreshAvailableRules();
				});
			}
		}, false);

		$('#importRule').change(function(evt) {
			var files = evt.target.files; // FileList object

			_.each(files, function(file) {
				var reader = new FileReader();
				reader.onload = function(evt) {	
					var arrayBufferData = evt.target.result;
					var evoCellData = new EC.ECFile(arrayBufferData);
					//alert(evoCellData);
					//alert(file.name);
					fileStore.storeRule(file.name, evoCellData, function() {
						csUtils.refreshAvailableRules();
					});
				};
				reader.readAsArrayBuffer(file); // start async operation
			});
		});

		document.getElementById("deleteRule").addEventListener('click', function(evt) {
			var selectedRules = gameState.drawModel.get("selectedRules");

			var refresh = _.after(selectedRules.length, function() {
				//alert("refresh");
				csUtils.refreshAvailableRules();
			});

			_.each(selectedRules, function(ruleName) {
				fileStore.loadRule(ruleName, function(rule) {
					if (!rule ) {
						alert("cant delete nonextent: " + ruleName);
					}
					fileStore.deleteRule(ruleName, function() {
						//alert("deleted:" + ruleName);
						refresh();
					});
				});
			});
		}, false);

		document.getElementById("stepLink").addEventListener('click', function(evt) {
			csUtils.gameStep();
		}, false);

		document.getElementById("playPause").addEventListener('click', function(evt) {
			csUtils.gamePlayPause();
		}, false);

		document.getElementById("showIntroLink").addEventListener('click', function(evt) {
			storyTeller.RunIntro();
		}, false);

		document.getElementById("initializeDB").addEventListener("click", function(evt) {
			csSetup.initDB();
		}, false);

        if( GLOBALS.devMode ){
            setupDevGUI();
        }

		var nonPersistables = [
			"canvas","reactor","gl","gui","keyboard","shaders","dishes","rules","colors","shots",
			"sndInit","snd","sndBomb","sndHit","sndHit2","drawModel","mainLoop"
		];

		document.getElementById("saveGameState").addEventListener("click", function(evt) {
			var clonedState = {};
			_.each(gameState, function(value, key) { 
				if (!_.contains(nonPersistables, key)) {
					clonedState[key] = value;
				}
			});
			fileStore.addObject("gameStates", {id: "test23", state: clonedState });
		}, false);

		document.getElementById("loadGameState").addEventListener("click", function(evt) {
			fileStore.getObject("gameStates", "test23", function(loadedState) {
				_.each(loadedState.state, function(value, key) {
					gameState[key] = value;
				});
			});
		}, false);

		var view_model = kb.viewModel(gameState.drawModel);
		//view_model.full_name = ko.computed((->return "#{@first_name()} #{@last_name()}"), view_model)
		ko.applyBindings(view_model, document.getElementById("drawTool"));


		var getActiveWindowId = function() {
			var window = null;
			var windows = document.getElementsByClassName("activeWindow");
			if (windows.length > 0) return windows[0].id;
			return null;	
		};

		String.prototype.replaceAll = function(search, replace) {
			if (replace === undefined) {
			        return this.toString();
			 }
			return this.split(search).join(replace);
		}

		var toggleClass = function(element, className) {
			var classes = element.getAttribute("class");
			if (classes.indexOf(className) >= 0) {
				classes = classes.replace(className, "")
			}
			else {
				classes = classes + " " + className;
			}
			element.setAttribute('class', classes);
		}

		_.each(document.getElementsByClassName("toolMenuHeader"), function(toolWindow) {
			toolWindow.addEventListener("click", function(evt) {

                var element = toolWindow.parentElement;
                //var element = toolWindow;

                // deactivate old active Windows except self
				_.each(document.getElementsByClassName("activeWindow"), function(activeW) {
					if (activeW !== element) {
						toggleClass(activeW, 'activeWindow');
					}
				});

               toggleClass(element, 'activeWindow');
            }, false);
		});


		// TODO: implement palette
		// $('#colorpicker1').farbtastic('#color1');
	
		
		gameState.fpsMonotor = new utils.FPSMonitor("fpsMonitor");

		function handleCanvasMouseDown(evt) {
			var coords = gameState.canvas.relMouseCoords(evt);
			var x = coords.x;
			var y = gameState.screenH - coords.y;

			var activeTool = getActiveWindowId();

			var clickedNDC = utils.getNDCFromMouseEvent(gameState.canvas, evt, gameState.screenW, gameState.screenH);	
			var clickedPoint = utils.intersectClick(clickedNDC, gameState.viewMatrix, gameState.cameraAngle/2);

			var dish = getActiveDish();

			if (activeTool === "ToolWindow" && evt.button === 0) {
					var state = 0;
					var firstSel = gameState.drawModel.attributes.selectedStates[0];
					if (firstSel) state = firstSel;

					if (dish) {
						if (gameState.drawModel.attributes.selectedDrawShape == "circle") {
							gameState.reactor.mixDish(gameState.shaders.drawCircle, dish, {
								center: [GLOBALS.gameW*(clickedPoint.x+1)/2, GLOBALS.gameH*(clickedPoint.y+1)/2],
								radius: gameState.drawModel.attributes.drawSizeX/2, state: state/255
							});
						}
						else {
							gameState.reactor.mixDish(gameState.shaders.drawRect, dish, {
								rectPos: [GLOBALS.gameW*(clickedPoint.x+1)/2, GLOBALS.gameH*(clickedPoint.y+1)/2],
								rectSize: [gameState.drawModel.attributes.drawSizeX, gameState.drawModel.attributes.drawSizeY], 
								state: state/255
							});
						}
					}
				
			}
			else if (evt.button === 0) { // || mouseMode == "shoot") {
				gameState.ship.lClick(clickedPoint);
			}	
			// copy
			else if (evt.button === 2) {
				/*
				gameState.reactor.mixDish(gameState.shaders.copy, gameState.dishes.buffer, {
					destinationPos: [0, 0], 
					destinationSize: [gameState.dishes.buffer.width, gameState.dishes.buffer.height],
					texSource: dish, 
					sourcePos: [GLOBALS.gameW*(clickedPoint.x+1)/2-gameState.dishes.buffer.width/2,
						GLOBALS.gameH*(clickedPoint.y+1)/2-gameState.dishes.buffer.height/2],
					sourceRes: [GLOBALS.gameW, GLOBALS.gameH],
				}); 
*/

				updateSelection(evt);
			}		
			// paste
			else if (evt.button === 1) {
				var tx = GLOBALS.gameW*(clickedPoint.x+1)/2-gameState.selection.size[0]/2;
				var ty = GLOBALS.gameH*(clickedPoint.y+1)/2-gameState.selection.size[1]/2;

				gameState.reactor.mixDish(gameState.shaders.copy, dish, {
					destinationPos:[tx, ty], 
					destinationSize: gameState.selection.size,
					texSource: gameState.dishes.buffer, 
					sourcePos: [0, 0], 
					sourceRes: [gameState.dishes.buffer.width, gameState.dishes.buffer.height],
				}); 
				// gameState.reactor.mixDish(gameState.shaders.copy, dish, {
				// 	destinationPos:[GLOBALS.gameW*(clickedPoint.x+1)/2-gameState.dishes.buffer.width/2,
				// 		GLOBALS.gameH*(clickedPoint.y+1)/2-gameState.dishes.buffer.height/2],
				// 	destinationSize: [gameState.dishes.buffer.width, gameState.dishes.buffer.height],
				// 	texSource: gameState.dishes.buffer, 
				// 	sourcePos: [0, 0], 
				// 	sourceRes: [gameState.dishes.buffer.width, gameState.dishes.buffer.height],
				// }); 
			}		
			
			evt.preventDefault();
			evt.stopPropagation();
		}
		gameState.canvas.addEventListener('mousedown', handleCanvasMouseDown, false);

		var blockContextMenu = function (evt) {
			evt.preventDefault();
		};
		gameState.canvas.addEventListener('contextmenu', blockContextMenu, false);

		var handleCanvasMouseMove = function(evt)
		{
			updateSelection(evt);
			gameState.lastMouseNDC = utils.getNDCFromMouseEvent(gameState.canvas, evt, gameState.screenW, gameState.screenH);
		};
		gameState.canvas.addEventListener('mousemove', handleCanvasMouseMove, false);


		var handleMouseWheel = function(e) {
			var maxZoom = 25;
			var delta = Math.max(-maxZoom, Math.min(maxZoom, (e.wheelDelta || -e.detail)));
            delta *=4;
			//delta /= 1000;
			csUtils.zoom(delta);
			return false;
		};

		gameState.canvas.addEventListener("mousewheel", handleMouseWheel, false);
		gameState.canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false);


        // TOUCH events

        function ongoingTouchIndexById(idToFind) {
            for (var i=0; i < ongoingTouches.length; i++) {
                var id = ongoingTouches[i].identifier;

                if (id == idToFind) {
                    return i;
                }
            }
            return -1;    // not found
        }

        function log(msg) {
            /*
            var p = document.getElementById('log');

            if (p)
            {
                var s = msg + "<br>" + p.innerHTML;
                p.innerHTML = s.substring(0, 200);
            }
            */
        }

        function copyTouch(touch) {
            return { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY };
        }


        var ongoingTouches = new Array();

        function touch2GameCoordinates(touch, el) {
            var xx =  GLOBALS.gameW*(touch.pageX)/el.width;
            var yy = GLOBALS.gameH - (GLOBALS.gameH*(touch.pageY)/el.height);

            return [xx, yy];
        }

        function workaroundFn2(fn, args) {
            fn(args[0], args[1]);
        }

        var handleStart = function(evt) {
            evt.preventDefault();
            log("touchstart.");
            var el = document.getElementsByTagName("canvas")[0];
            //var ctx = el.getContext("2d");
            var touches = evt.changedTouches;

            for (var i=0; i < touches.length; i++) {
                log("touchstart:" +i+ "x" + touches[i].pageX + "y" + touches[i].pageY + "w"+ el.width);
                ongoingTouches.push(copyTouch(touches[i]));
                //var color = colorForTouch(touches[i]);
                //ctx.beginPath();
                //ctx.arc(touches[i].pageX, touches[i].pageY, 4, 0,2*Math.PI, false);  // a circle at the start
                //ctx.fillStyle = color;
                //ctx.fill();


                //var xx =  GLOBALS.gameW*(touches[i].pageX)/el.width;
                //var yy = GLOBALS.gameH - (GLOBALS.gameH*(touches[i].pageY)/el.height);

                workaroundFn2(gameState.ship.fireShotAt, touch2GameCoordinates(touches[i], el));
                log("touchstart:"+i+".");
            }
        };

        var handleMove = function(evt) {
            evt.preventDefault();
            var el = document.getElementsByTagName("canvas")[0];
            //var ctx = el.getContext("2d");
            var touches = evt.changedTouches;

            for (var i=0; i < touches.length; i++) {
                //var color = colorForTouch(touches[i]);
                var idx = ongoingTouchIndexById(touches[i].identifier);

                if(idx >= 0) {
                    log("continuing touch "+idx);
                    //ctx.beginPath();
                    log("ctx.moveTo("+ongoingTouches[idx].pageX+", "+ongoingTouches[idx].pageY+");");
                    //ctx.moveTo(ongoingTouches[idx].pageX, ongoingTouches[idx].pageY);
                    log("ctx.lineTo("+touches[i].pageX+", "+touches[i].pageY+");");
                    //ctx.lineTo(touches[i].pageX, touches[i].pageY);
                    //ctx.lineWidth = 4;
                    //ctx.strokeStyle = color;
                    //ctx.stroke();

                    workaroundFn2(gameState.ship.fireShotAt, touch2GameCoordinates(touches[i], el));

                    ongoingTouches.splice(idx, 1, copyTouch(touches[i]));  // swap in the new touch record
                    log(".");
                } else {
                    log("can't figure out which touch to continue");
                }
            }
        };

         var handleEnd = function(evt) {
            evt.preventDefault();
            log("touchend/touchleave.");
            var el = document.getElementsByTagName("canvas")[0];
            //var ctx = el.getContext("2d");
            var touches = evt.changedTouches;

            for (var i=0; i < touches.length; i++) {
                //var color = colorForTouch(touches[i]);
                var idx = ongoingTouchIndexById(touches[i].identifier);

                if(idx >= 0) {
                    //ctx.lineWidth = 4;
                    //ctx.fillStyle = color;
                    //ctx.beginPath();
                    //ctx.moveTo(ongoingTouches[idx].pageX, ongoingTouches[idx].pageY);
                    //ctx.lineTo(touches[i].pageX, touches[i].pageY);
                   // ctx.fillRect(touches[i].pageX-4, touches[i].pageY-4, 8, 8);  // and a square at the end


                    ongoingTouches.splice(idx, 1);  // remove it; we're done
                } else {
                    log("can't figure out which touch to end");
                }
            }
        };

        var handleCancel = function (evt) {
            evt.preventDefault();
            log("touchcancel.");
            var touches = evt.changedTouches;

            for (var i=0; i < touches.length; i++) {
                ongoingTouches.splice(i, 1);  // remove it; we're done
            }
        }

        function copyTouch(touch) {
            return { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY };
        }

        // touch
        var el = gameState.canvas;
        el.addEventListener("touchstart", handleStart, false);
        el.addEventListener("touchend", handleEnd, false);
        el.addEventListener("touchcancel", handleCancel, false);
        el.addEventListener("touchleave", handleEnd, false);
        el.addEventListener("touchmove", handleMove, false);
	};

	var once = 1;
	var pollUserInteraction = function() {
		var keyboard = gameState.keyboard;

		csUtils.pollAutoFire();
// USER INPUT Poll Keyboard //////////////////////////////////////////////////
		

		// TODO: move this to animaion independed poll function
		if (keyboard.isPressed("Z".charCodeAt()))
		{
			if (once) {
				once=0;
				csUtils.gameStep();
			}
		}
		else if (keyboard.isPressed("Q".charCodeAt()))
		{
			if (once) {
				once=0;
				csUtils.gamePlayPause();
			}
		}
		else
			once = 1;	

        gameState.ship.control(keyboard);

		if (keyboard.isPressed("O".charCodeAt()))
		{
			gameState.zoom -= 0.03;
			csUtils.refreshGUI(["zoom"]);
		}

		if (keyboard.isPressed("L".charCodeAt()))
		{
			gameState.zoom += 0.03;
			csUtils.refreshGUI(["zoom"]);
		}

		if (keyboard.isPressed("N".charCodeAt()))
		{
			gameState.rot += 0.05;
			csUtils.refreshGUI(["zoom"]);
		}

		if (keyboard.isPressed("M".charCodeAt()))
		{
			gameState.rot -= 0.05;
			csUtils.refreshGUI(["zoom"]);
		}

		// space
		if (keyboard.isPressed(32)) {
			csUtils.resetGame();

			//gameState.dishes.enemyShield.randomize(, gameState.randomDensity);
		}

		// escape
		if (keyboard.isPressed(27))
		{
            if (!bounceEsc) {
                bounceEsc = 1;

                // reset selection
                if (gameState.selection.active) {
                    gameState.selection.active = 0;
                }
                else {

                    var dishes = gameState.dishes;
                    var blockedDishes = [dishes.buffer, dishes.background];

                    var saveDishes = _.filter(dishes, function (d) {
                        return !_.contains(blockedDishes, d);
                    });
                    _.each(saveDishes, function (dish) {
                        dish.setAll(0);
                    });
                }
            }
		}
        else {
            bounceEsc = 0;
        }

		if (keyboard.isPressed("I".charCodeAt())) {
			gameState.ship.bombPower++;
		}

		if (keyboard.isPressed("K".charCodeAt())) {
			gameState.ship.bombPower--;
			if (gameState.ship.bombPower <= 0) gameState.bombPower = 1;
		}

		if (keyboard.isPressed("1".charCodeAt()))
		{
			gameState.mouseMode = "shoot";
		}
		if (keyboard.isPressed("P".charCodeAt()))
		{
			gameState.mouseMode = "paste";
		}
		if (keyboard.isPressed("C".charCodeAt()))
		{
			gameState.mouseMode = "copy";
		}

	};

	return {
		setupGui: setupGui,
		pollUserInteraction: pollUserInteraction,
		getActiveDishName: getActiveDishName,
	};
});