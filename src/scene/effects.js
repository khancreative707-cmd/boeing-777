import * as THREE from 'three';

/** World-space, depth-tested effects; driven exclusively by the spool/heat model. */
export class FlowEffects {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.y = 2.12;
    scene.add(this.group);
    this.clock = 0;
    const positions = [],
      seeds = [],
      paths = [];
    for (let i = 0; i < 1600; i++) {
      positions.push(0, 0, 0);
      seeds.push((i * 0.61803398875) % 1, (i * 0.75487766) % 1, (i * 0.56984029) % 1);
      paths.push(i < 1000 ? 0 : 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 3));
    geometry.setAttribute('path', new THREE.Float32BufferAttribute(paths, 1));
    this.flowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPhase: { value: 0 }, uLevel: { value: 0 }, uSize: { value: 1 } },
      vertexShader: `
      attribute vec3 seed; attribute float path; uniform float uPhase; uniform float uLevel; uniform float uSize;
      varying float vPath; varying float vFade; varying float vLight;
      void main(){
        float progress=fract(seed.x+uPhase*(path<.5?.085:.11));
        float x=mix(-2.95,4.2,progress);float a=seed.y*6.283185;
        float bypass=mix(1.05,1.52,seed.z)*(1.-.28*smoothstep(-1.2,2.4,x));
        float core=mix(.34,.57,seed.z); core*=1.-.22*smoothstep(-.5,.65,x);core+=.16*smoothstep(1.8,3.,x);
        float r=mix(bypass,core,path);vec3 p=vec3(x,r*cos(a),r*sin(a));
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((path>.5?28.:24.)*uSize/-mv.z,1.2,5.);
        vPath=path;vFade=smoothstep(0.,.12,progress)*(1.-smoothstep(.88,1.,progress))*uLevel;vLight=smoothstep(.5,1.4,x)*path;
      }`,
      fragmentShader: `
        varying float vPath; varying float vFade; varying float vLight;
        void main(){vec2 p=gl_PointCoord*2.-1.;float a=exp(-dot(p,p)*3.)*vFade*.74;
          vec3 c=mix(vec3(.20,.48,.59),mix(vec3(.75,.48,.22),vec3(.88,.58,.25),vLight),vPath);
          gl_FragColor=vec4(c,a);}
      `,
    });
    this.points = new THREE.Points(geometry, this.flowMaterial);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.group.add(this.points);
    const profile = [
      [0.86, 0.3],
      [0.86, 0.51],
      [1.35, 0.57],
      [1.35, 0.32],
      [0.86, 0.3],
    ];
    const g = new THREE.LatheGeometry(
      profile.map(([x, r]) => new THREE.Vector2(r, x)),
      96,
    ).rotateZ(-Math.PI / 2);
    this.flameMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uHeat: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uHeat;
      void main(){float ripple=.65+.18*sin(vUv.x*138.+uTime*4.)+.09*sin(vUv.x*63.-uTime*3.);
        float body=smoothstep(.0,.16,vUv.y)*(1.-smoothstep(.78,1.,vUv.y));
        vec3 c=mix(vec3(.84,.30,.045),vec3(1.,.79,.38),.35+.35*ripple);
        gl_FragColor=vec4(c,body*uHeat*(.3+.15*ripple));}
      `,
    });
    this.flame = new THREE.Mesh(g, this.flameMaterial);
    this.group.add(this.flame);
    this.group.visible = false;
  }
  update(dt, simulation, { airflow, exploded, reduced }) {
    const running = !simulation.interlocked && !exploded;
    this.group.visible = running && (simulation.heat.x > 0.002 || airflow);
    this.points.visible = running && airflow && simulation.flow > 0.002;
    if (!reduced) this.clock += dt * simulation.speed * Math.max(0.1, simulation.flow) * 2;
    this.flowMaterial.uniforms.uPhase.value = reduced ? 0.8 : this.clock;
    this.flowMaterial.uniforms.uLevel.value = simulation.flow;
    this.flameMaterial.uniforms.uTime.value = reduced ? 0.8 : this.clock;
    this.flameMaterial.uniforms.uHeat.value = running ? simulation.heat.x : 0;
  }
  dispose() {
    this.points.geometry.dispose();
    this.flame.geometry.dispose();
    this.flowMaterial.dispose();
    this.flameMaterial.dispose();
    this.group.removeFromParent();
  }
}
