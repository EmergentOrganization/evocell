#ifdef GL_ES
	precision highp float;
#endif

uniform sampler2D texFrame;

uniform vec2 scroll;

varying vec2 vTexCoord;
void main(void) {
	vec4 color = texture2D(texFrame, vTexCoord+scroll);
	gl_FragColor = color;
}