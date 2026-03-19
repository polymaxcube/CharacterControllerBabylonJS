## 🧪 Prototype / Beta Notice

This project is currently in a **prototype (beta) stage**.

It is under active development and mainly built for experimentation, learning, and early feature testing.

---

### ⚠️ Current Status

- Core systems (movement, camera, animation, physics) are **functional but not finalized**
- Code structure is still being **refined and optimized**
- Some parts may contain:
  - Temporary logic
  - Inconsistent patterns
  - Known or unknown bugs

---

### 🚧 What to Expect

- Features may change **without notice**
- Performance is **not fully optimized**
- Behavior may be **unstable in some scenarios**
- APIs and internal structure are **not yet stable**

---

### 🎯 Purpose

This version is intended to:

- Test gameplay mechanics
- Experiment with Babylon.js character controller
- Iterate quickly before building a stable version

---

## 🚀 Player Controller Setup (Babylon.js)

This guide explains how to initialize and use the `UserController` for a character in Babylon.js.

---

### 📦 Requirements

- A loaded `Mesh` (player character)
- `CharacterAnimationController`
- Physics enabled in the scene (e.g. Havok)

---

### ⚙️ Example Usage

```ts
import UserController from "./UserController";
import CharacterAnimationController from "./CharacterAnimationController";
import { Mesh } from "@babylonjs/core";

// Get player mesh from scene
const playerMesh = scene.getMeshByName("player") as Mesh;

// Create animation controller
const animController = new CharacterAnimationController(playerMesh);

// Create player controller
const playerController = new UserController(playerMesh, animController);

// Start controller
playerController.onStart();
