class SimplexNoise {
    constructor() {
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
        }
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x);
        const v = this.fade(y);
        const A = this.p[X] + Y, B = this.p[X + 1] + Y;
        return this.lerp(v, this.lerp(u, this.grad(this.p[A], x, y), 
                                         this.grad(this.p[B], x - 1, y)),
                            this.lerp(u, this.grad(this.p[A + 1], x, y - 1),
                                         this.grad(this.p[B + 1], x - 1, y - 1)));
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        return ((h & 8) ? -grad : grad) * x + ((h & 4) ? -grad : grad) * y;
    }
}

function generateRoadAndTerrain(scene, game, environment) {
    const terrainNoise = new SimplexNoise();
    const roadNoise = new SimplexNoise();
    
    function generateMountainHeight(x, z) {
        return (terrainNoise.noise2D(x * 0.01, z * 0.01) + 1) * environment.maxMountainHeight;
    }

    function generateRoadCurve(z) {
        return roadNoise.noise2D(z * 0.002, 0) * 40;
    }

    const segmentLength = 10;
    const extraSegmentsAfterFinish = 100;
    const totalSegments = Math.ceil(Math.abs(game.finishLine) / segmentLength) + extraSegmentsAfterFinish;
    
    function createRoadSegment(index) {
        const z = -index * segmentLength;
        const curve = generateRoadCurve(z);
        const y = Math.sin(z * 0.01) * 10; // Gentle road elevation changes
        
        const nextZ = -(index + 1) * segmentLength;
        const nextCurve = generateRoadCurve(nextZ);
        const dx = nextCurve - curve;
        const dz = segmentLength;
        const curvatureAngle = Math.atan2(dx, dz);
        
        return { z, y, curve, curvatureAngle };
    }

    for (let i = 0; i < totalSegments; i++) {
        game.road.segments.push(createRoadSegment(i));
    }

    const roadGeometry = new THREE.BufferGeometry();
    const leftTerrainGeometry = new THREE.BufferGeometry();
    const rightTerrainGeometry = new THREE.BufferGeometry();
    
    const halfRoadWidth = game.road.width / 2;
    const terrainWidth = game.terrain.width;
    const terrainSteps = 10;

    function updateGeometries() {
        const roadPositions = [];
        const roadIndices = [];
        const roadUVs = [];
        const leftTerrainPositions = [];
        const leftTerrainIndices = [];
        const rightTerrainPositions = [];
        const rightTerrainIndices = [];

        game.road.segments.forEach((segment, i) => {
            const leftX = segment.curve - halfRoadWidth;
            const rightX = segment.curve + halfRoadWidth;

            // Road vertices
            roadPositions.push(leftX, segment.y, segment.z);
            roadPositions.push(rightX, segment.y, segment.z);
            roadUVs.push(0, i / game.road.segments.length);
            roadUVs.push(1, i / game.road.segments.length);

            // Left terrain vertices
            for (let j = 0; j <= terrainSteps; j++) {
                const x = leftX - (j / terrainSteps) * terrainWidth;
                const heightOffset = generateMountainHeight(x, segment.z) * (j / terrainSteps);
                leftTerrainPositions.push(x, segment.y + heightOffset, segment.z);
            }

            // Right terrain vertices
            for (let j = 0; j <= terrainSteps; j++) {
                const x = rightX + (j / terrainSteps) * terrainWidth;
                const heightOffset = generateMountainHeight(x, segment.z) * (j / terrainSteps);
                rightTerrainPositions.push(x, segment.y + heightOffset, segment.z);
            }

            if (i < game.road.segments.length - 1) {
                const j = i * 2;
                roadIndices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);

                const k = i * (terrainSteps + 1);
                for (let m = 0; m < terrainSteps; m++) {
                    leftTerrainIndices.push(
                        k + m, k + terrainSteps + 1 + m, k + m + 1,
                        k + m + 1, k + terrainSteps + 1 + m, k + terrainSteps + 2 + m
                    );
                    rightTerrainIndices.push(
                        k + m, k + terrainSteps + 1 + m, k + m + 1,
                        k + m + 1, k + terrainSteps + 1 + m, k + terrainSteps + 2 + m
                    );
                }
            }
        });

        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
        roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
        roadGeometry.setIndex(roadIndices);
        roadGeometry.computeVertexNormals();

        leftTerrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leftTerrainPositions, 3));
        leftTerrainGeometry.setIndex(leftTerrainIndices);
        leftTerrainGeometry.computeVertexNormals();

        rightTerrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rightTerrainPositions, 3));
        rightTerrainGeometry.setIndex(rightTerrainIndices);
        rightTerrainGeometry.computeVertexNormals();
    }

    updateGeometries();

    // Load road texture
    const textureLoader = new THREE.TextureLoader();
    const roadTexture = textureLoader.load('road_texture.png', () => {
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, game.road.segments.length);
    });

    const road = new THREE.Mesh(roadGeometry, new THREE.MeshPhongMaterial({ map: roadTexture }));
    road.receiveShadow = true;

    // Load sand texture for the desert terrain
    let terrainMaterial;

    terrainMaterial = new THREE.MeshPhongMaterial({
        color: environment.terrainColor,
        side: THREE.DoubleSide,
        flatShading: false
    });

    const leftTerrain = new THREE.Mesh(leftTerrainGeometry, terrainMaterial);
    const rightTerrain = new THREE.Mesh(rightTerrainGeometry, terrainMaterial);
    
    leftTerrain.receiveShadow = true;
    rightTerrain.receiveShadow = true;

    scene.add(road, leftTerrain, rightTerrain);

    // Place trees if the environment has any
    if (environment.treeDensity > 0) {
        const treeDensity = environment.treeDensity;
        const minDistanceBetweenTrees = 10;
        const trees = [];

        function createTree(x, y, z) {
            const tree = new THREE.Group();
            const trunkHeight = 2;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, trunkHeight, 8), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
            trunk.position.y = trunkHeight / 2;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            tree.add(trunk);
            
            const leavesHeight = 4;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, leavesHeight, 8), new THREE.MeshPhongMaterial({ color: 0x228B22 }));
            leaves.position.y = trunkHeight + leavesHeight / 2;
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            tree.add(leaves);
            
            tree.position.set(x, y, z);
            return tree;
        }

        function getTerrainHeightAt(x, z) {
            const segmentIndex = Math.floor(Math.abs(z) / segmentLength) % game.road.segments.length;
            const segment = game.road.segments[segmentIndex];
            const terrainWidth = game.terrain.width;
            const halfRoadWidth = game.road.width / 2;
            
            const distanceFromRoadCenter = Math.abs(x - segment.curve);
            const normalizedDistance = Math.min(Math.max((distanceFromRoadCenter - halfRoadWidth) / terrainWidth, 0), 1);
            
            const baseHeight = segment.y;
            const heightOffset = generateMountainHeight(x, z) * normalizedDistance;
            
            return baseHeight + heightOffset;
        }

        function placeTrees(startZ, endZ) {
            for (let z = startZ; z > endZ; z -= minDistanceBetweenTrees) {
                const segmentIndex = Math.floor(Math.abs(z) / segmentLength) % game.road.segments.length;
                const segment = game.road.segments[segmentIndex];
                const halfRoadWidth = game.road.width / 2;
                const terrainWidth = game.terrain.width;

                [-1, 1].forEach(side => {
                    if (Math.random() < treeDensity) {
                        let x;
                        if (side === -1) {
                            x = segment.curve - halfRoadWidth - Math.random() * terrainWidth;
                        } else {
                            x = segment.curve + halfRoadWidth + Math.random() * terrainWidth;
                        }

                        const y = getTerrainHeightAt(x, z);
                        
                        const tooClose = trees.some(tree => {
                            const dx = tree.position.x - x;
                            const dz = tree.position.z - z;
                            return Math.sqrt(dx * dx + dz * dz) < minDistanceBetweenTrees;
                        });

                        if (Math.abs(x - segment.curve) > halfRoadWidth + 5 && !tooClose) {
                            const tree = createTree(x, y, z);
                            trees.push(tree);
                            scene.add(tree);
                        }
                    }
                });
            }
        }

        placeTrees(0, game.finishLine * 10);
    }
    
    scene.background = new THREE.Color(environment.fogColor);
    scene.fog = new THREE.FogExp2(environment.fogColor, 0.002);

    function createRallyStructure(scene, game, zPosition, isFinishLine) {
        const poleHeight = 10;
        const poleWidth = 0.5;
        const poleDepth = 0.5;
        const bannerWidth = game.road.width; // Match the road's width
        const bannerHeight = 3;
    
        // Get the road data at the specified zPosition
        const roadData = getRoadDataAtZ(zPosition, game);
    
        // Create poles
        const poleGeometry = new THREE.BoxGeometry(poleWidth, poleHeight, poleDepth);
        const poleMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
        const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
    
        // Position poles
        leftPole.position.set(roadData.curve - bannerWidth / 2, roadData.y + poleHeight / 2, zPosition);
        rightPole.position.set(roadData.curve + bannerWidth / 2, roadData.y + poleHeight / 2, zPosition);
    
        // Load the appropriate texture
        const bannerTexture = textureLoader.load(isFinishLine ? 'assets/finish_banner.webp' : 'assets/start_banner.webp');
        
        // Flip the texture horizontally if needed
        bannerTexture.wrapS = THREE.RepeatWrapping;
        bannerTexture.repeat.x = -1;
    
        // Create banner
        const bannerGeometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight);
        const bannerMaterial = new THREE.MeshBasicMaterial({ map: bannerTexture, side: THREE.DoubleSide });
        const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
        banner.position.set(roadData.curve, roadData.y + poleHeight - bannerHeight / 2, zPosition);
    
        // Ensure the banner is facing the correct direction
        banner.rotation.y = Math.PI; // Rotate the banner to face the player
    
        // Add to scene
        scene.add(leftPole, rightPole, banner);
    
        if (isFinishLine) {
            // Add a finish line tape on the ground
            const lineGeometry = new THREE.PlaneGeometry(bannerWidth, 0.2);
            const lineMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
            const finishLine = new THREE.Mesh(lineGeometry, lineMaterial);
            finishLine.rotation.x = -Math.PI / 2;
            finishLine.position.set(roadData.curve, roadData.y + 0.1, zPosition);
            scene.add(finishLine);
        }
    }
    
    createRallyStructure(scene, game, game.startLine, false); // Place at the start line
    createRallyStructure(scene, game, game.finishLine, true); // Place at the finish line
}

function getRoadDataAtZ(z, game) {
    const segmentLength = 10;
    const index = Math.floor(Math.abs(z) / segmentLength) % game.road.segments.length;
    const nextIndex = (index + 1) % game.road.segments.length;
    const segment = game.road.segments[index];
    const nextSegment = game.road.segments[nextIndex];
    const t = (Math.abs(z) % segmentLength) / segmentLength;
    return {
        y: THREE.MathUtils.lerp(segment.y, nextSegment.y, t),
        curve: THREE.MathUtils.lerp(segment.curve, nextSegment.curve, t),
        curvatureAngle: THREE.MathUtils.lerp(segment.curvatureAngle, nextSegment.curvatureAngle, t)
    };
}
