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

    const mobileControls = document.getElementById('mobileControls');
    const startScreen = document.getElementById('startScreen');
    const endScreen = document.getElementById('endScreen');

    // Mobile button controls setup
    const accelerateButton = document.getElementById('accelerateButton');
    const brakeButton = document.getElementById('brakeButton');
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');

    // Hide mobile controls on start and end screens
    function hideMobileControls() {
        mobileControls.style.display = 'none';
    }

    // Show mobile controls during gameplay
    function showMobileControls() {
        mobileControls.style.display = 'block';
    }

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
            if (startScreen.style.display !== 'none') {
                gameManager.startGame();
            } else if (endScreen.style.display !== 'none') {
                endScreen.style.display = 'none';
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

    // Touch controls
    accelerateButton.addEventListener('touchstart', () => {
        controls.accelerate = true;
        gameManager.setControls(controls);
    });

    brakeButton.addEventListener('touchstart', () => {
        controls.brake = true;
        gameManager.setControls(controls);
    });

    leftButton.addEventListener('touchstart', () => {
        controls.left = true;
        gameManager.setControls(controls);
    });

    rightButton.addEventListener('touchstart', () => {
        controls.right = true;
        gameManager.setControls(controls);
    });

    accelerateButton.addEventListener('touchend', () => {
        controls.accelerate = false;
        gameManager.setControls(controls);
    });

    brakeButton.addEventListener('touchend', () => {
        controls.brake = false;
        gameManager.setControls(controls);
    });

    leftButton.addEventListener('touchend', () => {
        controls.left = false;
        gameManager.setControls(controls);
    });

    rightButton.addEventListener('touchend', () => {
        controls.right = false;
        gameManager.setControls(controls);
    });

    // Handle game start and restart
    document.getElementById('startButton').addEventListener('click', () => {
        startScreen.style.display = 'none';
        showMobileControls();
        gameManager.startGame();
    });

    document.getElementById('restartButton').addEventListener('click', () => {
        endScreen.style.display = 'none';
        showMobileControls();
        gameManager.startGame();
    });

    document.getElementById('changeCircuitButton').addEventListener('click', () => {
        endScreen.style.display = 'none';
        startScreen.style.display = 'block';
        hideMobileControls();
    });

    // Ensure mobile controls are hidden initially and on end screen
    hideMobileControls();

    // Override the end game logic to hide controls
    gameManager.endGame = function (time) {
        cancelAnimationFrame(this.animationId);
        this.updateBestTimes(time);
        this.displayEndScreen(time);
        hideMobileControls(); // Hide mobile controls when the game ends
    };

    // Initial setup
    document.getElementById('ui').style.display = 'none';
    renderer.render(scene, camera);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();
