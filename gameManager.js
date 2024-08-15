// Define environments at the top of your script
const environments = {
    scotland: {
        terrainColor: 0x3f7c47,
        treeDensity: 0.2,
        maxMountainHeight: 15,
        fogColor: 0x87CEEB
    },
    desert: {
        terrainColor: 0xC2B280, // Remove or set to null
        treeDensity: 0, // No trees in the desert
        maxMountainHeight: 40, // Lower mountains
        fogColor: 0xF0E68C
    },
    alpine: {
        terrainColor: 0x7DFFFF,
        treeDensity: 0.4,
        maxMountainHeight: 180, // Higher mountains
        fogColor: 0x00E0FF
    }
};


// Ensure this is defined outside of the GameManager class

class GameManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.game = null;
        this.playerCar = null;
        this.animationId = null;
        this.bestTimes = JSON.parse(localStorage.getItem('bestTimes') || '[]');
        this.controls = { left: false, right: false, accelerate: false, brake: false };
        this.cameraOffset = new THREE.Vector3(0, 5, 15);
        this.carPosition = new THREE.Vector3(0, 0, 0);
        this.minCameraDistance = 5;
        // Add a reference to the directional light
        this.directionalLight = null;
        // Enable shadow rendering with improved settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.trafficCars = [];
        this.maxTrafficCars = 8; // Maximum number of traffic cars
        // Audio elements
        this.desertMusic = document.getElementById('desertMusic');
        this.alpineMusic = document.getElementById('alpineMusic');
        this.scotlandMusic = document.getElementById('scotlandMusic');
        this.gameMusic = document.getElementById('gameMusic');
        // Initialize the game music when the page loads
    }

    initGame(environment) {
        // Clear the scene
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }

        // Clear the traffic cars array to remove references to old traffic cars
        this.trafficCars = [];

        // Set up lighting with shadows (if needed)
        const ambientLight = new THREE.AmbientLight(0x404040, 0.05);
        this.scene.add(ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.directionalLight.position.set(50, 100, 150);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 10;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.left = -100;
        this.directionalLight.shadow.camera.right = 100;
        this.directionalLight.shadow.camera.top = 150;
        this.directionalLight.shadow.camera.bottom = -100;

        this.scene.add(this.directionalLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.9);
        hemiLight.color.setHSL(0.6, 1, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        this.scene.add(hemiLight);

        // Initialize the game object
        this.game = {
            road: { length: 3000, width: 25, segments: [] },
            car: {
                position: new THREE.Vector3(0, 0, -10),
                speed: 0,
                acceleration: 0.010,
                deceleration: 0.002,
                brakePower: 0.01,
                maxSpeed: 2.5,
                minSpeed: 0,
                xOffset: 0,
                angle: 0,
                steeringAngle: 0,
                maxSteeringAngle: Math.PI / 12,
                steeringSpeed: 0.15,
                turnSpeed: 0.08,
                grip: 0.7,
                borderCollisionCooldown: 0
            },
            terrain: { width: 300 },
            traffic: [],
            startTime: null,
            finishTime: null,
            startLine: -100,
            finishLine: -5900
        };

        // Generate the road and terrain based on the environment
        generateRoadAndTerrain(this.scene, this.game, environment);

        this.playerCar = this.createCar(0xff0000);
        this.scene.add(this.playerCar);

        this.createInitialTrafficCars();
        this.resetCarPosition();
        this.updateCameraPosition();
    }


    createCar(color) {
        const car = new THREE.Group();

        // Car body
        const carBody = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.75, 4),
            new THREE.MeshPhongMaterial({ color: color })
        );
        carBody.position.y = 0.375;
        carBody.castShadow = true;
        carBody.receiveShadow = true;
        car.add(carBody);

        // Car roof
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.5, 2),
            new THREE.MeshPhongMaterial({ color: 0xffffff })
        );
        roof.position.set(0, 1, 0.5);
        roof.castShadow = true;
        roof.receiveShadow = true;
        car.add(roof);

        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const wheelPositions = [
            [-1, 0, -1.5], [1, 0, -1.5],
            [-1, 0, 1.5], [1, 0, 1.5]
        ];

        wheelPositions.forEach(position => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...position);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheel.receiveShadow = true;
            car.add(wheel);
        });

        return car;
    }


    createInitialTrafficCars() {
        for (let i = 0; i < this.maxTrafficCars; i++) {
            this.createTrafficCar();
        }
    }

    createTrafficCar() {
        const trafficCar = this.createCar(0x0000ff);
        const randomSegmentIndex = Math.floor(Math.random() * this.game.road.segments.length);
        const segment = this.game.road.segments[randomSegmentIndex];
        const xOffset = (Math.random() - 0.5) * (this.game.road.width * 0.8);
        trafficCar.position.set(segment.curve + xOffset, segment.y + 0.25, segment.z);
        trafficCar.rotation.y = Math.PI;
        this.scene.add(trafficCar);
        this.trafficCars.push({
            mesh: trafficCar,
            speed: 0.5 + Math.random() * 0.5,
            xOffset: xOffset
        });
    }
    resetCarPosition() {
        const startSegment = this.game.road.segments[0];
        this.game.car.position.set(startSegment.curve, startSegment.y + 0.95, this.game.startLine);
        this.game.car.speed = 0;
        this.game.car.xOffset = 0;
        this.game.car.angle = 0;
        this.game.car.angularVelocity = 0;
        this.game.car.steeringAngle = 0;
        this.carPosition.copy(this.game.car.position);

        this.playerCar.position.copy(this.game.car.position);
        this.playerCar.rotation.set(0, 0, 0);
    }

    initGameMusic() {

                // Play game music for the start screen
                this.stopAllMusic();
                if (this.gameMusic) {
                    this.gameMusic.play();
                } else {
                    console.error('Game music element not found.');
                }
    }

    startGame() {
        const selectedCircuit = document.getElementById('circuitSelect').value;
        const environment = environments[selectedCircuit]; // Use the selected environment
        // Stop all music
        this.stopAllMusic();

        // Play the corresponding music
        if (selectedCircuit === 'desert') {
            this.desertMusic.play();
        } else if (selectedCircuit === 'alpine') {
            this.alpineMusic.play();
        } else if (selectedCircuit === 'scotland') {
            this.scotlandMusic.play();
        }
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('ui').style.display = 'block';
        this.initGame(environment); // Start the game with the selected circuit
        this.resetCarPosition();
        this.game.startTime = null;
        this.game.finishTime = null;
        this.animate();
    }

    stopAllMusic() {
        if (this.desertMusic) {
            this.desertMusic.pause();
            this.desertMusic.currentTime = 0;
        } else {
            console.warn('Desert music element not found.');
        }
        
        if (this.alpineMusic) {
            this.alpineMusic.pause();
            this.alpineMusic.currentTime = 0;
        } else {
            console.warn('Alpine music element not found.');
        }
        
        if (this.scotlandMusic) {
            this.scotlandMusic.pause();
            this.scotlandMusic.currentTime = 0;
        } else {
            console.warn('Scotland music element not found.');
        }
        
        if (this.gameMusic) {
            this.gameMusic.pause();
            this.gameMusic.currentTime = 0;
        } else {
            console.warn('Game music element not found.');
        }
    }
    

    endGame(time) {
        cancelAnimationFrame(this.animationId);
        this.updateBestTimes(time);
        this.displayEndScreen(time);
    }

    displayEndScreen(time) {
        // Stop circuit music and play game music for the end screen
        this.stopAllMusic();
        this.gameMusic.play();

        document.getElementById('ui').style.display = 'none';
        const endScreen = document.getElementById('endScreen');
        endScreen.style.display = 'block';
        document.getElementById('finalTime').textContent = `Your Time: ${time.toFixed(2)} seconds`;

        const scoreboard = document.getElementById('scoreboard');
        if (scoreboard) { // Check if the scoreboard element exists
            scoreboard.innerHTML = '<h2>Best Times:</h2>';
            this.bestTimes.forEach((t, i) => {
                scoreboard.innerHTML += `<p>${i + 1}. ${t.toFixed(2)} seconds</p>`;
            });
        }

        // Event listener for changing the circuit
        document.getElementById('changeCircuitButton').addEventListener('click', () => {
            document.getElementById('endScreen').style.display = 'none';
            document.getElementById('startScreen').style.display = 'block';
        });

        // Event listener for restarting the game
        document.getElementById('restartButton').addEventListener('click', () => {
            document.getElementById('endScreen').style.display = 'none';
            this.startGame();
        });
    }


    restartGame() {
        document.getElementById('endScreen').style.display = 'none';
        this.startGame();
    }

    updateBestTimes(time) {
        this.bestTimes.push(time);
        this.bestTimes.sort((a, b) => a - b);
        this.bestTimes.splice(5); // Keep only top 5 times
        localStorage.setItem('bestTimes', JSON.stringify(this.bestTimes));
    }



    updateUI() {
        document.getElementById('speed').textContent = `Speed: ${(this.game.car.speed * 100).toFixed(0)} km/h`;
        if (this.game.startTime && !this.game.finishTime) {
            const elapsedTime = (Date.now() - this.game.startTime) / 1000;
            document.getElementById('timer').textContent = `Time: ${elapsedTime.toFixed(2)}s`;
        }
    }

    updateLightPosition() {
        if (this.directionalLight && this.playerCar) {
            const offset = new THREE.Vector3(50, 100, -50);
            this.directionalLight.position.copy(this.playerCar.position).add(offset);
            this.directionalLight.target.position.copy(this.playerCar.position);
            this.directionalLight.target.updateMatrixWorld();
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));

        if (!this.game.startTime && this.game.car.position.z <= this.game.startLine) {
            this.game.startTime = Date.now();
        }

        this.updateCarPosition();
        this.updateTraffic(); // Make sure this line is present
        this.updateCameraPosition();
        this.updateLightPosition(); // Add this line to update light position

        // Update the road
        if (this.roadUpdater) {
            this.roadUpdater(this.game.car.position.z);
        }

        if (!this.game.finishTime && this.game.car.position.z <= this.game.finishLine) {
            this.game.finishTime = Date.now();
            const totalTime = (this.game.finishTime - this.game.startTime) / 1000;
            this.endGame(totalTime);
        }

        this.updateUI();
        this.renderer.render(this.scene, this.camera);
    }


    updateCarPosition() {
        // Update speed
        if (this.controls.accelerate) {
            this.game.car.speed += this.game.car.acceleration;
        } else if (this.controls.brake) {
            this.game.car.speed -= this.game.car.brakePower;
        } else {
            this.game.car.speed -= this.game.car.deceleration;
        }
        this.game.car.speed = THREE.MathUtils.clamp(this.game.car.speed, this.game.car.minSpeed, this.game.car.maxSpeed);

        // Update steering
        const steeringInput = (this.controls.right ? -1 : 0) + (this.controls.left ? 1 : 0);
        const targetSteeringAngle = steeringInput * this.game.car.maxSteeringAngle;
        this.game.car.steeringAngle += (targetSteeringAngle - this.game.car.steeringAngle) * this.game.car.steeringSpeed;

        // Update car angle based on steering and speed
        this.game.car.angle += this.game.car.steeringAngle * this.game.car.speed * this.game.car.turnSpeed;

        // Calculate incidence angle between car direction and road curve
        const roadData = getRoadDataAtZ(this.game.car.position.z, this.game);
        const incidenceAngle = this.game.car.angle - Math.atan2(roadData.curve - this.game.car.xOffset, this.game.car.position.z);

        // Introduce lateral drift based on incidence angle and speed
        const lateralDrift = Math.sin(incidenceAngle) * this.game.car.speed * 0.5;
        this.game.car.xOffset -= lateralDrift;

        // Calculate movement
        const dx = Math.sin(this.game.car.angle) * this.game.car.speed;
        const dz = Math.cos(this.game.car.angle) * this.game.car.speed;

        // Update position
        this.game.car.xOffset -= dx;
        this.game.car.position.z -= dz;

        // Handle border collisions
        const borderThreshold = this.game.road.width / 2 - 1.5;
        if (Math.abs(this.game.car.xOffset) > borderThreshold) {
            if (this.game.car.borderCollisionCooldown === 0) {
                this.game.car.speed *= 0.8;
                this.game.car.borderCollisionCooldown = 30;
            }
            const pushBackForce = (Math.abs(this.game.car.xOffset) - borderThreshold) * 0.1;
            this.game.car.xOffset -= Math.sign(this.game.car.xOffset) * pushBackForce;
        }

        if (this.game.car.borderCollisionCooldown > 0) {
            this.game.car.borderCollisionCooldown--;
        }

        // Update car's position and rotation
        this.carPosition.set(this.game.car.xOffset + roadData.curve, roadData.y + 0.25, this.game.car.position.z);
        this.playerCar.position.copy(this.carPosition);

        // Apply rotations
        this.playerCar.rotation.set(0, 0, 0);
        const nextY = getRoadDataAtZ(this.game.car.position.z - 1, this.game).y;
        const pitch = Math.atan2(nextY - roadData.y, 1) * 0.1; // Reduces the pitch effect by 50%
        this.playerCar.rotateX(pitch);
        this.playerCar.rotateY(this.game.car.angle);

        // Apply a slight roll based on steering (for visual effect only)
        const maxRoll = Math.PI / 16;
        const roll = -this.game.car.steeringAngle * (maxRoll / this.game.car.maxSteeringAngle);
        this.playerCar.rotateZ(roll);
    }



    updateTraffic() {
        this.trafficCars.forEach((trafficCar, index) => {
            trafficCar.mesh.position.z += trafficCar.speed;

            // If car is behind the player, move it to the back of the visible road
            if (trafficCar.mesh.position.z > this.game.car.position.z + 100) {
                const lastVisibleSegment = this.game.road.segments[this.game.road.segments.length - 1];
                trafficCar.mesh.position.z = Math.min(lastVisibleSegment.z, this.game.car.position.z - 1000);
                trafficCar.xOffset = (Math.random() - 0.5) * (this.game.road.width * 0.8);
            }

            const trafficRoadData = getRoadDataAtZ(trafficCar.mesh.position.z, this.game);
            trafficCar.mesh.position.y = trafficRoadData.y + 0.25;
            trafficCar.mesh.position.x = trafficCar.xOffset + trafficRoadData.curve;

            // Correct pitch rotation for traffic cars
            const nextTrafficRoadData = getRoadDataAtZ(trafficCar.mesh.position.z + 1, this.game);
            trafficCar.mesh.rotation.set(0, Math.PI, 0);
            trafficCar.mesh.rotateX(Math.atan2(nextTrafficRoadData.y - trafficRoadData.y, 1));

            // Simple collision detection
            if (Math.abs(trafficCar.mesh.position.z - this.playerCar.position.z) < 3 &&
                Math.abs(trafficCar.mesh.position.x - this.playerCar.position.x) < 2) {
                console.log("Collision!");
                this.game.car.speed *= 0.5; // Reduce speed on collision
            }
        });
    }

    updateCameraPosition() {
        // Create a direction vector pointing in the same direction as the car
        const carDirection = new THREE.Vector3(
            -Math.sin(this.game.car.angle),
            0,
            -Math.cos(this.game.car.angle)
        );

        // Calculate ideal camera position
        let cameraPosition = this.carPosition.clone()
            .add(carDirection.clone().multiplyScalar(-this.cameraOffset.z))
            .add(new THREE.Vector3(0, this.cameraOffset.y, 0));

        // Check for collision with terrain
        const rayStart = this.carPosition.clone().add(new THREE.Vector3(0, this.cameraOffset.y, 0));
        const rayDirection = cameraPosition.clone().sub(rayStart).normalize();
        const ray = new THREE.Raycaster(rayStart, rayDirection);
        const intersects = ray.intersectObjects(this.scene.children, true);

        if (intersects.length > 0 && intersects[0].distance < this.cameraOffset.z) {
            // Adjust camera position to avoid clipping
            const adjustedDistance = Math.max(intersects[0].distance, this.minCameraDistance);
            cameraPosition = rayStart.add(rayDirection.multiplyScalar(adjustedDistance));
        }

        // Set camera position
        this.camera.position.copy(cameraPosition);

        // Calculate look-at position (slightly ahead of the car)
        const lookAtPosition = this.carPosition.clone()
            .add(carDirection.clone().multiplyScalar(10)); // Look 10 units ahead

        // Set camera to look at this position
        this.camera.lookAt(lookAtPosition);
    }

    setControls(controls) {
        this.controls = { ...this.controls, ...controls };
    }
}

// This function should be defined in your roadGenerator.js file
// Make sure it's accessible to the GameManager class
function getRoadDataAtZ(z, game) {
    const segmentLength = 10;
    const index = Math.floor(Math.abs(z) / segmentLength) % game.road.segments.length;
    const nextIndex = (index + 1) % game.road.segments.length;
    const segment = game.road.segments[index];
    const nextSegment = game.road.segments[nextIndex];
    const t = (Math.abs(z) % segmentLength) / segmentLength;
    return {
        y: THREE.MathUtils.lerp(segment.y, nextSegment.y, t),
        curve: THREE.MathUtils.lerp(segment.curve, nextSegment.curve, t)
    };
}
