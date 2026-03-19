import { AnimationGroup, Bone } from "@babylonjs/core";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

export default class CharacterAnimationController {
    private _animationGroups: AnimationGroup[] = [];
    public isReady: boolean = false

    public constructor(public mesh: Mesh) {}

    public onStart(): void {
        const scene = this.mesh.getScene();
        console.log('animation start')

        // รอจน animation โหลดจริง
        const observer = scene.onAfterRenderObservable.add(() => {
            if (scene.animationGroups.length > 0) {
                this.getAnimationGroupsForMesh();
                this.isReady = true; 
                scene.onAfterRenderObservable.remove(observer);
            }
        });
    }

    public _testPlay() {
        if(this._animationGroups) {
            this._animationGroups[1].start(true);
        }
    }

    private getAnimationGroupsForMesh(): void {
        const scene = this.mesh.getScene();
        
        // กรอง AnimationGroup ที่มี Target เกี่ยวข้องกับ Mesh นี้
        this._animationGroups = scene.animationGroups.filter((group) => {
            return group.targetedAnimations.some((targetedAnim) => {
                const target = targetedAnim.target;

                // ตรวจสอบว่าเป็น Mesh ตัวนี้, เป็นลูกของ Mesh นี้, หรือเป็น Skeleton ที่ Mesh นี้ใช้งานอยู่
                return (
                    target === this.mesh || 
                    (target.isDescendantOf && target.isDescendantOf(this.mesh)) ||
                    (this.mesh.skeleton && target === this.mesh.skeleton)
                );
            });
        });

        this._animationGroups.forEach(group => {
            console.log("Found Animation:", group.name);
        });
    }

    /**
     * เล่น Animation ตามชื่อที่กำหนด
     * @param name ชื่อของ Animation Group
     * @param loop ต้องการให้เล่นวนลูปหรือไม่ (default: true)
     * @param transitionSpeed ความเร็วในการสลับท่า (ยิ่งน้อยยิ่งสมูท เช่น 0.1)
     */
    public playAnimation(name: string, loop: boolean = true, transitionSpeed: number = 0.1): void {
        const targetGroup = this._animationGroups.find(g => g.name === name);

        if (!targetGroup) {
            console.warn(`Animation "${name}" not found!`);
            return;
        }

        // หยุด Animation อื่นๆ ที่กำลังเล่นอยู่เพื่อให้สลับท่าได้นวลขึ้น (Crossfade)
        this._animationGroups.forEach(group => {
            if (group !== targetGroup && group.isPlaying) {
                group.stop(); // หรือใช้ group.exit() สำหรับการทำ Blending ขั้นสูง
            }
        });

        if (!targetGroup.isPlaying) {
            console.log(`Playing: ${name}`);
            targetGroup.play(loop);
        }
    }


    public onUpdate(): void {}
}
