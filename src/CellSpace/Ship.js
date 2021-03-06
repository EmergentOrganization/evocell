define( ["Utils", "GLOBALS", "EvoCell"], function (utils, GLOBALS, EC){
    "use strict";

    function Ship(args){
        // creates a new ship at args.x, args.y

        // check for required arguments
        if (typeof args.screenX === undefined || typeof args.screenY === undefined || typeof args.reactor === undefined){
            console.log('ERR: missing args:', args);
            throw new Error("Required args not passed to Ship constructor");
        }
        // ensures that the callee has invoked our Class' constructor function w/ the `new` keyword
        if (!(this instanceof Ship)) {
            throw new TypeError("Ship constructor cannot be called as a function.");
        }

        // physical characteristics
        this.radius = 3;

        // position
        this.x = args.x || 0;
        this.y = args.y || 0;
        this.screenX = args.screenX;
        this.screenY = args.screenY;
        this.direction = 0;
        this.speed = 0;
        this.dx = 0;
        this.dy = 0;

        // ship engine / movement
        this.rotSpeed = 0.15;
		this.accel = 0.1;
		this.minSpeed = -1;
		this.maxSpeed = 3;

        // shielding
        this.shieldEnergy = Ship.MAX_SHIELD;

        // weapon systems
        this.blasterEnergy = Ship.MAX_BLASTER;
        this.blasterRegenRate = 1;
        this.shots = new EC.ParticleSystem(args.reactor, GLOBALS.maxParticles, GLOBALS.gameW, GLOBALS.gameH);
        // ===> primary blaster
        this.frontShots = 3;
		this.frontShotAngle = 0.2;
        // ===> "bomb" shot
        this.bAngle = 0; // direction of bomb fire
        this.bombPower = 8;

        // sounds
        this.snd_blaster = new Audio(GLOBALS.resPath + "sound/Digital_SFX_Set/laser6.mp3");
        this.snd_bomb = new Audio(GLOBALS.resPath + "sound/Digital_SFX_Set/laser4.mp3");

        this.allowReturn = 0;  // used for breaking to 0 and then reverse
        this.shotDelay = 0;  // delay between shots
    };
    // constants:
    Ship.MAX_BLASTER = 1000;
    Ship.MAX_SHIELD = 500;
    Ship.ENERGY_PER_BLASTER = 10;

    // public methods:
    Ship.prototype.step = function(){
        // runs once per gameLoop

        if (this.blasterEnergy < Ship.MAX_BLASTER){
            this.blasterEnergy += this.blasterRegenRate;
        }

        // move ship
        this.dx = this.speed * Math.cos(this.direction);
		this.dy = this.speed * Math.sin(this.direction);
		this.screenX += this.dx;
		this.screenY += this.dy;

		// handle ship shots
        // too costly
		//this.shots.collide(gameState.dishes.enemy, cb);
		this.shots.step();
    };
    Ship.prototype.respawn = function(){
        // spawns new ship after death
        this.score.reset();
        this.shieldEnergy = Ship.MAX_SHIELD;
        this.blasterEnergy = Ship.MAX_BLASTER;

        // move back to middle if off screen
        if (this.screenX < 0 || this.screenX > GLOBALS.gameW ||
			this.screenY < 0 || this.screenY > GLOBALS.gameH) {
			this.screenX = GLOBALS.gameW/2;
			this.screenY = GLOBALS.gameH/2;
		}
    }
    Ship.prototype.fireBomb = function(){
        // spaw bomb-shot if enough blaster energy
        var bombCost = this.bombPower*Ship.ENERGY_PER_BLASTER;
		if (this.blasterEnergy - bombCost > 0){
		    this.blasterEnergy -= bombCost;
            for (var i = 0; i < this.bombPower; i++){
                this.bAngle += Math.PI * 2 / 1.61803398875;
                this.shots.allocateSphere(1,
                    this.screenX -1*this.x, this.screenY -1*this.y,
                    GLOBALS.shotSpeed, this.bAngle,
                    this.dx, this.dy);
            }
            utils.playSound(this.snd_bomb);
        } else {
            return  // TODO: play no-energy sound and show visual effect
        }
    }
    Ship.prototype.fireShotAt = function(tx, ty) {
		// spawn shot if enough energy available
		var shotCost = this.frontShots*Ship.ENERGY_PER_BLASTER;
		if (this.blasterEnergy - shotCost > 0){
		    this.blasterEnergy -= shotCost;
            var dX = tx-this.screenX;
            var dY = ty-this.screenY;
            var dL = Math.sqrt(dX*dX+dY*dY);

            var sX = GLOBALS.shotSpeed * dX/dL;
            var sY = GLOBALS.shotSpeed * dY/dL;

            sX += this.dx
            sY += this.dy;

            var aa = this.frontShots > 1 ? -this.frontShotAngle/2 : 0;

            for (var i = 0; i < this.frontShots; i++) {
                this.shots.allocateParticle(this.screenX-1*this.x, this.screenY-1*this.y,
                    Math.cos(aa)*sX + Math.sin(aa)*sY, -Math.sin(aa)*sX + Math.cos(aa)*sY);

                if (this.frontShots > 1)
                    aa += this.frontShotAngle/(this.frontShots-1);
            }

            utils.playSound(this.snd_blaster);
        } else {
            return  // TODO: play no-energy sound and show visual effect
        }
	};
	Ship.prototype.shootAt = function(angle){
	    // fires blasters at given angle (in deg). convenience method that is less efficient than fireShotAt(x,y)
        var x = this.screenX + Math.cos(angle)  // cos(<) = x/h; h=1;
        var y = this.screenY + Math.sin(angle)  // sin(<) = y/h; h=1;
        this.fireShotAt(x, y);
	}
	Ship.prototype.draw = function(gameState){
	    // draws the ship in the given gameState
		gameState.reactor.mixDish(gameState.shaders.drawCircle, gameState.dishes.ship,
			{center: [this.screenX, this.screenY], radius: this.radius, state: (gameState.rules.ship.nrStates-1)/255}
        );

        // draw shots
        this.shots.draw(gameState.shaders.drawPoints, gameState.dishes.weapon,
			2*this.x, 2*this.y);
		//this.shots.draw(gameState.shaders.drawPoints, gameState.dishes.weapon, 0, 0);
	}

    Ship.prototype.speedUp = function(){
        if (this.speed < this.maxSpeed)
            this.speed += this.accel;
    }
    
    Ship.prototype.slowDown = function(){
        if (this.speed > 0) {
            this.speed -= this.accel;
            if (this.speed < 0) {
                this.speed = 0;
                this.allowReturn = 0;
            }
        }
        else if (this.allowReturn) {
            this.speed -= this.accel;
            if (this.speed < this.minSpeed)
                this.speed = this.minSpeed;
        }
    }

    Ship.prototype.addDebugGUI = function(folder){
        // display only
        folder.add(this, 'x').listen();
		folder.add(this, 'y').listen();
		folder.add(this, 'screenX').listen();
		folder.add(this, 'screenY').listen();
        folder.add(this, 'direction').listen();
		folder.add(this, 'speed').listen();

		// interactive vars
        folder.add(this, 'radius', 1, 20);
        folder.add(this, 'frontShots', 1, 12).step(1);
		folder.add(this, 'frontShotAngle', 0, 2*Math.PI);
    }

	Ship.prototype.collide = function(pixelArry){
	    // collides the ship with given pixel array
	    // returns true if collision, else returns false
	    var pX, pY;
	    var is_hit = false;
        for (pX = -this.radius; pX <= this.radius; pX++) {
            for (pY = -this.radius; pY <= this.radius; pY++) {

                var xxx = Math.round(this.screenX + pX);
                var yyy = Math.round(this.screenY + pY);

                if (pixelArry[(xxx+yyy*GLOBALS.gameW)*4 + 3] !== 0) {
                    is_hit = true;
                    this.shieldEnergy -= 1;

    //				reactor.mixDish(gameState.shaders.drawCircle, gameState.dishes.weapon,
    //	{center: [this.screenX + pX, this.screenY + pY], radius: 1.5, state: (gameState.rules.ship.nrStates-1)/255});
                }
            }
        }
        if (is_hit){
            console.log('/t/tOW!');
            // TODO: play sound & show visual effect
        }
        return is_hit;
	}

    return Ship;
});