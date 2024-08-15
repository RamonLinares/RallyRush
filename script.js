(function () {

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

    const gameManager = new GameManager(scene, camera, renderer);

    const controls = { left: false, right: false, accelerate: false, brake: false };

    document.addEventListener('keydown', e => {
        let controlChanged = false;
        if (e.key === 'ArrowLeft') { controls.left = true; controlChanged = true; }
        if (e.key === 'ArrowRight') { controls.right = true; controlChanged = true; }
        if (e.key === 'ArrowUp') { controls.accelerate = true; controlChanged = true; }
        if (e.key === 'ArrowDown') { controls.brake = true; controlChanged = true; }
        if (controlChanged) {
            gameManager.setControls(controls);
        }
        if (e.key === 'Enter') {
            if (document.getElementById('startScreen').style.display !== 'none') {
                gameManager.startGame();
            } else if (document.getElementById('endScreen').style.display !== 'none') {
                document.getElementById('endScreen').style.display = 'none';
                gameManager.startGame();
            }
        }
    });

    document.addEventListener('keyup', e => {
        let controlChanged = false;
        if (e.key === 'ArrowLeft') { controls.left = false; controlChanged = true; }
        if (e.key === 'ArrowRight') { controls.right = false; controlChanged = true; }
        if (e.key === 'ArrowUp') { controls.accelerate = false; controlChanged = true; }
        if (e.key === 'ArrowDown') { controls.brake = false; controlChanged = true; }
        if (controlChanged) {
            gameManager.setControls(controls);
        }
    });
    // Touch control setup
    const touchStartX = 0;
    const touchEndX = 0;
    const touchStartY = 0;
    const touchEndY = 0;

    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    });

    document.addEventListener('touchmove', e => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) {
                controls.right = true;
                controls.left = false;
            } else {
                controls.left = true;
                controls.right = false;
            }
        } else {
            if (deltaY > 0) {
                controls.brake = true;
                controls.accelerate = false;
            } else {
                controls.accelerate = true;
                controls.brake = false;
            }
        }
        gameManager.setControls(controls);
    });

    document.addEventListener('touchend', e => {
        controls.left = false;
        controls.right = false;
        controls.accelerate = false;
        controls.brake = false;
        gameManager.setControls(controls);
    });

    document.getElementById('startButton').addEventListener('click', () => gameManager.startGame());
    document.getElementById('restartButton').addEventListener('click', () => {
        document.getElementById('endScreen').style.display = 'none';
        gameManager.startGame();
    });

    // Initial setup
    document.getElementById('ui').style.display = 'none';
    renderer.render(scene, camera);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

})();
