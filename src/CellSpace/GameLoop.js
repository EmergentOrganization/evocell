define([
	"GLOBALS", "jquery-ui", "Utils", "EvoCell", "story/StoryTeller", "underscore",
	"backbone", "knockback", "knockout", "data/FileStore", "three", "datgui", 
	"CellSpace/State", "CellSpace/Setup", "CellSpace/Utils", "CellSpace/GUI"], 
function(GLOBALS, $, utils, EC, storyTeller,_ , Backbone, kb, ko, fileStore, THREE, dat,
	gameState, csSetup, csUtils, csUI) {

	"use strict";

	var OP_REPLACE = 0;
	var OP_ADD = 1;

    var enemyStepSum = 0;

	var step = function() {
		var reactor = gameState.reactor;

		// ENEMIES //////////////////////////////////////
        enemyStepSum += gameState.enemySpeed;
        while (enemyStepSum > 1) {
		    reactor.step(gameState.rules.enemy, gameState.dishes.enemy);
            enemyStepSum--;
		}

		if (gameState.cnt % 6 === 0)
			reactor.step(gameState.rules.background, gameState.dishes.background);

		// SHIP ///////////////////////////////////////////
		gameState.ship.step();

		reactor.step(gameState.rules.weaponExplosion, gameState.dishes.weaponExplosion);
		reactor.step(gameState.rules.weapon, gameState.dishes.weapon);
		reactor.step(gameState.rules.shipExplosion, gameState.dishes.shipExplosion);
		reactor.step(gameState.rules.ship, gameState.dishes.ship);

        gameState.ship.draw(gameState);

        // callback function for bullet collision
		var cb = function(pos) {
			try
			{
				gameState.sndHit.playbackRate = 2.0;
				gameState.sndHit.volume = 0.5;
				utils.playSound(gameState.sndHit);
				gameState.ship.score.kills += 1;
			} catch(ex) {}
		};

        reactor.mixDish(gameState.shaders.clear, gameState.dishes.colliding, {color: [0,0,0,0]});
        reactor.mixDish(gameState.shaders.mix, gameState.dishes.colliding,
            {texNew: gameState.dishes.enemy, texPalette: gameState.colors.background.getTexture()});
        reactor.mixDish(gameState.shaders.mix, gameState.dishes.colliding,
            {texNew: gameState.dishes.weaponExplosion, texPalette: gameState.colors.enemy.getTexture()});


        var enemyPixel = gameState.ship.shots.collide(gameState.dishes.colliding, gameState.ship.x, gameState.ship.y, cb, -1);
		//var enemyPixel = gameState.ship.shots.collide(gameState.dishes.weaponExplosion, gameState.ship.x, gameState.ship.y, cb, -1);
		//var enemyPixel = gameState.ship.shots.collide(gameState.dishes.enemy, 
		//	0, 0, cb);

		// collide ship
		if (gameState.cnt > 40) {
			if (gameState.ship.collide(enemyPixel)){

                // did we just die?
                if (gameState.ship.shieldEnergy < 0) {
                    var oldPause = gameState.pause;
                    gameState.pause = 1;

                    storyTeller.RunDeath(function() {
                        gameState.ship.respawn();

                        csUtils.resetGame();
                        gameState.pause = oldPause;
                    });
                }
			}
		}
		

		// Dish INTERACTION ///////////////////////////////////


	

		// weapon + enemy -> weaponExplosion
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.weaponExplosion, { 
			tex1: gameState.dishes.weapon, tex2: gameState.dishes.enemy, 
			state: (gameState.rules.weaponExplosion.nrStates-1)/255, 
			operation: OP_REPLACE
		});

		// enemy spawn even more explosion when explodion
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.weaponExplosion, 
			{tex1: gameState.dishes.enemy, tex2: gameState.dishes.weaponExplosion, state: 3/255, operation: OP_REPLACE});


		//enemy shields generate
		reactor.mixDish(gameState.shaders.shieldSpawn, gameState.dishes.enemyShield, {
			texShield: gameState.dishes.enemyShield, texTarget: gameState.dishes.enemy,
			width: GLOBALS.gameW, height: GLOBALS.gameH
		});

		// shield gets erroded by explosions
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemyShield, { 
			tex1: gameState.dishes.enemyShield, tex2: gameState.dishes.weapon, 
			state: -1/255, 
			operation: OP_ADD
		});

		// weapon killed by shield
		/*
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.weapon, { 
			tex1: gameState.dishes.enemyShield, tex2: gameState.dishes.weapon, 
			state: 0/255, 
			operation: OP_REPLACE
		});
		*/

		// explosions get killed by shield 
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.weaponExplosion, { 
			tex1: gameState.dishes.enemyShield, tex2: gameState.dishes.weaponExplosion, 
			state: 0/255, 
			operation: OP_REPLACE
		});



		// // enemy dies from explosion
		// reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemy, 
		// 	{tex1: gameState.dishes.enemy, tex2: gameState.dishes.weaponExplosion, state: -1/255, operation: OP_ADD});
		//must have faster c thanship; TODO: use bigger neighbourhoods
		if (gameState.cnt % gameState.weaponExplosionParam === 0) {
			reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemy, 
				{tex1: gameState.dishes.enemy, tex2: gameState.dishes.weaponExplosion, state: 0/255, operation: OP_REPLACE});
		}		


		// strange infectious weapon from expoloshion
	//	reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.weapon, 
	//		{tex1: gameState.dishes.weapon, tex2: gameState.dishes.weaponExplosion, state: 3/255, operation: OP_REPLACE});	


		// ship to enemy colissions spawn shipExplosions
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.shipExplosion, 
			{tex1: gameState.dishes.ship, tex2: gameState.dishes.enemy, 
				state: (gameState.rules.shipExplosion.nrStates-1)/255,
			operation: OP_REPLACE});
		
		// shipExplosions reinforced by enemys
		// state 3 actually makes it passive
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.shipExplosion, 
			{tex1: gameState.dishes.enemy, tex2: gameState.dishes.shipExplosion, state: 3/255, operation: OP_REPLACE});
	
		// dishes.enemy gets slowly killed by shipExplosions
		//if (gameState.cnt % 2 === 1) {
			 // reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemy, 
			 // 	{tex1: gameState.dishes.enemy, tex2: gameState.dishes.shipExplosion, state: -1/255, operation: OP_ADD});
			// reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemy, 
			// 	{tex1: gameState.dishes.enemy, tex2: gameState.dishes.shipExplosion, state: 0, operation: OP_REPLACE});
		//}

		if (gameState.cnt % 1 === 0) {
			reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.enemy, 
				{tex1: gameState.dishes.enemy, tex2: gameState.dishes.shipExplosion, state: -1/255, operation: OP_ADD});
		}

		// ship gets killed by shipExplosions
		reactor.mixDish(gameState.shaders.intersectSpawn, gameState.dishes.ship, 
			{tex1: gameState.dishes.ship, tex2: gameState.dishes.shipExplosion, state: 0/255, operation: OP_REPLACE});			


		// screen movement
		if (gameState.enableScrolling === 1 || gameState.enableScrolling === "1") {  // DAT.gui workaround (stores ints as strings)
			var deltaX = Math.round(GLOBALS.gameW/2 - gameState.ship.screenX);
			var deltaY = Math.round(GLOBALS.gameH/2 - gameState.ship.screenY);
			if (deltaX || deltaY) {
				gameState.ship.screenX  += deltaX;
				gameState.ship.screenY  += deltaY;

				gameState.ship.x  += deltaX;
				gameState.ship.y  += deltaY;


				gameState.parallaxX  += deltaX;
				gameState.parallaxY  += deltaY;


				var parallaxDist = 3;
				var pScrollX = Math.round(gameState.parallaxX/parallaxDist);
				var pScrollY = Math.round(gameState.parallaxY/parallaxDist);

				if (pScrollX || pScrollY) {
					var dX = -pScrollX/GLOBALS.gameW;
					var dY = -pScrollY/GLOBALS.gameH;

					reactor.mixDish(gameState.shaders.scroll, gameState.dishes.background,
						{scroll: [dX, dY]});

					gameState.parallaxX  -= pScrollX*parallaxDist;
					gameState.parallaxY -= pScrollY*parallaxDist;
				}

				var dX = -deltaX/GLOBALS.gameW;
				var dY = -deltaY/GLOBALS.gameH;
				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.ship, 
					{scroll: [dX, dY]});		

				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.shipExplosion, 
					{scroll: [dX, dY]});

				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.enemy, 
					{scroll: [dX, dY]});				

				//reactor.mixDish(gameState.shaders.scroll, gameState.dishes.background,
				//	{scroll: [dX, dY]});


				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.enemyShield, 
					{scroll: [dX, dY]});

				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.weapon, 
					{scroll: [dX, dY]});

				reactor.mixDish(gameState.shaders.scroll, gameState.dishes.weaponExplosion, 
					{scroll: [dX, dY]});	
			}		
		}
	
		gameState.cnt++;
	};

	var render = function() {
		var reactor = gameState.reactor;

		var camera = new THREE.PerspectiveCamera( 180*gameState.cameraAngle/Math.PI, 1, 0.01, 1000 );
		//camera.lookAt(new THREE.Vector3( 0, 0, -1 )); // what does it do?
		gameState.projectionMatrix = camera.projectionMatrix;

		//viewMatrix = new THREE.Matrix4();
		var quaternion = new THREE.Quaternion();
		quaternion.setFromAxisAngle( new THREE.Vector3( 0, 0.7, 1 ).normalize(), gameState.rot );

		var shipClipX = 2*(gameState.ship.screenX-gameState.dishes.enemy.width/2)/gameState.dishes.enemy.width;
		var shipClipY = 2*(gameState.ship.screenY-gameState.dishes.enemy.height/2)/gameState.dishes.enemy.height;

		var scaleX = GLOBALS.gameW / gameState.screenW;
		var scaleY = GLOBALS.gameH / gameState.screenH;

		var transMatrix = new THREE.Matrix4().compose(new THREE.Vector3(
				-shipClipX, -shipClipY, 0), 
			new THREE.Quaternion(), 
			new THREE.Vector3(scaleX,scaleY,1)
		);
		var rotMatrix = new THREE.Matrix4().compose(new THREE.Vector3(0,0,0), 
			quaternion, 
			new THREE.Vector3(1,1,1)
		);

		// correct order is firts translate then rotate
		gameState.viewMatrix = new THREE.Matrix4().multiplyMatrices(rotMatrix, transMatrix);

		// subtract mapped ship position to center player shi
		var shipPos = new THREE.Vector4(shipClipX, shipClipY, 0, 1);
		shipPos.applyMatrix4(gameState.viewMatrix);
		shipPos.multiplyScalar(-1);
		shipPos.add(new THREE.Vector3(0,0, -gameState.zoom)); // move to negative x
		//posPlayer = new THREE.Vector3(0,0, -pixel); // do this to not track ship
		var shipCenterMatrix = new THREE.Matrix4().compose(shipPos, 
			new THREE.Quaternion(), 
			new THREE.Vector3(1,1,1)
		);
		// now Subtract mapped shipPos
		gameState.viewMatrix = new THREE.Matrix4().multiplyMatrices(shipCenterMatrix, gameState.viewMatrix);

	// COMPOSE ////////////////////////////////////////////
		reactor.mixDish(gameState.shaders.clear, gameState.dishes.render, {color: [0,0,0,255]});


		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.background, texPalette: gameState.colors.background.getTexture()});
		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.enemy, texPalette: gameState.colors.enemy.getTexture()});
		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.weapon, texPalette: gameState.colors.weapon.getTexture()});
		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.ship, texPalette: gameState.colors.ship.getTexture()});
		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.weaponExplosion, texPalette: gameState.colors.weaponExplosion.getTexture()});
		reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
			{texNew: gameState.dishes.shipExplosion, texPalette: gameState.colors.shipExplosion.getTexture()});			
		
		if (gameState.showBuffer) {
			reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
				{texNew: gameState.dishes.buffer, texPalette: gameState.colors.weapon.getTexture()});
		}

		if (gameState.selection.active) {
			reactor.mixDish(gameState.shaders.mixRect, gameState.dishes.render, {
				rectPos: gameState.selection.pos, 
				rectSize: gameState.selection.size, 
				color: [1,1,1,0.3],
			});
		}

		if (gameState.showRule) {
			// TODO: fixup this dirty hack for visualizing ruletable
			var rule = gameState.rules[csUI.getActiveDishName()];
			var colors = gameState.colors[csUI.getActiveDishName()];

			if (rule && colors) {
				reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
					{texNew: rule.getTexture(), texPalette: colors.getTexture()}
				);
			}
		}
			
		// render shields in render2
		reactor.mixDish(gameState.shaders.clear, gameState.dishes.render2, {color: [0,0,0,0]});
		reactor.mixDish(gameState.shaders.stamp, gameState.dishes.render2, 
			{texNew: gameState.dishes.enemyShield, texPalette: gameState.colors.enemyShield.getTexture()});			

		//reactor.mixDish(gameState.shaders.mix, gameState.dishes.render, 
		//	{texNew: gameState.dishes.enemyShield, texPalette: gameState.colors.enemyShield.getTexture()});			


		reactor.paintDish(gameState.shaders["cameraRenderer" + gameState.renderer], gameState.dishes.render, gameState.dishes.render2, function(gl, shader) {
			gl.uniform2f(gl.getUniformLocation(shader, "resolution"), GLOBALS.gameW, GLOBALS.gameH);
			gl.uniformMatrix4fv(gl.getUniformLocation(shader, "projectionMatrix"), false, gameState.projectionMatrix.elements);
			gl.uniformMatrix4fv(gl.getUniformLocation(shader, "modelViewMatrix"), false, gameState.viewMatrix.elements);
		});

		gameState.fpsMonotor.frameIncrease();

	};

	return {
		step: step,
		render: render,
	};
});