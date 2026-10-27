/* Shared interactive 3D portrait for the home counter and AI twin. */
window.LoveAvatar = (function () {
  'use strict';
  function mountOne(host) {
    const THREE = window.THREE;
    if (!THREE || !host || host.dataset.avatarMounted) return null;
    host.dataset.avatarMounted = '1';
    const fallback = host.querySelector('svg');
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
      camera.position.set(0, 0.02, 6.8);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(host.clientWidth || 150, host.clientHeight || 175, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xfff4e9, 0x6c6068, 2.1));
      const key = new THREE.DirectionalLight(0xffe3cf, 2.3);
      key.position.set(-2.5, 3.5, 5); scene.add(key);
      const fill = new THREE.DirectionalLight(0xe7efff, 1.15);
      fill.position.set(3, 0.5, 2); scene.add(fill);
      const avatar = new THREE.Group(); scene.add(avatar);
      const skin = new THREE.MeshStandardMaterial({ color: 0xf0c5a7, roughness: 0.78 });
      const hair = new THREE.MeshStandardMaterial({ color: 0x171719, roughness: 0.82 });
      const shirt = new THREE.MeshStandardMaterial({ color: 0xaeb5bf, roughness: 0.96 });
      const strap = new THREE.MeshStandardMaterial({ color: 0x343943, roughness: 0.9 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x524c45, metalness: 0.68, roughness: 0.28 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x262222, roughness: 0.44 });
      const white = new THREE.MeshStandardMaterial({ color: 0xfffcf8, roughness: 0.35 });
      const blush = new THREE.MeshStandardMaterial({ color: 0xe58a83, transparent: true, opacity: 0.38, roughness: 1 });
      const sphere = new THREE.SphereGeometry(1, 32, 24);
      function ball(parent, mat, pos, scale, geo) {
        const m = new THREE.Mesh(geo || sphere, mat);
        m.position.set(pos[0], pos[1], pos[2]); m.scale.set(scale[0], scale[1], scale[2]); parent.add(m); return m;
      }
      function rod(parent, a, b, radius, mat) {
        const av = new THREE.Vector3(a[0], a[1], a[2]), bv = new THREE.Vector3(b[0], b[1], b[2]);
        const delta = new THREE.Vector3().subVectors(bv, av);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), mat);
        m.position.copy(av).add(bv).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(m); return m;
      }
      ball(avatar, shirt, [0, -1.12, 0], [0.88, 0.76, 0.47]);
      ball(avatar, skin, [0, -0.43, 0.04], [0.27, 0.37, 0.27]);
      const leftStrap = ball(avatar, strap, [-0.49, -1.02, 0.36], [0.085, 0.57, 0.075]); leftStrap.rotation.z = -0.23;
      const rightStrap = ball(avatar, strap, [0.49, -1.02, 0.36], [0.085, 0.57, 0.075]); rightStrap.rotation.z = 0.23;
      const head = new THREE.Group(); head.position.y = 0.35; avatar.add(head);
      ball(head, skin, [0, 0, 0], [0.79, 0.96, 0.66]);
      ball(head, skin, [-0.78, -0.1, 0], [0.16, 0.24, 0.18]); ball(head, skin, [0.78, -0.1, 0], [0.16, 0.24, 0.18]);
      ball(head, hair, [0, 0.69, 0.04], [0.82, 0.47, 0.7]);
      ball(head, hair, [-0.53, 0.46, 0.14], [0.31, 0.4, 0.53]); ball(head, hair, [0.49, 0.48, 0.16], [0.34, 0.38, 0.54]);
      ball(head, hair, [-0.3, 0.63, 0.54], [0.35, 0.17, 0.25]); ball(head, hair, [0.08, 0.61, 0.59], [0.34, 0.16, 0.22]); ball(head, hair, [0.4, 0.57, 0.48], [0.31, 0.2, 0.22]);
      const eyes = [];
      [-0.31, 0.31].forEach((x) => {
        ball(head, eyeMat, [x, 0.08, 0.602], [0.052, 0.063, 0.04]);
        ball(head, white, [x - 0.012, 0.104, 0.635], [0.014, 0.016, 0.009]);
        eyes.push(ball(head, skin, [x, 0.08, 0.648], [0.18, 0.118, 0.028]));
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 8, 40), metal);
        frame.position.set(x, 0.08, 0.64); frame.scale.y = 0.77; head.add(frame);
      });
      rod(head, [-0.105, 0.09, 0.66], [0.105, 0.09, 0.66], 0.018, metal);
      rod(head, [-0.52, 0.13, 0.59], [-0.68, 0.2, 0.45], 0.016, metal); rod(head, [0.52, 0.13, 0.59], [0.68, 0.2, 0.45], 0.016, metal);
      ball(head, skin, [0, -0.09, 0.65], [0.085, 0.11, 0.1]);
      ball(head, blush, [-0.48, -0.23, 0.52], [0.14, 0.07, 0.035]); ball(head, blush, [0.48, -0.23, 0.52], [0.14, 0.07, 0.035]);
      rod(head, [-0.16, -0.38, 0.58], [0, -0.42, 0.63], 0.02, metal); rod(head, [0, -0.42, 0.63], [0.16, -0.38, 0.58], 0.02, metal);
      const arms = [];
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group(); pivot.position.set(side * 0.64, -0.69, 0.06); avatar.add(pivot);
        rod(pivot, [0, 0, 0], [side * 0.16, -0.48, 0.02], 0.105, shirt);
        ball(pivot, skin, [side * 0.16, -0.5, 0.02], [0.11, 0.12, 0.12]); arms.push(pivot);
      });
      arms[1].rotation.z = -0.05;
      let pointerX = 0, pointerY = 0, waveUntil = 0, blinkAt = performance.now() + 4000;
      const onMove = (e) => { const r = host.getBoundingClientRect(); pointerX = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)); pointerY = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1)); };
      const onTap = () => { waveUntil = performance.now() + 1100; };
      const onLeave = () => { pointerX = 0; pointerY = 0; };
      host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave); host.addEventListener('pointerdown', onTap);
      host.classList.add('is-3d');
      const siblingFallback = host.parentElement && host.parentElement.querySelector(':scope > .buddy__svg');
      if (fallback) fallback.style.display = 'none';
      if (siblingFallback) siblingFallback.style.display = 'none';
      let raf = 0, disposed = false;
      const resize = new ResizeObserver(() => {
        if (disposed) return;
        const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }); resize.observe(host);
      function draw(now) {
        if (disposed) return;
        const t = now * 0.001; avatar.position.y = Math.sin(t * 1.65) * 0.035;
        avatar.rotation.y += ((pointerX * 0.32) - avatar.rotation.y) * 0.045;
        head.rotation.x += ((-pointerY * 0.12) - head.rotation.x) * 0.04; head.rotation.z = Math.sin(t * 0.8) * 0.018;
        eyes.forEach((eye) => { eye.visible = now > blinkAt && now < blinkAt + 150; });
        if (now >= blinkAt + 150) blinkAt = now + 3500 + Math.random() * 2800;
        if (now < waveUntil) arms[1].rotation.z = -0.8 + Math.sin(now * 0.025) * 0.22;
        else arms[1].rotation.z += (-0.05 - arms[1].rotation.z) * 0.12;
        renderer.render(scene, camera); raf = requestAnimationFrame(draw);
      }
      raf = requestAnimationFrame(draw);
      return () => {
        disposed = true; cancelAnimationFrame(raf); resize.disconnect();
        host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave); host.removeEventListener('pointerdown', onTap);
        const geometries = new Set(), materials = new Set();
        scene.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose(); host.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
        host.classList.remove('is-3d');
        if (fallback) fallback.style.display = '';
        if (siblingFallback) siblingFallback.style.display = '';
        delete host.dataset.avatarMounted;
      };
    } catch (e) {
      console.warn('[LoveAvatar] 3D renderer unavailable; using illustration fallback.', e);
      delete host.dataset.avatarMounted; if (fallback) fallback.style.display = 'block'; return null;
    }
  }
  function mountAll(root) {
    const hosts = Array.from((root || document).querySelectorAll('[data-love-avatar]'));
    const cleanup = hosts.map(mountOne).filter(Boolean);
    return () => cleanup.forEach((dispose) => dispose());
  }
  return { mountAll };
})();
