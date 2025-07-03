import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===============
// DEVICE DETECTION
// ===============
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ===============
// SETUP (scene, camera, renderer - no changes)
// ===============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.7;

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============
// LIGHTING (no changes)
// ===============
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// ===============
// GAME OBJECTS & WORLD (no changes)
// ===============
const collidableObjects = [];

const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const player = new THREE.Group();
const playerHeight = 1.8;
const playerWidth = 0.5;
const torsoGeometry = new THREE.BoxGeometry(playerWidth, 0.7, 0.3);
const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff });
const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
torso.position.y = playerHeight - 0.75;
player.add(torso);
player.add(camera);
player.position.set(0, 0.9, 10);
scene.add(player);

const playerBoundingBox = new THREE.Box3();

function createFence(x, z, length, rotationY = 0) {
    const fenceGroup = new THREE.Group();
    const postHeight = 1.2, postSize = 0.15, railHeight = 0.1, railWidth = 0.08;
    const material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    for (let i = 0; i <= length / 2; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postHeight, postSize), material);
        post.position.set(i * 2 - length / 2, postHeight / 2, 0); post.castShadow = true;
        fenceGroup.add(post); collidableObjects.push(post);
    }
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(length, railHeight, railWidth), material); rail1.position.set(0, postHeight * 0.75, 0); rail1.castShadow = true;
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(length, railHeight, railWidth), material); rail2.position.set(0, postHeight * 0.4, 0); rail2.castShadow = true;
    fenceGroup.add(rail1, rail2);
    fenceGroup.position.set(x, 0, z); fenceGroup.rotation.y = rotationY;
    scene.add(fenceGroup);
}

function createPlot(x, z) {
    const plotGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x966939 })); base.receiveShadow = true; plotGroup.add(base);
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x6F4E26 });
    for (let i = 1; i < 4; i++) {
        const divider = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.1), dividerMat);
        divider.position.set(0, 0.05, i * 2.5 - 5); plotGroup.add(divider);
    }
    plotGroup.position.set(x, 0.1, z); scene.add(plotGroup); return plotGroup;
}

const plotPositions = [{ x: -7, z: 0 }, { x: 7, z: 0 }, { x: -7, z: -15 }, { x: 7, z: -15 }, { x: -7, z: -30 }, { x: 7, z: -30 }];
const plots = plotPositions.map(pos => createPlot(pos.x, pos.z));

createFence(0, 8, 22); createFence(0, -38, 22);
createFence(11, -15, 46, Math.PI / 2); createFence(-11, -15, 46, Math.PI / 2);

function createShop(x, z, color, text) {
    const shopGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 3), new THREE.MeshStandardMaterial({ color }));
    base.position.y = 1; base.castShadow = true; shopGroup.add(base); collidableObjects.push(base);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    sign.position.set(0, 2.2, 1.55); shopGroup.add(sign);
    shopGroup.position.set(x, 0, z); scene.add(shopGroup); return shopGroup;
}

const seedShop = createShop(-15, 15, 0x3498db, "Seed Shop");
const sellingPlace = createShop(15, 15, 0xe74c3c, "Sell Here");

// ===============
// GAME STATE & LOGIC (no changes)
// ===============
const gameState = { coins: 100, inventory: { 'watermelon_seed': 2, 'watermelon': 0 }, plots: Array(6).fill({ plant: null, growth: 0, plantedAt: 0 }), plantTypes: { 'watermelon': { growthTime: 10, sellPrice: 25, seedPrice: 10, mesh: new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x34A853 }))}}};
const plotObjects = [];

const coinCountEl = document.getElementById('coin-count');
const interactionPromptEl = document.getElementById('interaction-prompt');
function updateCoinUI() { coinCountEl.textContent = gameState.coins; }
updateCoinUI();

// ===============
// CONTROLS
// ===============
let controls;
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
let gameActive = false;

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let onGround = true;

if (isMobile) {
    // --- Mobile Controls Setup ---
    document.getElementById('mobile-controls').classList.remove('hidden');
    const joystick = document.getElementById('joystick');
    const joystickArea = document.getElementById('joystick-area');

    blocker.addEventListener('click', () => {
        gameActive = true;
        blocker.style.display = 'none';
    });

    // Joystick logic
    let joystickStartPos = { x: 0, y: 0 };
    let joystickVector = { x: 0, y: 0 };

    joystickArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickStartPos.x = e.touches[0].clientX;
        joystickStartPos.y = e.touches[0].clientY;
    }, { passive: false });

    joystickArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        joystickVector.x = touch.clientX - joystickStartPos.x;
        joystickVector.y = touch.clientY - joystickStartPos.y;

        const magnitude = Math.sqrt(joystickVector.x**2 + joystickVector.y**2);
        const maxMagnitude = joystickArea.clientWidth / 4;
        if (magnitude > maxMagnitude) {
            joystickVector.x = (joystickVector.x / magnitude) * maxMagnitude;
            joystickVector.y = (joystickVector.y / magnitude) * maxMagnitude;
        }

        joystick.style.transform = `translate(${joystickVector.x}px, ${joystickVector.y}px)`;
        
        const angle = Math.atan2(joystickVector.x, joystickVector.y);
        moveState.forward = joystickVector.y < -10;
        moveState.backward = joystickVector.y > 10;
        moveState.left = joystickVector.x < -10;
        moveState.right = joystickVector.x > 10;

    }, { passive: false });

    joystickArea.addEventListener('touchend', (e) => {
        joystick.style.transform = `translate(0px, 0px)`;
        moveState.forward = false; moveState.backward = false;
        moveState.left = false; moveState.right = false;
    });

    // Camera look logic
    let lookStartX = 0, lookStartY = 0;
    renderer.domElement.addEventListener('touchstart', (e) => {
        if (e.target.closest('#mobile-controls')) return; // Ignore touches on controls
        lookStartX = e.touches[0].clientX;
        lookStartY = e.touches[0].clientY;
    });

    renderer.domElement.addEventListener('touchmove', (e) => {
        if (e.target.closest('#mobile-controls')) return;
        const lookDeltaX = e.touches[0].clientX - lookStartX;
        const lookDeltaY = e.touches[0].clientY - lookStartY;
        lookStartX = e.touches[0].clientX;
        lookStartY = e.touches[0].clientY;
        
        player.rotation.y -= lookDeltaX * 0.002;
        camera.rotation.x -= lookDeltaY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    });

    // Action buttons
    document.getElementById('jump-button').addEventListener('touchstart', () => { if (onGround) velocity.y += 10; });
    document.getElementById('interact-button-mobile').addEventListener('touchstart', handleInteraction);

} else {
    // --- Desktop Controls Setup ---
    controls = new PointerLockControls(camera, renderer.domElement);
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => { gameActive = true; instructions.style.display = 'none'; blocker.style.display = 'none'; });
    controls.addEventListener('unlock', () => { gameActive = false; blocker.style.display = 'flex'; instructions.style.display = ''; });
    scene.add(controls.getObject());

    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': moveState.forward = true; break;
            case 'KeyS': moveState.backward = true; break;
            case 'KeyA': moveState.left = true; break;
            case 'KeyD': moveState.right = true; break;
            case 'Space': if (onGround) velocity.y += 10; break;
            case 'KeyE': handleInteraction(); break;
        }
    });
    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveState.forward = false; break;
            case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break;
            case 'KeyD': moveState.right = false; break;
        }
    });
}

// Teleport Buttons (work on both)
document.getElementById('teleport-garden').addEventListener('click', () => player.position.set(0, 0.9, 5));
document.getElementById('teleport-shop').addEventListener('click', () => player.position.set(-15, 0.9, 12));
document.getElementById('teleport-seller').addEventListener('click', () => player.position.set(15, 0.9, 12));


// ===============
// PHYSICS & MOVEMENT (modified to work for both)
// ===============
const gravity = 30;
const staticBoundingBoxes = collidableObjects.map(obj => {
    const box = new THREE.Box3(); obj.updateMatrixWorld(true); box.setFromObject(obj); return box;
});

function updatePlayer(delta) {
    const moveSpeed = 5.0;
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= gravity * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.left) - Number(moveState.right);
    direction.normalize();

    // Rotate movement vector by player's rotation
    const moveX = (direction.x * Math.cos(player.rotation.y) + direction.z * Math.sin(player.rotation.y)) * moveSpeed * delta;
    const moveZ = (direction.z * Math.cos(player.rotation.y) - direction.x * Math.sin(player.rotation.y)) * moveSpeed * delta;
    
    player.position.x -= moveX;
    player.position.z -= moveZ;
    player.position.y += velocity.y * delta;

    if (player.position.y < 0.9) {
        velocity.y = 0; player.position.y = 0.9; onGround = true;
    } else {
        onGround = false;
    }

    playerBoundingBox.setFromCenterAndSize(player.position, new THREE.Vector3(playerWidth, playerHeight, playerWidth));
    for (const box of staticBoundingBoxes) {
        if (playerBoundingBox.intersectsBox(box)) {
            const overlap = playerBoundingBox.intersect(box); const overlapSize = new THREE.Vector3(); overlap.getSize(overlapSize);
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
// INTERACTION & GAME LOGIC (no changes)
// ===============
let nearestInteractable = null;
function checkInteractions() {
    nearestInteractable = null; let minDistance = 2.5;
    plots.forEach((plot, index) => { const distance = player.position.distanceTo(plot.position); if (distance < minDistance) { minDistance = distance; nearestInteractable = { type: 'plot', index: index }; } });
    const shopDist = player.position.distanceTo(seedShop.position); if (shopDist < 4 && shopDist < minDistance) { minDistance = shopDist; nearestInteractable = { type: 'seed_shop' }; }
    const sellerDist = player.position.distanceTo(sellingPlace.position); if (sellerDist < 4 && sellerDist < minDistance) { nearestInteractable = { type: 'selling_place' }; }

    if (nearestInteractable) {
        interactionPromptEl.classList.remove('hidden');
        if (nearestInteractable.type === 'plot') {
            const plotState = gameState.plots[nearestInteractable.index];
            if (!plotState.plant) { interactionPromptEl.textContent = `[E] Plant Watermelon (Seeds: ${gameState.inventory.watermelon_seed})`; }
            else if (plotState.growth >= 1) { interactionPromptEl.textContent = `[E] Harvest Watermelon`; }
            else { interactionPromptEl.textContent = `Growing... (${Math.round(plotState.growth * 100)}%)`; }
        } else if (nearestInteractable.type === 'seed_shop') { interactionPromptEl.textContent = `[E] Buy Watermelon Seed ($${gameState.plantTypes.watermelon.seedPrice})`; }
        else if (nearestInteractable.type === 'selling_place') { interactionPromptEl.textContent = `[E] Sell Watermelon ($${gameState.plantTypes.watermelon.sellPrice} each)`; }
    } else { interactionPromptEl.classList.add('hidden'); }
}

function handleInteraction() {
    if (!nearestInteractable) return; const type = nearestInteractable.type;
    if (type === 'plot') {
        const index = nearestInteractable.index; const plotState = gameState.plots[index];
        if (!plotState.plant && gameState.inventory.watermelon_seed > 0) { gameState.inventory.watermelon_seed--; gameState.plots[index] = { plant: 'watermelon', growth: 0, plantedAt: Date.now() }; }
        else if (plotState.plant && plotState.growth >= 1) { gameState.inventory[plotState.plant]++; gameState.plots[index] = { plant: null, growth: 0, plantedAt: 0 }; if (plotObjects[index]) scene.remove(plotObjects[index]); plotObjects[index] = null; }
    } else if (type === 'seed_shop') {
        const cost = gameState.plantTypes.watermelon.seedPrice;
        if (gameState.coins >= cost) { gameState.coins -= cost; gameState.inventory.watermelon_seed++; updateCoinUI(); }
        else { interactionPromptEl.textContent = "Not enough coins!"; setTimeout(() => interactionPromptEl.classList.add('hidden'), 2000); }
    } else if (type === 'selling_place') {
        const numToSell = gameState.inventory.watermelon;
        if (numToSell > 0) { const earnings = numToSell * gameState.plantTypes.watermelon.sellPrice; gameState.coins += earnings; gameState.inventory.watermelon = 0; updateCoinUI(); }
    }
}

function updateGameLogic(delta) {
    gameState.plots.forEach((plot, index) => {
        if (plot.plant && plot.growth < 1) {
            const elapsedTime = (Date.now() - plot.plantedAt) / 1000;
            const growthTime = gameState.plantTypes[plot.plant].growthTime;
            plot.growth = Math.min(1, elapsedTime / growthTime);
            let plantMesh = plotObjects[index];
            if (!plantMesh) {
                plantMesh = gameState.plantTypes[plot.plant].mesh.clone(); plantMesh.position.copy(plots[index].position);
                plantMesh.position.y += 0.3; plantMesh.castShadow = true; scene.add(plantMesh); plotObjects[index] = plantMesh;
            }
            plantMesh.scale.setScalar(plot.growth);
        }
    });
}

// ===============
// ANIMATION LOOP (modified)
// ===============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (gameActive) {
        updatePlayer(delta);
        checkInteractions();
        updateGameLogic(delta);
    }
    renderer.render(scene, camera);
}

animate();
