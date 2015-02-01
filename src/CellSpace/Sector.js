define( ["GLOBALS"], function (GLOBALS){
    "use strict";

    function Sector(args){
        // creates a new Sector

        // check for required arguments
        if (typeof args.reactor === "undefined"){
            console.log('ERR: missing args:', args);
            throw new Error("Required args not passed to Sector constructor");
        }
        // ensures that the callee has invoked our Class' constructor function w/ the `new` keyword
        if (!(this instanceof Sector)) {
            throw new TypeError("Sector constructor cannot be called as a function.");
        }

        this.viewX = 0;
        this.viewY = 0;

        this.originX = 0;
        this.originY = 0;

        this.buildings = [];    // list of buildings in this sector & info about them

        if (typeof args.gui !== "undefined"){
            this.gui = args.gui.addFolder('Sector');
            this.gui.add(this, viewX).listen();
            this.gui.add(this, viewY).listen();
            shipFolder.add(gameState.ship, 'y').listen();
        }
    }

    Sector.SIZE = 1024;

    Sector.prototype.insertAt = function(x, y){
        // inserts player at given co-ords in this sector
        this.originX = x;
        this.originY = y;
    }

    Sector.prototype.addBuilding = function(args){
        // args objects should include:
        //  building object
        //  building location
        if (typeof args.building === "undefined" || typeof args.x === "undefined" || args.y === "undefined"){
            console.log('ERR: missing args:', args);
            throw new Error("Required args not passed to Sector constructor");
        }
        args.drawn = false;
        this.buildings.push(args);
        console.log('building added');
    }

    Sector.prototype.buildingViewable = function(buildingObj){
        // TODO check if x,y of building inside viewArea
        return true;
    }

    Sector.prototype.step = function(playerShip){
        // should be called once per frame. This updates the viewable area of the sector with any buildings and whatnot.
        // TODO: update position now
        if (typeof playerShip === "undefined" ){
            console.log('ERR: missing args:', playerShip);
            throw new Error("Required args not passed to Sector.step");
        }

        this.viewX = playerShip.x + this.originX;
        this.viewY = playerShip.y + this.originY;

        var buildingsToDraw = [];
        for ( var building in this.buildings){
            if(this.buildings[building].drawn){  // don't draw buildings already being shown
                // TODO: update position on screen
            } else if(this.buildingViewable(this.buildings[building])){
                // if building if viewable but isn't drawn yet
                buildingsToDraw.push(this.buildings[building]);
            } else {
                // building is off-screen; ignore it
                continue;
            }
        }
        if (buildingsToDraw.length > 0){
            // draws the building in the given gameState
            // TODO: something like this...ish...
		    //gameState.reactor.mixDish(
		    //    gameState.shaders.drawCircle,
		    //    gameState.dishes.ship,
			//    {
			//        center: [this.screenX, this.screenY],
			//        radius: this.radius,
			//        state: (gameState.rules.ship.nrStates-1)/255
            //    }
            //);
            ;
        }
    }

    return Sector;
});