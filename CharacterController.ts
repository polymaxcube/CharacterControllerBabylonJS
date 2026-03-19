import { AxesViewer, KeyboardEventTypes, Quaternion, Vector3 } from "@babylonjs/core";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CharacterSupportedState, CharacterSurfaceInfo, PhysicsCharacterController } from "@babylonjs/core/Physics/v2/characterController";
import CharacterAnimationController from "./CharacterAnimationController";
// https://playground.babylonjs.com/#WO0H1U#13

const keyMap = {
  forward: new Set(["w", "ArrowUp"]),
  backward: new Set(["s", "ArrowDown"]),
  left: new Set(["a", "ArrowLeft"]),
  right: new Set(["d", "ArrowRight"]),
  jump: new Set([" "]),
};

export default class UserController {

    private _characterController!: PhysicsCharacterController;
    private _initialPosition: Vector3 = new Vector3(3, 0.3, -8)
    public _capsuleHeight: number = 1.8;
    public _capsuleRadius: number = 0.6;
    private _camera!: FreeCamera;
    private _characterOrientation: Quaternion = Quaternion.Identity();
    private _characterGravity = new Vector3(0, -18, 0);

    private _inputDirection: Vector3 = new Vector3(0, 0, 0);
    private _forwardLocalSpace = Vector3.Forward();

    private _state = "IN_AIR";
    private _inAirSpeed = 8.0;
    private _onGroundSpeed = 10.0;
    private _jumpHeight = 1.5;
    private _wantJump = false;

    private _yaw = 0;
    private _pitch = 0;


    private _nextState = "IN_AIR";


    private _cameraDistance = 6;
    private _cameraHeight = 2.5;
    private _shoulderOffset = 1.2; // 👉 เยื้องหัวไหล่ขวา
    private _cameraLerp = 0.1;

    public _charAnimation?: CharacterAnimationController;

    public constructor(public mesh: Mesh, private anim: CharacterAnimationController) { 
        // console.log('Constructor...');
        if (!this.mesh || !(this.mesh as any).getScene) {
            console.error("mesh is not a Babylon Mesh", this.mesh);
            return;
        }

        this.anim = new CharacterAnimationController(this.mesh);
        this.anim.onStart(); 

    }

    private _initPointerLock(): void {
        const scene = this.mesh.getScene();

        scene.onReadyObservable.addOnce(() => {
            const canvas = scene.getEngine().getRenderingCanvas();
            if (!canvas) return;

            console.log("canvas connected:", canvas.isConnected);

            scene.onPointerDown = () => {
                if (document.pointerLockElement !== canvas) {
                    canvas.requestPointerLock();
                }
            };
        });
    }
    
    private playWhenReady(animName: string): void {
        const scene = this.mesh.getScene();
        const observer = scene.onBeforeRenderObservable.add(() => {
            if (this.anim.isReady) {
                // เมื่อพร้อมแล้วค่อยสั่งเล่น
                // สมมติว่าใน CharacterAnimationController มีฟังก์ชัน play(name)
                this.anim.playAnimation("Idle"); 
                scene.onBeforeRenderObservable.remove(observer);
            }
        });
    }

    public onStart(): void {
        
        // console.log("Player controller started");
        const scene = this.mesh.getScene();
        const axes = new AxesViewer(scene, 0.8);
        axes.xAxis.parent = this.mesh;
        axes.yAxis.parent = this.mesh;
        axes.zAxis.parent = this.mesh;


        // const checkAnimReady = setInterval(() => {
        //     if (this.anim.isReady) { 
        //         this.anim._testPlay();
        //         clearInterval(checkAnimReady);
        //     }
        // }, 100);


        this.playWhenReady("Idle");

        this._camera = scene.activeCamera as FreeCamera;
        this._camera.rotationQuaternion = Quaternion.FromEulerAngles(
            0, // X = up/down
            0,   // Y = left/right
            0
        );
        // ตรวจสอบว่า scene มี physics หรือไม่
        if (!scene.isPhysicsEnabled()) {
            console.warn("Physics is not enabled in the scene!");
        }

        // this.initPointerLock();

        const boundingInfo = this.mesh.getBoundingInfo();
        const maxHeight = boundingInfo.boundingBox.maximum.y;
        const radius = boundingInfo.boundingBox.maximum.x; // ใช้ความกว้างของ bounding box เป็น radius

    
        this.mesh.showBoundingBox = true; // แสดง bounding box เพื่อช่วยในการ debug
        // console.log("Max Height:", maxHeight);

        // สร้าง character controller
        this._characterController = new PhysicsCharacterController(
            this._initialPosition,
            {
                capsuleHeight: maxHeight + 0.5, // เพิ่มความสูงเล็กน้อยเพื่อให้ตัวละครไม่ติดพื้น
                capsuleRadius: radius + 0.1 // เพิ่ม radius เล็กน้อยเพื่อให้ตัวละครไม่ติดกับวัตถุอื่น
            },
            scene
        );

        if (!this._characterController) {
            console.error("Failed to create character controller");
            return;
        }

        this._initKeyboard();
        this._handleMovement();
        this._initPointerLock();
        // this._updateCharacterOrientation();
        this._updateCharacterOrientationThirdPerson();
    }

    private _getNextState(supportInfo: any) {
        if (this._state == "IN_AIR") {
            if (supportInfo.supportedState == CharacterSupportedState.SUPPORTED) {
                this.anim.playAnimation("Idle");
                return "ON_GROUND";
            }
            return "IN_AIR";
        } else if (this._state == "ON_GROUND") {
            if (supportInfo.supportedState != CharacterSupportedState.SUPPORTED) {
                return "IN_AIR";
            }

            if (this._wantJump) {
                this.anim.playAnimation("Jump");
                return "START_JUMP";
            }
            return "ON_GROUND";
        } else if (this._state == "START_JUMP") {
            return "IN_AIR";
        }
    }

    private _getDesiredVelocity(deltaTime: any, supportInfo: CharacterSurfaceInfo, characterOrientation: any, currentVelocity: any): Vector3 {
        let nextState = this._getNextState(supportInfo);
        if (nextState != this._state) {
            this._state = nextState!;
        }

        let upWorld = this._characterGravity.normalizeToNew();
        upWorld.scaleInPlace(-1.0);

        let forwardWorld = this._forwardLocalSpace.applyRotationQuaternion(characterOrientation);
        // console.log("Next State", nextState);
        // console.log("State:", this._state);

        if (this._state == "IN_AIR") {
            let desiredVelocity = this._inputDirection.scale(this._inAirSpeed).applyRotationQuaternion(characterOrientation);
            let outputVelocity = this._characterController.calculateMovement(deltaTime, forwardWorld, upWorld, currentVelocity, Vector3.ZeroReadOnly, desiredVelocity, upWorld);
            // Restore to original vertical component
            outputVelocity.addInPlace(upWorld.scale(-outputVelocity.dot(upWorld)));
            outputVelocity.addInPlace(upWorld.scale(currentVelocity.dot(upWorld)));
            // Add gravity
            outputVelocity.addInPlace(this._characterGravity.scale(deltaTime));
            return outputVelocity;
        } 
        else if (this._state == "ON_GROUND") {


            // 1. ตรวจสอบว่าถ้าไม่มีการกดปุ่ม (ความยาวของแรงกดเป็น 0)
            if (this._inputDirection.length() < 0.001) {
                // ให้หยุดทันทีโดยใช้ความเร็วของพื้นผิวที่ยืนอยู่ (ป้องกันการลื่นบนพื้นที่ขยับได้)
                this.anim.playAnimation("Idle");
                return supportInfo.averageSurfaceVelocity; 
            }

            // console.log("ON_GROUND");
            // Move character relative to the surface we're standing on
            // Correct input velocity to apply instantly any changes in the velocity of the standing surface and this way
            // avoid artifacts caused by filtering of the output velocity when standing on moving objects.
            let desiredVelocity = this._inputDirection.scale(this._onGroundSpeed).applyRotationQuaternion(characterOrientation);

            {
                // --- ส่วนที่เพิ่มเข้าไปเพื่อเช็กการเดิน/หยุด ---
                if (this.anim) { // ตรวจสอบว่ามี Controller แอนิเมชันหรือไม่ [1], [3]
                    if (this._inputDirection.length() > 0) {
                        // มีการกดปุ่มเคลื่อนที่ (เดิน)
                        this.anim.playAnimation("Walk"); // หรือ "Run" ตามที่คุณตั้งชื่อไว้
                    } else {
                        // ไม่มีการกดปุ่ม (หยุดนิ่ง)
                        this.anim.playAnimation("Idle");
                    }
                }
                // -------------------------------------------
            }

            let outputVelocity = this._characterController
                .calculateMovement(
                    deltaTime, 
                    forwardWorld, 
                    supportInfo.averageSurfaceNormal, 
                    currentVelocity, 
                    supportInfo.averageSurfaceVelocity, 
                    desiredVelocity, 
                    upWorld
                );
            // Horizontal projection
            {
                outputVelocity.subtractInPlace(supportInfo.averageSurfaceVelocity);
                let inv1k = 1e-3;
                if (outputVelocity.dot(upWorld) > inv1k) {
                    let velLen = outputVelocity.length();
                    outputVelocity.normalizeFromLength(velLen);

                    // Get the desired length in the horizontal direction
                    let horizLen = velLen / supportInfo.averageSurfaceNormal.dot(upWorld);

                    // Re project the velocity onto the horizontal plane
                    let c = supportInfo.averageSurfaceNormal.cross(outputVelocity);
                    outputVelocity = c.cross(upWorld);
                    outputVelocity.scaleInPlace(horizLen);
                }
                outputVelocity.addInPlace(supportInfo.averageSurfaceVelocity);
                // console.log("Desired Velocity:", desiredVelocity);
                // console.log("Output Velocity:", outputVelocity);
                return outputVelocity;
            }
        }else if (this._state == "START_JUMP") {
            let u = Math.sqrt(2 * this._characterGravity.length() * this._jumpHeight);
            let curRelVel = currentVelocity.dot(upWorld);
            return currentVelocity.add(upWorld.scale(u - curRelVel));
        }

        return Vector3.Zero();
    }

    private _updateCharacterOrientation(): void {
        const scene = this.mesh.getScene();
        if(!scene) return;
        scene.onBeforeRenderObservable.add((scene) => {
            this.mesh.position.copyFrom(this._characterController.getPosition());

            var cameraDirection = this._camera.getDirection(new Vector3(0,0,1));
            cameraDirection.y = 0;
            cameraDirection.normalize();
            this._camera.setTarget(Vector3.Lerp(this._camera.getTarget(), this.mesh.position, 0.1));
            var dist = Vector3.Distance(this._camera.position, this.mesh.position);
            const amount = (Math.min(dist - 6, 0) + Math.max(dist - 9, 0)) * 0.04;
            cameraDirection.scaleAndAddToRef(amount, this._camera.position);
            this._camera.position.y += (this.mesh.position.y + 2 - this._camera.position.y) * 0.04;
        });
    }

    private _updateCharacterOrientationThirdPerson(): void {
        const scene = this.mesh.getScene();
        if (!scene) return;

        scene.onBeforeRenderObservable.add(() => {
            // sync mesh กับ character controller
            this.mesh.position.copyFrom(this._characterController.getPosition());

            const target = this.mesh.position.clone();

            const cameraForward = this._camera.getDirection(Vector3.Forward());
            cameraForward.normalize();

            const backward = cameraForward.scale(-1);
            const right = Vector3.Cross(Vector3.Up(), cameraForward).normalize();

            const offsetRight = right.scale(0.35);    
            const offsetUp = new Vector3(0, 0.8, 0);  
            const offsetBack = cameraForward.scale(-4.0);  
            
            this._camera.position = target
                .add(offsetBack)
                .add(offsetUp)
                .add(offsetRight); 
                       
            if (!this.mesh.rotationQuaternion) {
                this.mesh.rotationQuaternion = Quaternion.Identity();
            }

            const targetCameraDirection = new Vector3(-cameraForward.x, 0, -cameraForward.z).normalize();
            const targetCameraRotation = Quaternion.FromLookDirectionLH(new Vector3(targetCameraDirection.x, 0, targetCameraDirection.z), Vector3.Up());
            this.mesh.rotationQuaternion.copyFrom(targetCameraRotation);

            // const flatForward = new Vector3(cameraForward.x, 0, cameraForward.z).normalize();
            // this.mesh.rotationQuaternion.copyFrom(
            //     Quaternion.FromLookDirectionLH(flatForward, Vector3.Up())
            // );

        });
    }

    private _handleMovement(): void {
        if (!this._characterController) return;
        // After physics update, compute and set new velocity, update the character controller state
        const scene = this.mesh.getScene();

        scene.onAfterPhysicsObservable.add((_) => {
            if (scene.deltaTime == undefined) return;
            const dt = scene.deltaTime / 1000.0;
            if (dt == 0) return;

            let down = new Vector3(0, -1, 0);
            let support = this._characterController.checkSupport(dt, down);
            this._characterOrientation = Quaternion.FromEulerAnglesToRef(0,this._camera.rotation.y, 0, this._characterOrientation);

            // console.log("support:", support.supportedState);    
            let desiredLinearVelocity = this._getDesiredVelocity(dt, support, this._characterOrientation, this._characterController.getVelocity());
            this._characterController.setVelocity(desiredLinearVelocity);
            this._characterController.integrate(dt, support, this._characterGravity);
        });

    }

    private _initKeyboard(): void {
        const scene = this.mesh.getScene();
        
        scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key;

        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (keyMap.forward.has(key)) this._inputDirection.z = 1;
            if (keyMap.backward.has(key)) this._inputDirection.z = -1;
            if (keyMap.left.has(key)) this._inputDirection.x = -1;
            if (keyMap.right.has(key)) this._inputDirection.x = 1;
            if (keyMap.jump.has(key)) this._wantJump = true;
        }

        if (kbInfo.type === KeyboardEventTypes.KEYUP) {
            if (keyMap.forward.has(key) || keyMap.backward.has(key)) this._inputDirection.z = 0;
            if (keyMap.left.has(key) || keyMap.right.has(key)) this._inputDirection.x = 0;
            if (keyMap.jump.has(key)) this._wantJump = false;
        }
        });
    }

    public onUpdate(): void {

    }
}
