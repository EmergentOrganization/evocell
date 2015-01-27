evocell
=======

A HTML5/WebGL app to evolve & play around with ruletable based cellular automata

Test the ALPHA version of the ca based space shooter: <a href="http://wizard23.github.io/evocell/cellspace.html">EvoCellSpace</a>
Very early draft of EvoCell Lab for evolving CAs: <a href="http://wizard23.github.io/evocell/webevocell.html">EvoCellLab</a>

## Installation ##
you need to have git & npm installed to continue
git clone
cd evosim
install dependencies `npm install`
done.

### Common Errors ###
#### Package cairo was not found ####
`sudo apt-get install libcairo2-dev`

Immediately afterwards: "jpeglib.h: No such file or directory"
`sudo apt-get install libjpeg-dev`

Lastly `gif_lib.h: No such file or directory`
`sudo apt-get install libgif-dev`

## Building ##
install requirejs `sudo npm install -g requirejs`
build the project `r.js -o build.js`

## Serving ##
### with node ###
`http-server`
if not installed, install it! `npm install http-server -g`
### with python ###
start local server `python -m SimpleHTTPServer`