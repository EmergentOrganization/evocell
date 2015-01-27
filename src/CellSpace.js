var perfStartedJSTime = performance.now();

require.config({
    paths: {
        jquery: '../node_modules/jquery/dist/jquery',
        "jquery-ui": '../node_modules/jquery-ui/jquery-ui',
        "underscore": '../node_modules/underscore/underscore',
        backbone: "../node_modules/backbone/index",
        knockback: "../node_modules/knockback/knockback",
        knockout: "../node_modules/knockout/build/output/knockout-latest",
        meSpeak: "../node_modules/mespeak/mespeak",
        three: "../node_modules/three.js/index",
        datgui: "../node_modules/dat-gui/index",
        FileSaver: "../node_modules/FileSaver/FileSaver",
        "jquery-cycle": "./libs/jquery.cycle.all",
        requireLib: 'libs/require'
    },
	shim: {
		datgui: {
			exports: "dat"
		},
        "jquery-ui": {
            exports: "$",
            deps: ['jquery', './libs/farbtastic']
        },
		"jquery-cycle": {
			deps: ["jquery-ui"]
		},
		underscore : {
			exports: "_"
		},
		backbone : {
			exports: "Backbone",
			deps: ['underscore']
		},
		knockback: {
			exports: "kb",
			deps: ["backbone"]
		},
		knockout: {
			exports: "ko"
		},
		meSpeak: {
			exports: "meSpeak"
		},
		three: {
			exports: "THREE"
		}
    }
});


require([
	"jquery", "jquery-ui", "Utils", "EvoCell", "story/StoryTeller", "underscore",
	"backbone", "knockback", "knockout", "data/FileStore", "three", "datgui", 
	"CellSpace/State", "CellSpace/Setup", "CellSpace/GameLoop", "CellSpace/GUI", "CellSpace/Utils"], 
function($, utils, EC, storyTeller,_ , Backbone, kb, ko, fileStore, THREE, dat, 
	gameState, csSetup, csGame, csUI, csUtils) {
	"use strict";

	gameState.perfRequireTime = performance.now();
	gameState.perfStartedJSTime = perfStartedJSTime;

	// MAIN LOOP (must be less than 20 LOC :)

	// TODO: extract this in CellSpace.App which bundles State, Setup, UI, ...

	// TODO: should we not put this in backbone ready function?
	// is jquery ready better?
	//$(window).load(function(e) { 
		var canvas = document.getElementById('c');

		csSetup.setup(canvas, function () {
			csUI.setupGui();

			gameState.mainLoop = new utils.AnimationLoop(0, function() {
				csUI.pollUserInteraction();
				if (!gameState.pause || gameState.doOneStep) {
					csGame.step();
					gameState.doOneStep = false;
				}
				csGame.render();
			});

			gameState.perfFinishedJSTime = performance.now();
			csUtils.refreshGUI(["perfStartedJSTime","perfFinishedJSTime", "perfRequireTime"]);

			gameState.mainLoop.start();
		});
	//});
});
