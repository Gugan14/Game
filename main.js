import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===============
// SETUP
// ===============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.7; // Player height

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============
// LIGHTING
// ===============
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
scene.add(directionalLight);

// ===============
// GAME OBJECTS & WORLD
// ===============
const collidableObjects = []; // Array to store objects player can collide with

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // Forest green
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Player (Block Character)
const player = new THREE.Group();
const playerHeight = 1.8;
const playerWidth = 0.5;
// Torso
const torsoGeometry = new THREE.BoxGeometry(playerWidth, 0.7, 0.3);
const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff });
const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
torso.position.y = playerHeight - 0.75;
// Head (invisible, just a reference for the camera)
const head = new THREE.Object3D();
head.position.y = playerHeight - 0.1;
player.add(torso);
player.add(camera); // Attach camera to player group
player.position.set(0, 0.9, 10); // Start position
scene.add(player);

// Create bounding box for player collision
const playerBoundingBox = new THREE.Box3();

// Helper to create fences
function createFence(x, z, length, rotationY = 0) {
    const fenceGroup = new THREE.Group();
    const postHeight = 1.2;
    const postSize = 0.15;
    const railHeight = 0.1;
    const railWidth = 0.08;

    const material = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Saddle brown

    for (let i = 0; i <= length / 2; i++) {
        const postGeo = new THREE.BoxGeometry(postSize, postHeight, postSize);
        const post = new THREE.Mesh(postGeo, material);
        post.position.set(i * 2 - length / 2, postHeight / 2, 0);
        post.castShadow = true;
        fenceGroup.add(post);
        collidableObjects.push(post);
    }

    const railGeo = new THREE.BoxGeometry(length, railHeight, railWidth);
    const rail1 = new THREE.Mesh(railGeo, material);
    rail1.position.set(0, postHeight * 0.75, 0);
    rail1.castShadow = true;
    const rail2 = new THREE.Mesh(railGeo, material);
    rail2.position.set(0, postHeight * 0.4, 0);
    rail2.castShadow = true;
    
    fenceGroup.add(rail1, rail2);

    fenceGroup.position.set(x, 0, z);
    fenceGroup.rotation.y = rotationY;
    scene.add(fenceGroup);
}

// Helper to create a single garden plot
function createPlot(x, z) {
    const plotGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(6, 0.2, 10);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x966939 }); // Brown earth
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.receiveShadow = true;
    plotGroup.add(base);

    // Dividers
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x6F4E26 });
    const dividerGeoH = new THREE.BoxGeometry(6, 0.25, 0.1);
    const dividerGeoV = new THREE.BoxGeometry(0.1, 0.25, 10);

    for (let i = 1; i < 4; i++) {
        const divider = new THREE.Mesh(dividerGeoH, dividerMat);
        divider.position.y = 0.05;
        divider.position.z = i * 2.5 - 5;
        plotGroup.add(divider);
    }
    
    plotGroup.position.set(x, 0.1, z);
    scene.add(plotGroup);
    return plotGroup;
}

// Create 6 plots based on layout
const plotPositions = [
    { x: -7, z: 0 }, { x: 7, z: 0 },
    { x: -7, z: -15 }, { x: 7, z: -15 },
    { x: -7, z: -30 }, { x: 7, z: -30 }
];
const plots = plotPositions.map(pos => createPlot(pos.x, pos.z));

// Create Fences around plot area
createFence(0, 8, 22);
createFence(0, -38, 22);
createFence(11, -15, 46, Math.PI / 2);
createFence(-11, -15, 46, Math.PI / 2);

// Shops
function createShop(x, z, color, text) {
    const shopGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(5, 2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 1;
    base.castShadow = true;
    shopGroup.add(base);
    collidableObjects.push(base);

    // Simple sign (You could add text rendering here for more detail)
    const signGeo = new THREE.BoxGeometry(3, 1, 0.1);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 2.2, 1.55);
    shopGroup.add(sign);

    shopGroup.position.set(x, 0, z);
    scene.add(shopGroup);
    return shopGroup;
}

const seedShop = createShop(-15, 15, 0x3498db, "Seed Shop"); // Blue
const sellingPlace = createShop(15, 15, 0xe74c3c, "Sell Here"); // Red

// ===============
// GAME STATE & LOGIC
// ===============
const gameState = {
    coins: 100,
    inventory: {
        'watermelon_seed': 2,
        'watermelon': 0,
    },
    plots: Array(6).fill({
        plant: null, // e.g., 'watermelon'
        growth: 0, // 0 to 1
        plantedAt: 0,
    }),
    plantTypes: {
        'watermelon': {
            growthTime: 10, // in seconds
            sellPrice: 25,
            seedPrice: 10,
            mesh: new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0x34A853 })
            )
        }
    }
};

const plotObjects = []; // To store the 3D plant meshes

// UI Elements
const coinCountEl = document.getElementById('coin-count');
const interactionPromptEl = document.getElementById('interaction-prompt');
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

function updateCoinUI() {
    coinCountEl.textContent = gameState.coins;
}
updateCoinUI();

// ===============
// PLAYER CONTROLS
// ===============
const controls = new PointerLockControls(camera, renderer.domElement);

instructions.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    blocker.style.display = 'flex';
    instructions.style.display = '';
});

scene.add(controls.getObject());

const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
};

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': if (onGround) velocity.y += 10; break;
        case 'KeyE': handleInteraction(); break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

// Teleport Buttons
document.getElementById('teleport-garden').addEventListener('click', () => player.position.set(0, 0.9, 5));
document.getElementById('teleport-shop').addEventListener('click', () => player.position.set(-15, 0.9, 12));
document.getElementById('teleport-seller').addEventListener('click', () => player.position.set(15, 0.9, 12));

// ===============
// PHYSICS & MOVEMENT
// ===============
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const gravity = 30;
let onGround = false;

// Pre-calculate bounding boxes for static objects
const staticBoundingBoxes = collidableObjects.map(obj => {
    const box = new THREE.Box3();
    // Ensure matrix is up to date before getting bounding box
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    return box;
});

function updatePlayer(delta) {
    const moveSpeed = 5.0;

    // Stop momentum
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    
    // Apply gravity
    velocity.y -= gravity * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize(); // ensures consistent movement speed in all directions

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * moveSpeed * delta * 10;
    if (moveState.left || moveState.right) velocity.x -= direction.x * moveSpeed * delta * 10;
    
    // Move player based on camera direction
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    
    // Handle Y-axis movement (jumping/falling)
    player.position.y += velocity.y * delta;

    // Simple ground check
    if (player.position.y < 0.9) {
        velocity.y = 0;
        player.position.y = 0.9;
        onGround = true;
    } else {
        onGround = false;
    }

    // --- Collision Detection ---
    playerBoundingBox.setFromCenterAndSize(
        player.position,
        new THREE.Vector3(playerWidth, playerHeight, playerWidth)
    );

    for (const box of staticBoundingBoxes) {
        if (playerBoundingBox.intersectsBox(box)) {
            // Very simple collision response: push player back
            const overlap = playerBoundingBox.intersect(box);
            const overlapSize = new THREE.Vector3();
            overlap.getSize(overlapSize);

            if (overlapSize.x < overlapSize.z) {
                const sign = Math.sign(player.position.x - box.getCenter(new THREE.Vector3()).x);
                player.position.x += overlapSize.x * sign;
            } else {
                const sign = Math.sign(player.position.z - box.getCenter(new THREE.Vector3()).z);
                player.position.z += overlapSize.z * sign;
            }
        }
    }
}


// ===============
// INTERACTION LOGIC
// ===============
let nearestInteractable = null;

function checkInteractions() {
    nearestInteractable = null;
    let minDistance = 2.5; // Interaction radius
    
    // Check plots
    plots.forEach((plot, index) => {
        const distance = player.position.distanceTo(plot.position);
        if (distance < minDistance) {
            minDistance = distance;
            nearestInteractable = { type: 'plot', index: index, plot: plot };
        }
    });

    // Check seed shop
    const shopDist = player.position.distanceTo(seedShop.position);
    if (shopDist < 4 && shopDist < minDistance) {
        minDistance = shopDist;
        nearestInteractable = { type: 'seed_shop' };
    }

    // Check selling place
    const sellerDist = player.position.distanceTo(sellingPlace.position);
    if (sellerDist < 4 && sellerDist < minDistance) {
        minDistance = sellerDist;
        nearestInteractable = { type: 'selling_place' };
    }

    // Update UI prompt
    if (nearestInteractable) {
        interactionPromptEl.classList.remove('hidden');
        if (nearestInteractable.type === 'plot') {
            const plotState = gameState.plots[nearestInteractable.index];
            if (!plotState.plant) {
                 interactionPromptEl.textContent = `[E] Plant Watermelon (Seeds: ${gameState.inventory.watermelon_seed})`;
            } else if (plotState.growth >= 1) {
                interactionPromptEl.textContent = `[E] Harvest Watermelon`;
            } else {
                 interactionPromptEl.textContent = `Growing... (${Math.round(plotState.growth * 100)}%)`;
            }
        } else if (nearestInteractable.type === 'seed_shop') {
             interactionPromptEl.textContent = `[E] Buy Watermelon Seed ($${gameState.plantTypes.watermelon.seedPrice})`;
        } else if (nearestInteractable.type === 'selling_place') {
            interactionPromptEl.textContent = `[E] Sell Watermelon ($${gameState.plantTypes.watermelon.sellPrice} each)`;
        }
    } else {
        interactionPromptEl.classList.add('hidden');
    }
}

function handleInteraction() {
    if (!nearestInteractable) return;

    const type = nearestInteractable.type;
    
    if (type === 'plot') {
        const index = nearestInteractable.index;
        const plotState = gameState.plots[index];
        if (!plotState.plant && gameState.inventory.watermelon_seed > 0) {
            // Plant a seed
            gameState.inventory.watermelon_seed--;
            gameState.plots[index] = { plant: 'watermelon', growth: 0, plantedAt: Date.now() };
        } else if (plotState.plant && plotState.growth >= 1) {
            // Harvest a plant
            gameState.inventory[plotState.plant]++;
            gameState.plots[index] = { plant: null, growth: 0, plantedAt: 0 };
            
            // Remove 3D model
            const plantMesh = plotObjects[index];
            if (plantMesh) scene.remove(plantMesh);
            plotObjects[index] = null;
        }

    } else if (type === 'seed_shop') {
        const cost = gameState.plantTypes.watermelon.seedPrice;
        if (gameState.coins >= cost) {
            gameState.coins -= cost;
            gameState.inventory.watermelon_seed++;
            updateCoinUI();
        } else {
            // Optional: Add a message that they don't have enough money
            interactionPromptEl.textContent = "Not enough coins!";
            setTimeout(() => interactionPromptEl.classList.add('hidden'), 2000);
        }

    } else if (type === 'selling_place') {
        const numToSell = gameState.inventory.watermelon;
        if (numToSell > 0) {
            const earnings = numToSell * gameState.plantTypes.watermelon.sellPrice;
            gameState.coins += earnings;
            gameState.inventory.watermelon = 0;
            updateCoinUI();
        }
    }
}

function updateGameLogic(delta) {
    gameState.plots.forEach((plot, index) => {
        if (plot.plant && plot.growth < 1) {
            const elapsedTime = (Date.now() - plot.plantedAt) / 1000;
            const growthTime = gameState.plantTypes[plot.plant].growthTime;
            plot.growth = Math.min(1, elapsedTime / growthTime);

            // Update or create 3D model for the plant
            let plantMesh = plotObjects[index];
            if (!plantMesh) {
                const plantInfo = gameState.plantTypes[plot.plant];
                plantMesh = plantInfo.mesh.clone();
                plantMesh.position.copy(plots[index].position);
                plantMesh.position.y += 0.3; // Sit on top of plot
                plantMesh.castShadow = true;
                scene.add(plantMesh);
                plotObjects[index] = plantMesh;
            }
            
            // Animate growth by scaling
            plantMesh.scale.setScalar(plot.growth);
        }
    });
}


// ===============
// ANIMATION LOOP
// ===============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (controls.isLocked) {
        updatePlayer(delta);
        checkInteractions();
        updateGameLogic(delta);
    }

    renderer.render(scene, camera);
}

animate();
