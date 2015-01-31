define( ["GLOBALS"], function (GLOBALS){
    "use strict";

    function Sector(args){
        // creates a new Sector

        // check for required arguments
        if (typeof args.reactor === undefined){
            console.log('ERR: missing args:', args);
            throw new Error("Required args not passed to Sector constructor");
        }
        // ensures that the callee has invoked our Class' constructor function w/ the `new` keyword
        if (!(this instanceof Sector)) {
            throw new TypeError("Sector constructor cannot be called as a function.");
        }

        this.viewX = 0;
        this.viewY = 0;

        this.buildings = [];    // list of buildings in this sector & info about them
    }

    Sector.prototype.insertAt(x, y){
        // inserts player at given co-ords in this sector
        this.viewX = x;
        this.viewY = y;
    }

    Sector.prototype.addBuilding(args){
        // args objects should include:
        //  building object
        //  building location
        if (typeof args.building === undefined || typeof args.x === undefined || args.y === undefined){
            console.log('ERR: missing args:', args);
            throw new Error("Required args not passed to Sector constructor");
        }
        args.drawn = false;
        this.buildings.push(args);
    }

    Sector.prototype.step(){
        // should be called once per frame. This updates the viewable area of the sector with any buildings and whatnot.
        // TODO: update position now 

        for (building in this.buildings){
            if(this.buildings[building].drawn){  // don't draw buildings already being shown
                // TODO: update position on screen
            } else if(this.buildingViewable(this.buildings[building])){
                // if building if viewable but isn't drawn yet
                //TODO: draw building
            } else {
                // building is off-screen; ignore it
                continue;
            }
        }
    }

    return Sector;
});