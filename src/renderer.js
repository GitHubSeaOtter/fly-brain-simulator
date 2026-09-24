const vertex = `attribute vec3 aPosition; attribute vec3 aNormal;
uniform mat4 uViewProjection; uniform vec3 uPosition; uniform vec3 uScale; uniform float uYaw;
varying vec3 vNormal; varying vec3 vWorld;
void main(){float c=cos(uYaw),s=sin(uYaw);vec3 p=aPosition*uScale;vec3 world=vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z)+uPosition;vWorld=world;vNormal=normalize(vec3(c*aNormal.x/uScale.x-s*aNormal.z/uScale.z,aNormal.y/uScale.y,s*aNormal.x/uScale.x+c*aNormal.z/uScale.z));gl_Position=uViewProjection*vec4(world,1.);}`;
const fragment = `precision mediump float; uniform vec3 uColor; uniform float uAlpha; varying vec3 vNormal; varying vec3 vWorld;
void main(){float light=.42+.58*max(0.,dot(normalize(vNormal),normalize(vec3(-.4,1.,.6))));float fog=clamp(1.-length(vWorld.xz)*.045,.6,1.);gl_FragColor=vec4(uColor*light*fog,uAlpha);}`;
function compile(gl, type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
  return shader;
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = 2 * far * near / (near - far); return out;
}
function lookAt(eye, center) {
  let z = eye.map((v, i) => v - center[i]); let n = Math.hypot(...z); z = z.map(v => v / n);
  let x = [z[2], 0, -z[0]]; n = Math.hypot(...x); x = x.map(v => v / n);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((a,v,i)=>a+v*eye[i],0),-y.reduce((a,v,i)=>a+v*eye[i],0),-z.reduce((a,v,i)=>a+v*eye[i],0),1]);
}
function multiply(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
function sphere() {
  const positions=[], normals=[], indices=[], lat=12, lon=18;
  for(let y=0;y<=lat;y++)for(let x=0;x<=lon;x++){const theta=Math.PI*y/lat, phi=Math.PI*2*x/lon;const v=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];positions.push(...v);normals.push(...v);}
  for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;indices.push(a,a+1,b,b,a+1,b+1);}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas; const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
    if(!gl)throw Error('WebGLを開始できません。この端末のSafari設定を確認してください。');this.gl=gl;
    const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);this.program=program;
    this.loc={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),vp:gl.getUniformLocation(program,'uViewProjection'),pos:gl.getUniformLocation(program,'uPosition'),scale:gl.getUniformLocation(program,'uScale'),yaw:gl.getUniformLocation(program,'uYaw'),color:gl.getUniformLocation(program,'uColor'),alpha:gl.getUniformLocation(program,'uAlpha')};
    const mesh=sphere();this.mesh=mesh;this.vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.bufferData(gl.ARRAY_BUFFER,mesh.positions,gl.STATIC_DRAW);
    this.normals=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.normals);gl.bufferData(gl.ARRAY_BUFFER,mesh.normals,gl.STATIC_DRAW);
    this.indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.angle=.6;this.elevation=.47;this.resolution=.75;
  }
  resize(){const ratio=Math.min(window.devicePixelRatio||1,2)*this.resolution;const w=Math.max(1,Math.round(this.canvas.clientWidth*ratio)),h=Math.max(1,Math.round(this.canvas.clientHeight*ratio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);}
  ellipsoid(pos,scale,color,yaw=0,alpha=1){const gl=this.gl,l=this.loc;gl.uniform3fv(l.pos,pos);gl.uniform3fv(l.scale,scale);gl.uniform1f(l.yaw,yaw);gl.uniform3fv(l.color,color);gl.uniform1f(l.alpha,alpha);gl.drawElements(gl.TRIANGLES,this.mesh.indices.length,gl.UNSIGNED_SHORT,0);}
  render(sim){const gl=this.gl,l=this.loc;this.resize();gl.clearColor(.055,.105,.15,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const camera=[Math.sin(this.angle)*9*Math.cos(this.elevation),3.5+Math.sin(this.elevation)*6,Math.cos(this.angle)*9*Math.cos(this.elevation)];gl.uniformMatrix4fv(l.vp,false,multiply(perspective(.72,this.canvas.width/this.canvas.height,.1,100),lookAt(camera,[0,.3,0])));gl.bindBuffer(gl.ARRAY_BUFFER,this.vertices);gl.enableVertexAttribArray(l.position);gl.vertexAttribPointer(l.position,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.normals);gl.enableVertexAttribArray(l.normal);gl.vertexAttribPointer(l.normal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
    this.ellipsoid([0,-.17,0],[3.8,.08,3.8],[.15,.24,.28]);
    for(let i=-3;i<=3;i++){this.ellipsoid([i,-.112,0],[.008,.003,3.4],[.27,.40,.40]);this.ellipsoid([0,-.11,i],[3.4,.003,.008],[.27,.40,.40]);}
    const food=sim.food;this.ellipsoid([food.x,.08,food.z],[.2,.16,.2],sim.stimulus==='food'?[.78,.96,.42]:[.36,.48,.4]);
    if(sim.stimulus==='light')this.ellipsoid([-1.6,.12,-1.6],[.22,.28,.22],[1,.92,.49]);
    if(sim.stimulus==='obstacle')this.ellipsoid([sim.obstacle.x,.16,sim.obstacle.z],[.35,.3,.35],[.94,.48,.41]);
    const f=sim.fly,c=Math.cos(f.yaw),s=Math.sin(f.yaw);const local=(x,y,z)=>[f.x+c*x-s*z,y,f.z+s*x+c*z];
    this.ellipsoid(local(-.20,.43,0),[.36,.25,.22],[.69,.76,.66],f.yaw);this.ellipsoid(local(.2,.46,0),[.28,.25,.25],[.24,.34,.36],f.yaw);this.ellipsoid(local(.47,.48,0),[.18,.19,.20],[.36,.44,.40],f.yaw);
    for(const side of [-1,1]){
      this.ellipsoid(local(.48,.50,side*.155),[.095,.12,.085],[.97,.55,.38],f.yaw);
      const flap=Math.sin(sim.time*39+side)*.12;
      this.ellipsoid(local(-.14,.68+flap,side*.4),[.35,.028,.45],[.69,.90,.91],f.yaw+side*.24,.73);
      for(let i=0;i<3;i++){const x=.2-i*.23;this.ellipsoid(local(x,.19,side*(.22+i*.018)),[.028,.28,.035],[.52,.66,.58],f.yaw+side*.13);}
      this.ellipsoid(local(.64,.50,side*.11),[.16,.014,.014],[.4,.54,.48],f.yaw);
    }
  }
}
