// build wirg:
// node r.js -o build.js



({
    baseUrl: "./src/",
    name: "../src/CellSpace",
    out: "main-built.js",

    optimize: "none",
    wrapShim: 'true',

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
            deps: ['jquery']
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
    },
    include: ["requireLib"]
})