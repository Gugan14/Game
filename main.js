import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===============
// INITIAL SETUP
// ===============
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

// ===============
// UI ELEMENTS
// ===============
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const coinCountEl = document.getElementById('coin-count');
const inventoryBarEl = document.getElementById('inventory-bar');
const holdPromptEl = document.getElementById('hold-prompt');
const progressCircle = holdPromptEl.querySelector('.progress-ring-circle');
const circleRadius = progressCircle.r.baseVal.value;
const circumference = circleRadius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// Modals
const seedShopUI = document.getElementById('seed-shop-ui');
const sellerUI = document.getElementById('seller-ui');

// ===============
// GAME STATE
// ===============
const INVENTORY_SIZE = 8;
let gameActive = false;
let controls;

const gameState = {
    coins: 100,
    inventory: new Array(INVENTORY_SIZE).fill(null),
    selectedSlot: 0,
    get heldItem() { return this.inventory[this.selectedSlot]; },
    plantTypes: {
        'watermelon': { growthTime: 20, sellPrice: 25, seedPrice: 10, icon: '🍉',
            createMesh: () => new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x34A853 }))
        },
    },
};
gameState.inventory[0] = { name: 'watermelon_seed', quantity: 5, icon: '🌱' };

// ===============
// WORLD & OBJECTS
// ===============
const collidableObjects = [];
const plantablePlots = [];
const plantedObjects = [];
let heldItemMesh = null;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Ground
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Player
const player = new THREE.Group();
const playerHeight = 1.8;
const playerWidth = 0.5;
player.position.set(0, playerHeight / 2, 10);
scene.add(player);
camera.position.y = playerHeight * 0.9;
player.add(camera);

// Create single plot with internal dividers
function createPlot(x, z) {
    const plotGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(6, 0.2, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x966939 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.receiveShadow = true;
    plotGroup.add(base);
    plantablePlots.push(base); // Add base mesh for raycasting

    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x6F4E26 });
    for (let i = 1; i < 4; i++) { // Horizontal dividers
        const divider = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.1), dividerMat);
        divider.position.z = i * 3 - 6; plotGroup.add(divider);
    }
    const centerDivider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 12), dividerMat); // Vertical divider
    plotGroup.add(centerDivider);

    plotGroup.position.set(x, 0.1, z);
    scene.add(plotGroup);
}

// Create Fences
function createFence(x, z, length, rotationY = 0) { /* ... (code from previous version) ... */
    const fenceGroup = new THREE.Group(); const postHeight = 1.2, postSize = 0.15, railHeight = 0.1, railWidth = 0.08;
    const material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    for (let i = 0; i <= length / 2; i++) { const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postHeight, postSize), material); post.position.set(i * 2 - length / 2, postHeight / 2, 0); post.castShadow = true; fenceGroup.add(post); collidableObjects.push(post); }
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(length, railHeight, railWidth), material); rail1.position.set(0, postHeight * 0.75, 0); rail1.castShadow = true;
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(length, railHeight, railWidth), material); rail2.position.set(0, postHeight * 0.4, 0); rail2.castShadow = true; fenceGroup.add(rail1, rail2);
    fenceGroup.position.set(x, 0, z); fenceGroup.rotation.y = rotationY; scene.add(fenceGroup);
}

// Create 6 Plots
const plotPositions = [ { x: -7, z: 0 }, { x: 7, z: 0 }, { x: -7, z: -15 }, { x: 7, z: -15 }, { x: -7, z: -30 }, { x: 7, z: -30 } ];
plotPositions.forEach(pos => createPlot(pos.x, pos.z));
createFence(0, 8, 22); createFence(0, -38, 22); createFence(11.5, -15, 46, Math.PI / 2); createFence(-11.5, -15, 46, Math.PI / 2);

// Shops
function createShop(x, z, color) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 3), new THREE.MeshStandardMaterial({ color }));
    base.position.set(x, 1, z); base.castShadow = true;
    collidableObjects.push(base); scene.add(base); return base;
}
const seedShop = createShop(-15, 15, 0x3498db);
const sellingPlace = createShop(15, 15, 0xe74c3c);


// ===============
// UI FUNCTIONS
// ===============
function updateCoinUI() { coinCountEl.textContent = gameState.coins; }

function updateInventoryUI() {
    inventoryBarEl.innerHTML = '';
    gameState.inventory.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        if (index === gameState.selectedSlot) slot.classList.add('selected');
        if (item) {
            slot.textContent = item.icon;
            const quantity = document.createElement('div');
            quantity.className = 'item-quantity';
            quantity.textContent = item.quantity;
            slot.appendChild(quantity);
        }
        slot.addEventListener('click', () => { selectInventorySlot(index); });
        inventoryBarEl.appendChild(slot);
    });
}

function selectInventorySlot(index) {
    gameState.selectedSlot = index;
    updateInventoryUI();
    updateHeldItem();
}

function updateHeldItem() {
    if (heldItemMesh) { camera.remove(heldItemMesh); heldItemMesh = null; }
    const item = gameState.heldItem;
    if (!item) return;

    if (item.name.includes('_seed')) {
        const plantType = item.name.replace('_seed', '');
        heldItemMesh = gameState.plantTypes[plantType].createMesh();
        heldItemMesh.scale.set(0.1, 0.1, 0.1); // Small seed representation
    } else {
        heldItemMesh = gameState.plantTypes[item.name].createMesh();
        heldItemMesh.scale.set(0.3, 0.3, 0.3);
    }
    heldItemMesh.position.set(0.5, -0.4, -1);
    camera.add(heldItemMesh);
}

function setProgress(percent) {
    const offset = circumference - (percent / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
}

function openModal(modal) {
    modal.classList.remove('hidden');
    gameActive = false;
    if (controls) controls.unlock();
}

function closeModal(modal) {
    modal.classList.add('hidden');
    gameActive = true;
    if (controls && isMobile === false) controls.lock();
}

// Shop Modal Logic
seedShopUI.querySelector('.modal-close-button').addEventListener('click', () => closeModal(seedShopUI));
function openShopUI() {
    const list = seedShopUI.querySelector('#shop-item-list');
    list.innerHTML = '';
    for (const key in gameState.plantTypes) {
        const plant = gameState.plantTypes[key];
        const itemEl = document.createElement('div');
        itemEl.className = 'shop-item';
        itemEl.innerHTML = `<span>${plant.icon} ${key} Seed ($${plant.seedPrice})</span><button data-plant="${key}">Buy</button>`;
        list.appendChild(itemEl);
    }
    openModal(seedShopUI);
}
seedShopUI.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.plant) {
        buySeed(e.target.dataset.plant);
    }
});

function buySeed(plantName) {
    const plant = gameState.plantTypes[plantName];
    if (gameState.coins >= plant.seedPrice) {
        gameState.coins -= plant.seedPrice;
        addInventoryItem(`${plantName}_seed`, 1, '🌱');
        updateCoinUI();
        updateInventoryUI();
    } else {
        // Optional: show "not enough coins" message
    }
}

// Seller Modal Logic
sellerUI.querySelector('.modal-close-button').addEventListener('click', () => closeModal(sellerUI));
function openSellerUI() {
    // Update button text based on current state
    const heldItem = gameState.heldItem;
    const sellHeldBtn = document.getElementById('sell-held-button');
    if (heldItem && !heldItem.name.includes('_seed')) {
        sellHeldBtn.textContent = `Sell Held ${heldItem.icon} (${heldItem.quantity})`;
        sellHeldBtn.disabled = false;
    } else {
        sellHeldBtn.textContent = 'Hold a fruit to sell';
        sellHeldBtn.disabled = true;
    }
    // Calculate total value of all fruits
    let totalValue = 0;
    let fruitCount = 0;
    gameState.inventory.forEach(item => {
        if (item && !item.name.includes('_seed')) {
            totalValue += item.quantity * gameState.plantTypes[item.name].sellPrice;
            fruitCount += item.quantity;
        }
    });
    document.getElementById('sell-all-button').textContent = `Sell All Fruits (${fruitCount}) for $${totalValue}`;

    openModal(sellerUI);
}

document.getElementById('sell-held-button').addEventListener('click', () => {
    const item = gameState.heldItem;
    if (item && !item.name.includes('_seed')) {
        gameState.coins += item.quantity * gameState.plantTypes[item.name].sellPrice;
        removeInventoryItem(gameState.selectedSlot, item.quantity);
        updateCoinUI(); updateInventoryUI(); updateHeldItem();
        closeModal(sellerUI);
    }
});

document.getElementById('sell-all-button').addEventListener('click', () => {
    let earnings = 0;
    for (let i = 0; i < gameState.inventory.length; i++) {
        const item = gameState.inventory[i];
        if (item && !item.name.includes('_seed')) {
            earnings += item.quantity * gameState.plantTypes[item.name].sellPrice;
            removeInventoryItem(i, item.quantity);
        }
    }
    gameState.coins += earnings;
    updateCoinUI(); updateInventoryUI(); updateHeldItem();
    closeModal(sellerUI);
});


// ===============
// CORE GAMEPLAY & INTERACTION
// ===============
function addInventoryItem(name, quantity, icon) {
    // Try to stack with existing items
    for (const item of gameState.inventory) {
        if (item && item.name === name) {
            item.quantity += quantity;
            return;
        }
    }
    // Find an empty slot
    const emptySlotIndex = gameState.inventory.findIndex(item => item === null);
    if (emptySlotIndex !== -1) {
        gameState.inventory[emptySlotIndex] = { name, quantity, icon };
    }
}

function removeInventoryItem(slotIndex, quantity) {
    const item = gameState.inventory[slotIndex];
    if (item) {
        item.quantity -= quantity;
        if (item.quantity <= 0) {
            gameState.inventory[slotIndex] = null;
        }
    }
}

function handlePrimaryAction(event) {
    if (!gameActive) return;

    const pointer = new THREE.Vector2();
    if (event.type === 'click') {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    } else { return; } // Mobile tap handled differently or not at all for this action

    raycaster.setFromCamera(pointer, camera);

    // Check for harvesting
    const intersectsHarvest = raycaster.intersectObjects(plantedObjects);
    for (const intersect of intersectsHarvest) {
        const plant = intersect.object;
        if (plant.userData.growth >= 1) {
            addInventoryItem(plant.userData.plantType, 1, gameState.plantTypes[plant.userData.plantType].icon);
            scene.remove(plant);
            plantedObjects.splice(plantedObjects.indexOf(plant), 1);
            updateInventoryUI();
            return; // Only harvest one at a time
        }
    }

    // Check for planting
    const heldItem = gameState.heldItem;
    if (heldItem && heldItem.name.includes('_seed')) {
        const intersectsPlot = raycaster.intersectObjects(plantablePlots);
        if (intersectsPlot.length > 0) {
            const intersectionPoint = intersectsPlot[0].point;
            // Prevent planting too close to another plant
            const tooClose = plantedObjects.some(p => p.position.distanceTo(intersectionPoint) < 1.0);
            if (!tooClose) {
                plantSeed(heldItem.name.replace('_seed', ''), intersectionPoint);
                removeInventoryItem(gameState.selectedSlot, 1);
                updateInventoryUI();
            }
        }
    }
}

function plantSeed(plantType, position) {
    const plantInfo = gameState.plantTypes[plantType];
    const newPlant = plantInfo.createMesh();
    newPlant.position.copy(position);
    newPlant.position.y += 0.3; // Sit on plot
    newPlant.castShadow = true;
    newPlant.userData = { plantType, plantedAt: clock.getElapsedTime(), growth: 0 };
    newPlant.scale.setScalar(0.01); // Start small
    plantedObjects.push(newPlant);
    scene.add(newPlant);
}


// ===============
// CONTROLS & MOVEMENT
// ===============
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
let onGround = true;
const holdState = { holding: false, startTime: 0, duration: 1.0, target: null };
let nearestInteractable = null;

if (isMobile) {
    // --- Mobile Controls ---
    document.getElementById('mobile-controls').classList.remove('hidden');
    const joystick = document.getElementById('joystick'), joystickArea = document.getElementById('joystick-area');
    const lookArea = document.getElementById('look-area');
    blocker.addEventListener('click', () => { gameActive = true; blocker.style.display = 'none'; });

    let joystickStartPos = { x: 0, y: 0 }, joystickVector = { x: 0, y: 0 };
    joystickArea.addEventListener('touchstart', e => { joystickStartPos.x = e.touches[0].clientX; joystickStartPos.y = e.touches[0].clientY; }, { passive: false });
    joystickArea.addEventListener('touchmove', e => {
        const touch = e.touches[0]; joystickVector.x = touch.clientX - joystickStartPos.x; joystickVector.y = touch.clientY - joystickStartPos.y;
        const mag = Math.min(joystickArea.clientWidth / 4, Math.sqrt(joystickVector.x**2 + joystickVector.y**2));
        const angle = Math.atan2(joystickVector.x, joystickVector.y);
        joystick.style.transform = `translate(${Math.cos(angle) * mag}px, ${Math.sin(angle) * mag}px)`;
        moveState.forward = joystickVector.y < -10; moveState.backward = joystickVector.y > 10;
        moveState.left = joystickVector.x < -10; moveState.right = joystickVector.x > 10;
    }, { passive: false });
    joystickArea.addEventListener('touchend', e => { joystick.style.transform = `translate(0px, 0px)`; Object.keys(moveState).forEach(k => moveState[k] = false); });

    let lookStartX = 0, lookStartY = 0;
    lookArea.addEventListener('touchstart', e => { lookStartX = e.touches[0].clientX; lookStartY = e.touches[0].clientY; });
    lookArea.addEventListener('touchmove', e => {
        const dx = e.touches[0].clientX - lookStartX; const dy = e.touches[0].clientY - lookStartY;
        lookStartX = e.touches[0].clientX; lookStartY = e.touches[0].clientY;
        player.rotation.y -= dx * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x - dy * 0.002));
    });

    document.getElementById('jump-button-mobile').addEventListener('click', () => { if (onGround) velocity.y += 10; });
    renderer.domElement.addEventListener('click', handlePrimaryAction);
    holdPromptEl.addEventListener('touchstart', e => { e.preventDefault(); if (nearestInteractable) { holdState.holding = true; holdState.startTime = clock.getElapsedTime(); holdState.target = nearestInteractable.type; } });
    holdPromptEl.addEventListener('touchend', e => { holdState.holding = false; setProgress(0); });
} else {
    // --- Desktop Controls ---
    controls = new PointerLockControls(camera, document.body);
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => { gameActive = true; blocker.style.display = 'none'; });
    controls.addEventListener('unlock', () => { gameActive = false; blocker.style.display = 'flex'; });
    document.addEventListener('keydown', e => {
        if (!gameActive) return;
        switch (e.code) {
            case 'KeyW': moveState.forward = true; break; case 'KeyS': moveState.backward = true; break;
            case 'KeyA': moveState.left = true; break; case 'KeyD': moveState.right = true; break;
            case 'Space': if (onGround) velocity.y += 10; break;
            case 'KeyE': if (nearestInteractable && !holdState.holding) { holdState.holding = true; holdState.startTime = clock.getElapsedTime(); holdState.target = nearestInteractable.type; } break;
        }
    });
    document.addEventListener('keyup', e => {
        switch (e.code) {
            case 'KeyW': moveState.forward = false; break; case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break; case 'KeyD': moveState.right = false; break;
            case 'KeyE': holdState.holding = false; setProgress(0); break;
        }
    });
    renderer.domElement.addEventListener('click', handlePrimaryAction);
}

// Teleport Buttons
document.getElementById('teleport-garden').addEventListener('click', () => player.position.set(0, playerHeight / 2, 5));
document.getElementById('teleport-shop').addEventListener('click', () => player.position.set(-15, playerHeight / 2, 12));
document.getElementById('teleport-seller').addEventListener('click', () => player.position.set(15, playerHeight / 2, 12));


// ===============
// UPDATE & ANIMATION LOOP
// ===============
function updatePlayer(delta) { /* ... (Movement and collision code mostly unchanged from previous version) ... */
    const moveSpeed = 5.0; const gravity = 30;
    velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta; velocity.y -= gravity * delta;
    const direction = new THREE.Vector3(Number(moveState.right) - Number(moveState.left), 0, Number(moveState.backward) - Number(moveState.forward)).normalize();
    if(isMobile){
        const moveX = (direction.x * Math.cos(player.rotation.y) + direction.z * Math.sin(player.rotation.y)) * moveSpeed;
        const moveZ = (direction.z * Math.cos(player.rotation.y) - direction.x * Math.sin(player.rotation.y)) * moveSpeed;
        player.position.x += moveX * delta; player.position.z += moveZ * delta;
    } else {
        if(controls.isLocked){ controls.moveRight(direction.x * moveSpeed * delta); controls.moveForward(direction.z * moveSpeed * delta); }
    }
    player.position.y += velocity.y * delta;
    if (player.position.y < playerHeight / 2) { velocity.y = 0; player.position.y = playerHeight / 2; onGround = true; } else { onGround = false; }
}

function checkInteractions() {
    let minDistance = 3.5; nearestInteractable = null;
    const shopDist = player.position.distanceTo(seedShop.position);
    if (shopDist < minDistance) { minDistance = shopDist; nearestInteractable = { type: 'seed_shop' }; }
    const sellerDist = player.position.distanceTo(sellingPlace.position);
    if (sellerDist < minDistance) { nearestInteractable = { type: 'selling_place' }; }

    if (nearestInteractable && !holdState.holding) {
        holdPromptEl.classList.remove('hidden');
    } else {
        holdPromptEl.classList.add('hidden');
    }

    if (holdState.holding) {
        const progress = (clock.getElapsedTime() - holdState.startTime) / holdState.duration;
        setProgress(Math.min(100, progress * 100));
        if (progress >= 1.0) {
            if (holdState.target === 'seed_shop') openShopUI();
            if (holdState.target === 'selling_place') openSellerUI();
            holdState.holding = false;
            setProgress(0);
        }
    }
}

function updateGameLogic(delta) {
    const currentTime = clock.getElapsedTime();
    plantedObjects.forEach(plant => {
        if (plant.userData.growth < 1) {
            const elapsedTime = currentTime - plant.userData.plantedAt;
            const plantInfo = gameState.plantTypes[plant.userData.plantType];
            plant.userData.growth = Math.min(1, elapsedTime / plantInfo.growthTime);
            plant.scale.setScalar(plant.userData.growth * 0.8 + 0.2); // Animate growth
        }
    });
}

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

// Initial UI setup
updateCoinUI();
updateInventoryUI();
updateHeldItem();
animate();
