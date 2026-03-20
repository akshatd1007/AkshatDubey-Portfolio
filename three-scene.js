// ═══════════════════════════════════════════════════════════════
// CINEMATIC STARFIELD — Rotating sphere shell + GLSL twinkle
// No warp tunnel (avoids depth=0 blowout). Safe, beautiful, fast.
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas || !window.THREE) return;

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
        canvas, alpha: false, antialias: false, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x010810, 1);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 70;

    // ═══════════════════════════════════════════════════════════
    // LAYER 1 — 18,000 stars in sphere shells
    // Two shells create parallax when the sphere rotates at
    // different speeds.
    // ═══════════════════════════════════════════════════════════
    function buildShell(count, rMin, rMax, sMin, sMax) {
        const geo  = new THREE.BufferGeometry();
        const pos  = new Float32Array(count * 3);
        const col  = new Float32Array(count * 3);
        const size = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const r   = rMin + Math.random() * (rMax - rMin);
            const th  = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const i3  = i * 3;
            pos[i3]     = r * Math.sin(phi) * Math.cos(th);
            pos[i3 + 1] = r * Math.sin(phi) * Math.sin(th);
            pos[i3 + 2] = r * Math.cos(phi);

            // Colour palette — mostly white/blue, rare cyan & purple
            const rnd = Math.random();
            let cr = 1, cg = 1, cb = 1;
            if      (rnd < 0.12) { cr = 0.0; cg = 0.94; cb = 1.0; }  // cyan
            else if (rnd < 0.20) { cr = 0.67; cg = 0.55; cb = 1.0; } // lavender
            else if (rnd < 0.25) { cr = 0.48; cg = 0.23; cb = 0.93;} // purple
            else                 { cr = cg = cb = 0.7 + Math.random() * 0.3; } // white

            // Some stars are bright "feature" stars
            const boost = Math.random() < 0.04 ? 2.5 : 1.0;
            col[i3]     = cr * boost;
            col[i3 + 1] = cg * boost;
            col[i3 + 2] = cb * boost;

            size[i] = sMin + Math.random() * (sMax - sMin);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos,  3));
        geo.setAttribute('color',    new THREE.BufferAttribute(col,  3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(size, 1));
        return geo;
    }

    // Shared shader — twinkling via uTime, hard gl_PointSize cap
    const vert = `
        attribute vec3  color;
        attribute float aSize;
        varying vec3    vColor;
        varying float   vBright;
        uniform float   uTime;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
        }

        void main() {
            vColor = color;

            // Per-star unique frequency and phase
            float freq  = 0.6 + hash(position.xy * 0.01) * 3.5;
            float phase = hash(position.yz * 0.01) * 6.283;
            float raw   = sin(uTime * freq + phase);
            // Twinkle: ranges 0.15 → 1.0, occasionally spikes to 1.5 (sparkle)
            vBright = 0.15 + 0.85 * pow(max(raw, 0.0), 0.6);

            vec4 mvp  = modelViewMatrix * vec4(position, 1.0);
            float dep = max(-mvp.z, 8.0);   // HARD floor prevents infinite size
            // Size: aSize * perspective / depth, clamped 0.5–7.5 px
            gl_PointSize = clamp(aSize * (220.0 / dep), 0.5, 7.5);
            gl_Position  = projectionMatrix * mvp;
        }
    `;
    const frag = `
        varying vec3  vColor;
        varying float vBright;
        void main() {
            float d    = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;
            float core = smoothstep(0.22, 0.0, d) * 2.0;   // bright centre
            float halo = smoothstep(0.5,  0.0, d);
            float a    = (halo + core * 0.6) * vBright;
            // Slight colour shift: brighter = warmer white
            vec3 glow  = vColor + vec3(core * 0.3, core * 0.2, 0.0);
            gl_FragColor = vec4(glow, a);
        }
    `;

    function makeMat() {
        return new THREE.ShaderMaterial({
            vertexShader: vert, fragmentShader: frag,
            uniforms: { uTime: { value: 0.0 } },
            transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
    }

    // Inner shell (close — more visible twinkle, faster rotation)
    const geoA  = buildShell(5000, 40, 100, 1.5, 5.0);
    const matA  = makeMat();
    const meshA = new THREE.Points(geoA, matA);
    scene.add(meshA);

    // Outer shell (far — smaller, slower rotation)
    const geoB  = buildShell(13000, 100, 280, 0.8, 3.0);
    const matB  = makeMat();
    const meshB = new THREE.Points(geoB, matB);
    scene.add(meshB);

    // ═══════════════════════════════════════════════════════════
    // LAYER 2 — MORPHING CONSTELLATION (scroll-reactive, 7K pts)
    // ═══════════════════════════════════════════════════════════
    const COUNT   = 7000;
    const cGeo    = new THREE.BufferGeometry();
    const pSphere = new Float32Array(COUNT * 3);
    const pTorus  = new Float32Array(COUNT * 3);
    const pWave   = new Float32Array(COUNT * 3);
    const pGalaxy = new Float32Array(COUNT * 3);
    const pCur    = new Float32Array(COUNT * 3);
    const pCol    = new Float32Array(COUNT * 3);

    const ca = new THREE.Color(0x00f0ff), cb = new THREE.Color(0x7c3aed), cm = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        const r  = 22 + Math.random() * 16;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(Math.random() * 2 - 1);
        pSphere[i3] = r*Math.sin(ph)*Math.cos(th); pSphere[i3+1] = r*Math.sin(ph)*Math.sin(th); pSphere[i3+2] = r*Math.cos(ph);

        const u = Math.random()*Math.PI*2, R2=26, p2=3, q2=4;
        pTorus[i3]   = ((R2+7*Math.cos(q2*u))*Math.cos(p2*u))*1.2 + (Math.random()-.5)*7;
        pTorus[i3+1] = ((R2+7*Math.cos(q2*u))*Math.sin(p2*u))*1.2 + (Math.random()-.5)*7;
        pTorus[i3+2] = 7*Math.sin(q2*u)*1.2 + (Math.random()-.5)*7;

        const t2=Math.random()*Math.PI*2, ab=38;
        pWave[i3] = Math.sin(t2)*ab + (Math.random()-.5)*25;
        pWave[i3+1] = Math.cos(t2*2)*ab*.5 + (Math.random()-.5)*25;
        pWave[i3+2] = (Math.random()-.5)*70;

        const ang=Math.random()*Math.PI*2, rad=Math.pow(Math.random(),.4)*60;
        pGalaxy[i3]   = Math.cos(ang+rad*.04)*rad; pGalaxy[i3+1] = (Math.random()-.5)*8; pGalaxy[i3+2] = Math.sin(ang+rad*.04)*rad-10;

        pCur[i3]=pSphere[i3]; pCur[i3+1]=pSphere[i3+1]; pCur[i3+2]=pSphere[i3+2];

        cm.lerpColors(ca, cb, Math.random());
        const boost = Math.random()>.9 ? 3.5 : 1.3;
        pCol[i3]=cm.r*boost; pCol[i3+1]=cm.g*boost; pCol[i3+2]=cm.b*boost;
    }

    cGeo.setAttribute('position', new THREE.BufferAttribute(pCur, 3));
    cGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));

    const conMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            attribute vec3 color; varying vec3 vColor; uniform float uTime;
            void main() {
                vColor = color;
                vec4 mvp = modelViewMatrix * vec4(position, 1.0);
                float pulse = 0.75 + 0.25 * sin(uTime*1.5 + position.x*0.08);
                gl_PointSize = clamp((130.0 / -mvp.z) * pulse, 0.5, 5.0);
                gl_Position  = projectionMatrix * mvp;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float d = distance(gl_PointCoord, vec2(0.5));
                if (d > 0.5) discard;
                gl_FragColor = vec4(vColor, pow((0.5-d)*2.0, 1.4));
            }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });

    const conGroup = new THREE.Group();
    conGroup.add(new THREE.Points(cGeo, conMat));
    scene.add(conGroup);

    // Morph weights + helper
    const w   = { sphere:1, torus:0, wave:0, galaxy:0 };
    const pos = cGeo.attributes.position.array;
    function morph() {
        for (let i=0; i<COUNT; i++) {
            const i3=i*3;
            pos[i3]  =pSphere[i3]*w.sphere+pTorus[i3]*w.torus+pWave[i3]*w.wave+pGalaxy[i3]*w.galaxy;
            pos[i3+1]=pSphere[i3+1]*w.sphere+pTorus[i3+1]*w.torus+pWave[i3+1]*w.wave+pGalaxy[i3+1]*w.galaxy;
            pos[i3+2]=pSphere[i3+2]*w.sphere+pTorus[i3+2]*w.torus+pWave[i3+2]*w.wave+pGalaxy[i3+2]*w.galaxy;
        }
        cGeo.attributes.position.needsUpdate = true;
    }

    // GSAP scroll morph
    gsap.registerPlugin(ScrollTrigger);
    const scr = { start:'top bottom', end:'center center', scrub:1.5 };
    gsap.to(w, { scrollTrigger:{...scr,trigger:'#about'},      sphere:0, torus:1,  onUpdate:morph });
    gsap.to(w, { scrollTrigger:{...scr,trigger:'#tech-stack'}, torus:0,  wave:1,   onUpdate:morph });
    gsap.to(w, { scrollTrigger:{...scr,trigger:'#projects'},   wave:0,   galaxy:1, onUpdate:morph });
    gsap.to(w, { scrollTrigger:{...scr,trigger:'#contact'},    galaxy:0, sphere:1, onUpdate:morph });
    gsap.to(camera.position, {
        scrollTrigger:{trigger:'#contact', start:'top bottom', end:'bottom bottom', scrub:1.5},
        z: 40
    });

    // ── Mouse parallax ───────────────────────────────────────
    let mx = 0, my = 0;
    window.addEventListener('mousemove', e => {
        mx = (e.clientX/window.innerWidth  - .5) * 2;
        my = (e.clientY/window.innerHeight - .5) * 2;
    });

    // ── Hero image 3D tilt ───────────────────────────────────
    const imgInner = document.querySelector('.hero-image-inner');
    const glare    = document.querySelector('.hero-image-glare');
    if (imgInner) {
        window.addEventListener('mousemove', e => {
            const rX = (e.clientX/window.innerWidth  - .5)*20;
            const rY = (e.clientY/window.innerHeight - .5)*-20;
            gsap.to(imgInner, { rotationY:rX, rotationX:rY, duration:1, ease:'power2.out' });
            if(glare) gsap.to(glare, { x:e.clientX/window.innerWidth*200, y:e.clientY/window.innerHeight*200, duration:1, ease:'power2.out' });
        });
    }

    // ── Render loop ──────────────────────────────────────────
    const clock = new THREE.Clock();
    morph();

    (function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Update time for twinkling
        matA.uniforms.uTime.value = t;
        matB.uniforms.uTime.value = t;
        conMat.uniforms.uTime.value = t;

        // Shells rotate at different speeds = depth parallax + clearly visible motion
        meshA.rotation.y = t * 0.045;   // inner: faster
        meshA.rotation.z = t * 0.018;
        meshB.rotation.y = t * 0.015;   // outer: slower
        meshB.rotation.x = t * 0.008;

        // Constellation slow spin
        conGroup.rotation.y = t * 0.09;
        conGroup.rotation.x = t * 0.035;

        // Camera mouse-follow (gentle)
        camera.position.x += (mx * 12 - camera.position.x) * 0.035;
        camera.position.y += (-my * 12 - camera.position.y) * 0.035;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }());

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

}());
