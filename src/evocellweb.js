var EvoCell;
if (!EvoCell) {
    EvoCell = {};
}

//////////////////////////////////////////
// CACanvas
//////////////////////////////////////////

EvoCell.CACanvas = function(canvas)
{
	this.canvas = canvas;
	this.gl = getGL(canvas);
}

EvoCell.CACanvas.prototype.setSize = function(width, height)
{
	this.canvas.width = width;
	this.canvas.height = height;
	this.gl.viewport(0, 0, width, height);
}


EvoCell.CACanvas.prototype.setupPaletteShader = function(paletteShader)
{
	this.progShow = this.gl.createProgram();
	this.gl.attachShader(this.progShow, getShaderFromElement(this.gl, "shader-vs-passthrough" ));
	this.gl.attachShader(this.progShow,  paletteShader);
	this.gl.linkProgram(this.progShow);
	this.caSpace = createCASpace(this.gl);
	bindCASpaceToShader(this.gl, this.progShow, this.caSpace);
}

EvoCell.CACanvas.prototype.draw = function(ca, sourceRect, destRect) 
{
	var gl = this.gl;
	gl.useProgram(this.progShow);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	if (!destRect)
		destRect = [0, 0, this.canvas.width, this.canvas.height];


	//set viewport to match destination rect
	gl.viewport(destRect[0], destRect[1], destRect[2], destRect[3]);
	//gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	

	gl.uniform1i(gl.getUniformLocation(this.progShow, "texFrame"), 0);
	gl.activeTexture(gl.TEXTURE0);    
	gl.bindTexture(gl.TEXTURE_2D, ca.getTexture());
	
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

//////////////////////////////////////////
// CASimulation
//////////////////////////////////////////

EvoCell.CASimulation = function(caCanvas, ruleData, width, height)
{
	this.caCanvas = caCanvas;
	this.gl = this.caCanvas.gl;
	
	this.setRule(ruleData);
	this.setSize(width, height);
}

EvoCell.CASimulation.prototype.setRule = function(ruleData)
{
	this.ruleData = ruleData;

	var xN = Math.ceil(ruleData.nrNeighbours/2);
	var yN = Math.floor(ruleData.nrNeighbours/2);
	var width = Math.pow(ruleData.nrStates, xN);
	var height = Math.pow(ruleData.nrStates, yN);
	this.ruleTexture  = createCATexture(this.gl, width, height, ruleData.ruleTable);	

	this.invalidateProgram();
}

EvoCell.CASimulation.prototype.setSize = function(width, height)
{
	this.width = width;
	this.height = height;
	this.invalidateProgram();
}


EvoCell.CASimulation.prototype.invalidateProgram = function() 
{
	this.program = null;
}

EvoCell.CASimulation.prototype.getProgram = function() 
{
	if (this.program == null)
	{
		if (this.width == null || this.height == null || this.ruleData == null)
		{
			throw "You have to set the rule, and the size of the ca";
		}
		
		var newProgCA  = this.gl.createProgram();
		this.gl.attachShader(newProgCA, getShaderFromElement(this.gl, "shader-vs-passthrough" ));
		this.gl.attachShader(newProgCA, EvoCell.getFragmentShaderSourceFromEvoCellData(this.gl, this.ruleData, this.width, this.height));
		this.gl.linkProgram(newProgCA);
		this.program = newProgCA; 
		
		this.randomize(0.1)
		
		this.frameFlip = 1;
		this.frameCount = 0;
	}
	
	return this.program;
}

EvoCell.CASimulation.prototype.randomize = function(density) 
{
	if (!this.texture1) 
	{
		this.gl.deleteTexture(this.texture1);
	}
	if (!this.texture2) 
	{
		this.gl.deleteTexture(this.texture2);
	}

	if (!this.fb1) 
	{
		this.gl.deleteFramebuffer(this.fb1);
	}
	if (!this.fb2) 
	{
		this.gl.deleteFramebuffer(this.fb2);
	}

	// TODO get rid of density!!!!
	this.texture1 = createFrameTextureRandom(this.gl, this.width, this.height, this.ruleData.nrStates, density);
	this.texture2 = createFrameTextureRandom(this.gl, this.width, this.height, this.ruleData.nrStates, density);

	this.fb1 = this.gl.createFramebuffer();
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fb1);
	this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture1, 0);

	this.fb2 = this.gl.createFramebuffer();
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fb2);
	this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture2, 0);	
}

EvoCell.CASimulation.prototype.getTexture = function() 
{
	return (this.frameFlip > 0) ? this.texture1 : this.texture2;
}

EvoCell.CASimulation.prototype.step = function(steps) 
{
	if (steps == null)
		steps = 1;
		
	var progCA = this.getProgram();
	var gl = this.gl;
		
	gl.viewport(0,0, this.width, this.height);
	for (;steps > 0; steps--)
	{
		
		this.gl.useProgram(progCA);

		gl.uniform1i(gl.getUniformLocation(progCA, "texRule"), 1);
		gl.activeTexture(gl.TEXTURE1);    
		gl.bindTexture(gl.TEXTURE_2D, this.ruleTexture);

		if (this.frameFlip > 0)
		{
			gl.uniform1i(gl.getUniformLocation(progCA, "texFrame"), 0);
			gl.activeTexture(gl.TEXTURE0);    
			gl.bindTexture(gl.TEXTURE_2D, this.texture1);
			
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb2);
		}
		else
		{
			gl.uniform1i(gl.getUniformLocation(progCA, "texFrame"), 0);
			gl.activeTexture(gl.TEXTURE0);    
			gl.bindTexture(gl.TEXTURE_2D, this.texture2);
		
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb1);
		}
	 
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		
		this.frameFlip = -this.frameFlip;
		this.frameCount++;
	}
}

EvoCell.CASimulation.prototype.executeCustomShader = function(progCA, callback) 
{
	var gl = this.gl;
		
	gl.viewport(0,0, this.width, this.height);	
	this.gl.useProgram(progCA);

	if (this.frameFlip > 0)
	{
		gl.uniform1i(gl.getUniformLocation(progCA, "texFrame"), 0);
		gl.activeTexture(gl.TEXTURE0);    
		gl.bindTexture(gl.TEXTURE_2D, this.texture1);
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb2);
	}
	else
	{
		gl.uniform1i(gl.getUniformLocation(progCA, "texFrame"), 0);
		gl.activeTexture(gl.TEXTURE0);    
		gl.bindTexture(gl.TEXTURE_2D, this.texture2);
	
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb1);
	}

	callback(gl, progCA);
 
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	
	this.frameFlip = -this.frameFlip;
}



//////////////////////////////////////////////////////////
// Static functions
//////////////////////////////////////////////////////////

EvoCell.EvoCellFragmentShaderTemplate = 
"#ifdef GL_ES\n" +
"precision highp float;\n" +
"#endif\n" +
"  uniform sampler2D texFrame;\n" +
"  uniform sampler2D texRule;\n" +
"  \n" +
"  varying vec2 vTexCoord;\n" +
"  const float dx = 1./%XRES%., dy=1./%YRES%.;\n" +
"  const float stateScale = 255.;\n" +
"  const float states = %STATES%.;\n" +
"  const float width = %WIDTH%, height = %HEIGHT%;\n" +
"  \n" +
"  \n" +
"void main(void) {\n" +
"	float v; \n" +
"	float idx = 0.;\n" +
"   %XBLOCK% \n" +
"    \n" +
"   float idy = 0.;\n" +
"   %YBLOCK% \n" +
"    \n" +
"   vec2 vvvv=vec2(0.5/width + idx*stateScale/width, 0.5/height + idy*stateScale/height); \n" +
"	vec4 lookup = 	texture2D(texRule, vvvv);\n" +
"	gl_FragColor =  vec4(0, 0., 0., lookup.a);\n" +
//"   gl_FragColor = vec4(0, 0., vTexCoord.x, vTexCoord.y);\n" +
"}";

EvoCell.getFragmentShaderSourceFromEvoCellData = function (gl, evoCellData, xres, yres)
{
	var xblock = "";
	var yblock = "";
	var nInXBlock = Math.ceil(evoCellData.nrNeighbours/2);
	var vget = "";
	var multiplier = "";
	var widthExpr = "";
	var heightExpr = "";
	
	for (var nIndex = 0; nIndex < evoCellData.neighbourhood.length; nIndex++)
	{
		var neighbour = evoCellData.neighbourhood[nIndex];
		
		vget = "v = texture2D(texFrame, vTexCoord + vec2(" + neighbour[0] + ".*dx, " + neighbour[1] + ".*dy)).a;\n";
		
		
		if (nIndex < nInXBlock)
		{	
			xblock += vget;
			xblock += "idx += " + multiplier + "v;\n";
			
			if (widthExpr != "")
				widthExpr += "*";
			widthExpr += "states";
		}
		else
		{
			yblock += vget;
			yblock += "idy += " + multiplier + "v;\n";
			
			if (heightExpr != "")
				heightExpr += "*";
			heightExpr += "states";
		}
		
		if (nIndex == nInXBlock-1)
			multiplier = "";
		else
			multiplier += "states*";
	}
	
	var shaderSource = EvoCell.EvoCellFragmentShaderTemplate;
	shaderSource = shaderSource.replace("%STATES%", evoCellData.nrStates);
	shaderSource = shaderSource.replace("%XRES%", xres); // width of the state texture
	shaderSource = shaderSource.replace("%YRES%", yres); // height of the state texture
	shaderSource = shaderSource.replace("%WIDTH%", widthExpr); 	 // width of the rule texture
	shaderSource = shaderSource.replace("%HEIGHT%", heightExpr); // height of the rule texture
	shaderSource = shaderSource.replace("%XBLOCK%", xblock);
	shaderSource = shaderSource.replace("%YBLOCK%", yblock);

	//alert(shaderSource);
	var shaderType = gl.FRAGMENT_SHADER;
	return getShader(gl, shaderType, shaderSource);
}

EvoCell.saveRuleToBlob = function(evoCellData) {
	var rawData = EvoCell.writeEvoCellDataToArrayBuffer(evoCellData);
	//var blob = new Blob(rawData, {type: 'application/octet-stream'});
	var blob = arrayBufferToBlob(rawData, 'application/octet-stream');
	
	//var blobBuilder = new BlobBuilder();
	//blobBuilder.append(rawData);
	//var blob = blobBuilder.getBlob('application/octet-stream');
	return blob;
};

EvoCell.saveRuleToDataURL = function(evoCellData) {
	var rawData = EvoCell.writeEvoCellDataToArrayBuffer(evoCellData);
	var base64Encoded = arrayBufferToBase64(rawData);
	return 'data:application/octet-stream;base64,' + base64Encoded;
};

EvoCell.writeEvoCellDataToArrayBuffer = function(evoCellData) {
	//calculate target size
	var bufferSize = 20; //magic + contains flags + reserved
	
	if (evoCellData.containsRule) {
		bufferSize += 12; //magic + nrStates + nrNeighbours
		bufferSize += evoCellData.ruleTableSize;
	}

	if (evoCellData.containsNeighbourhood) {
		bufferSize += 12; //magic + nrNeighbours + nrDimensions
		bufferSize += 8 * evoCellData.neighbourhood.length;
	}

	if (evoCellData.containsPattern) {
		bufferSize += 16; //magic + nrDimensions + width + height
		bufferSize += evoCellData.patternWidth * evoCellData.patternHeight;
	}

	var arrayBuffer = new ArrayBuffer(bufferSize);
	var dv = new DataView(arrayBuffer);
	var index = 0;

	//general part
	dv.setUint32(index, 0x0000002A); index += 4;
	dv.setUint32(index, evoCellData.containsRule ? 1 : 0); index += 4;
	dv.setUint32(index, evoCellData.containsNeighbourhood ? 1 : 0); index += 4;
	dv.setUint32(index, evoCellData.containsPattern ? 1 : 0); index += 4;
	dv.setUint32(index, 0); index += 4;

	if (evoCellData.containsRule) {
		dv.setUint32(index, 0x00000913); index += 4;
		dv.setUint32(index, evoCellData.nrStates); index += 4;
		dv.setUint32(index, evoCellData.nrNeighbours); index += 4;
		var ruleTableBuffer = new Uint8Array(arrayBuffer, index, evoCellData.ruleTableSize);
		ruleTableBuffer.set(evoCellData.ruleTable, 0);
		index += Math.pow(evoCellData.nrStates, evoCellData.nrNeighbours);
	}

	if (evoCellData.containsNeighbourhood) {
		dv.setUint32(index, 0x0000004E31); index += 4;
		dv.setUint32(index, evoCellData.nrNeighbours); index += 4;
		dv.setUint32(index, 2); index += 4;
		for (var i = 0; i < evoCellData.nrNeighbours; i++) {
			dv.setUint32(index, evoCellData.neighbourhood[i][0]); index += 4;
			dv.setUint32(index, evoCellData.neighbourhood[i][1]); index += 4;
		}
	}

	if (evoCellData.containsPattern) {
		dv.setUint32(index, 0x00005ABF); index += 4;
		dv.setUint32(index, 2); index += 4;
		dv.setUint32(index, evoCellData.patternWidth); index += 4;
		dv.setUint32(index, evoCellData.patternHeight); index += 4;
		var patternDataAlias = new Uint8Array(arrayBuffer, index, evoCellData.patternWidth * evoCellData.patternHeight);
		patterDataAlias.set(evoCellData.patternData, 0);
	}

	return arrayBuffer;
}

// returns an object with up to 3 fileds: neighbourhood, ruletable, pattern
// or null if a fileformat error is detected
EvoCell.loadEvoCellFile = function(arrayBuffer) {
	var nrNeighbours, nrStates, nrDimensions;
	var magic, containsRules, containsNeighbourhood, containsPattern, neighbourCount;
	
	var dv = new DataView(arrayBuffer);
	var index = 0;
	
	magic = dv.getUint32(index); index += 4;
	// all evocellfiles must start with 0x002A
	if (magic != 42) return null;
	
	containsRules = dv.getUint32(index); index += 4;
	containsNeighbourhood = dv.getUint32(index); index += 4;
	containsPattern = dv.getUint32(index); index += 4;
	index += 4; // ignore reserved but unused value

	var evoCellData = {};
	
	if (containsRules) {
		var rulesMagic = dv.getUint32(index); index += 4;
		// valid rules must have this magic value here
		if (rulesMagic != 2323) return null;
		nrStates =  dv.getUint32(index); index += 4;
		nrNeighbours  = dv.getUint32(index); index += 4;
	
		var ruleTableSize = Math.pow(nrStates, nrNeighbours);
		var ruleTable = new Uint8Array(arrayBuffer, index, ruleTableSize);
		//var ruleTableView = new Uint8Array(ruleTableSize);
		//var ruleTable = ruleTableView.buffer;
		//alert(ruleTableView.subarray);
		index += ruleTableSize;
		
		evoCellData.containsRule = true;
		evoCellData.nrStates = nrStates;
		evoCellData.nrNeighbours = nrNeighbours;
		evoCellData.ruleTable = ruleTable;
		evoCellData.ruleTableSize = ruleTableSize; // convinient to have but redundant
	}
	else
		evoCellData.containsRule = false;
	
	if (containsNeighbourhood) {
		var neighbourhoodMagic = dv.getUint32(index); index += 4;
		// valid rules must have this magic value here
		if (neighbourhoodMagic != 0x4E31) return null;
		var nrNeighboursRedundant  = dv.getUint32(index); index += 4;
		// nr of neighbours has to match
		if (nrNeighbours != nrNeighboursRedundant) return null;
		nrDimensions =  dv.getUint32(index); index += 4;
		if (nrDimensions != 2) return null;
	
		var neighbourhood = [];
		for (n = 0; n < nrNeighbours; n++)
		{
			var x = dv.getInt32(index); index += 4;
			var y = dv.getInt32(index); index += 4;
			neighbourhood.push([x, y]);
		}
		
		evoCellData.containsNeighbourhood = true;
		evoCellData.nrDimensions = nrDimensions;
		evoCellData.neighbourhood = neighbourhood;
		evoCellData.symmetries = calculateSymmetries(evoCellData);
	}
	else
		evoCellData.containsNeighbourhood = false;
	
	if (containsPattern) {
		var patternMagic = dv.getUint32(index); index += 4;
		// valid rules must have this magic value here
		if (patternMagic != 23231) return null;
		var nrDimensions =  dv.getUint32(index); index += 4;
		if (nrDimensions != 2) return null;
	
		var sizeX = dv.getInt32(index); index += 4;
		var sizeY = dv.getInt32(index); index += 4;
		
		var pattern = new Uint8Array(arrayBuffer, index, sizeX*sizeY);

		evoCellData.containsPattern = true;
		evoCellData.patternWidth = sizeX;
		evoCellData.patternHeight = sizeY;
		evoCellData.patternData = pattern;
	}
	else
		evoCellData.containsPattern = false;
	       
	return evoCellData;
}

function calculateSymmetries(evoCellData) 
{
	symmetryPermutations = [];
	
	for (var rot = 0; rot < 4; rot++)
	{
		var rotVals = [];
		for (var i = 0; i < evoCellData.nrNeighbours; i++) 
		{
			var roted = evoCellData.neighbourhood[i];
			for (var r = 0; r < rot; r++)
				roted = rot90(roted);
			
			for (var s = 0; s < evoCellData.nrNeighbours; s++) 
			{
				if (evoCellData.neighbourhood[s][0] == roted[0] && evoCellData.neighbourhood[s][1] == roted[1])
				{
					rotVals.push(s);
					break;
				}
			}
		}
		// check if rotation was successful
		if (rotVals.length == evoCellData.neighbourhood.length) 
		{
			symmetryPermutations.push(rotVals);
		}
	}
	return symmetryPermutations;
}

function myClone(a)
{
	b = {};
	for (f in a) {
		b[f] = a[f];
	}
	return b;
}
	


function getRandInt(min, max)
{
	return min + Math.floor(Math.random() * (max-min));
}

function rot90(xy)
{
	return [-xy[1], xy[0]];
}


function mutRotSym(evoCellData, vals, targetState)
{
	for (var sidx = 0; sidx < evoCellData.symmetries.length; sidx++) {
		var s = evoCellData.symmetries[sidx];
		var idx = 0;
		for (var j = s.length-1; j >= 0; j--)
		{
			idx = idx * evoCellData.nrStates + vals[s[j]];
		}
		try
		{
		evoCellData.ruleTable.set([targetState], idx);
		//break;
		}
		catch (ex)
		{
			alert(vals + " -> " + targetState); 
		}
	}
	
}

function evalRegexpr(r, evoCellData) 
{
	if (r == "?")
		return getRandInt(0, evoCellData.nrStates);
	else
		return parseInt(r);
}

function evalTargetRegexpr(r, evoCellData, vals)
{
	if (r.length > 0 && r[0]=='n')
	{
		return vals[parseInt(r.substr(1))];
	}
	if (r.length > 0 && r[0]=='a')
	{
		var sum = parseInt(r.substr(1));

		for (var i = 0; i < vals.length; i++)
		{	
			sum += vals[i];
		}
		var zS = Math.floor(sum/vals.length);
		if (zS >= evoCellData.nrStates)
			zS = evoCellData.nrStates - 1;
		return zS;
	}
	return evalRegexpr(r, evoCellData);
}

/*
function evalAllRegexpr(r, evoCellData) 
{
	if (r == "?")
	{
		var i = 0;
		return function(restart) {
			if (restart == true)
			{
				i = 0;
			}		
			val retVal = i;
			i++;
			return retVal;
		};
	}	
	else
		return function(restart) { 
			return parseInt(r); 
		};
}

function evalTargetRegexpr(r, evoCellData, vals)
{
	if (r.length > 0 && r[0]=='n')
	{
		var idx = r.substr(1);
		return function(restart, vals) { return vals[parseInt()];
	}
	if (r.length > 0 && r[0]=='a')
	{
		var sum = parseInt(r.substr(1));

		for (var i = 0; i < vals.length; i++)
		{	
			sum += vals[i];
		}
		var zS = Math.floor(sum/vals.length);
		return zS;
	}
	return evalRegexpr(r, evoCellData);
}
*/

EvoCell.mutateAllEvoCellRule = function(evoCellData, regExprs, targetRegExpr, n)
{
	for (var i = 0; i < n; i++)
	{
		var nr = 0;
		var vals = [];
		for (var j = 0; j < evoCellData.nrNeighbours; j++)
		{
			nr = evalRegexpr(regExprs[j], evoCellData);
			vals.push(nr);
		}
				
		var targetState = evalTargetRegexpr(targetRegExpr, evoCellData, vals);
		mutRotSym(evoCellData, vals, targetState);
	}
}


EvoCell.mutateEvoCellRule = function(evoCellData, regExprs, targetRegExpr, n)
{
	for (var i = 0; i < n; i++)
	{
		var nr = 0;
		var vals = [];
		for (var j = 0; j < evoCellData.nrNeighbours; j++)
		{
			nr = evalRegexpr(regExprs[j], evoCellData);
			vals.push(nr);
		}
				
		var targetState = evalTargetRegexpr(targetRegExpr, evoCellData, vals);
		mutRotSym(evoCellData, vals, targetState);
	}
}
