import './style.css';
import {
    ArcRotateCamera,
    Engine,
    HavokPlugin,
    HemisphericLight,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    Vector3,
    Axis,
    Ragdoll,
    PhysicsViewer
} from '@babylonjs/core';
import { Button, AdvancedDynamicTexture, Control } from '@babylonjs/gui';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Cameras/Inputs';
import '@babylonjs/loaders/glTF';
import HavokPhysics from '@babylonjs/havok';
import { ImportMeshAsync } from '@babylonjs/core/Loading';


const createScene = async function () {
    // This creates a basic Babylon Scene object (non-mesh)
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    const canvas = document.getElementById("renderCanvas");
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.collisionsEnabled = true;
    // This creates and positions a free camera (non-mesh)
    const camera = new ArcRotateCamera("camera1", 1.1, 1.4, 5, new Vector3(0, 1, 0), scene);

    // This targets the camera to scene origin
    //camera.setTarget(Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'ground' shape.
    const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

    // enable physics in the scene with a gravity
    scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);

    // Create a static box shape.
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const light2 = new DirectionalLight("dir01", new Vector3(-1, -0.5, -1.0), scene);
    light2.position = new Vector3(3, 6, 4);

    // Shadows
    const shadowGenerator = new ShadowGenerator(1024, light2);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // Buttons
    const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("button", true, scene);
    function createButton(id, text, top) {
        const button = Button.CreateSimpleButton(id, text);
        button.width = 0.2;
        button.height = "50px";
        button.color = "white";
        button.background = "green";
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        button.top = top;
        return button;
    }

    const buttonRagdoll = createButton("buttonRagdoll", "Ragdoll on", "10px");
    advancedTexture.addControl(buttonRagdoll);
    const buttonImpulse = createButton("buttonImpulse", "Impulse", "80px");
    advancedTexture.addControl(buttonImpulse);

    const result = await ImportMeshAsync(
        '/models/player.glb',
        scene,
    );

    const skeleton = result.skeletons[0];
    const config = [
        { bones: ["mixamorig:Hips"], size: 0.25, boxOffset: 0.01 },
        {
            bones: ["mixamorig:Spine2"],
            size: 0.2,
            boxOffset: 0.05,
            boneOffsetAxis: Axis.Y,
            min: -1,
            max: 1,
            rotationAxis: Axis.Z
        },
        // Arms.
        {
            bones: ["mixamorig:LeftArm", "mixamorig:RightArm"],
            depth: 0.1,
            size: 0.1,
            width: 0.2,
            rotationAxis: Axis.Y,
            //min: -1,
            //max: 1,
            boxOffset: 0.10,
            boneOffsetAxis: Axis.Y
        },
        {
            bones: ["mixamorig:LeftForeArm", "mixamorig:RightForeArm"],
            depth: 0.1,
            size: 0.1,
            width: 0.2,
            rotationAxis: Axis.Y,
            min: -1,
            max: 1,
            boxOffset: 0.12,
            boneOffsetAxis: Axis.Y
        },
        // Legs
        {
            bones: ["mixamorig:LeftUpLeg", "mixamorig:RightUpLeg"],
            depth: 0.1,
            size: 0.2,
            width: 0.08,
            rotationAxis: Axis.Y,
            min: -1,
            max: 1,
            boxOffset: 0.2,
            boneOffsetAxis: Axis.Y
        },
        {
            bones: ["mixamorig:LeftLeg", "mixamorig:RightLeg"],
            depth: 0.08,
            size: 0.3,
            width: 0.1,
            rotationAxis: Axis.Y,
            min: -1,
            max: 1,
            boxOffset: 0.2,
            boneOffsetAxis: Axis.Y
        },
        {
            bones: ["mixamorig:LeftHand", "mixamorig:RightHand"],
            depth: 0.2,
            size: 0.2,
            width: 0.2,
            rotationAxis: Axis.Y,
            min: -1,
            max: 1,
            boxOffset: 0.1,
            boneOffsetAxis: Axis.Y
        },
        //head
        {
            bones: ["mixamorig:Head"],
            size: 0.2,
            boxOffset: 0,
            boneOffsetAxis: Axis.Y,
            min: -1,
            max: 1,
            rotationAxis: Axis.Z
        },
        // feet
        {
            bones: ["mixamorig:LeftFoot", "mixamorig:RightFoot"],
            depth: 0.1,
            size: 0.1,
            width: 0.2,
            rotationAxis: Axis.Y,
            min: -1,
            max: 1,
            boxOffset: 0.05,
            boneOffsetAxis: Axis.Y
        }
    ];
    const rootNode = scene.getTransformNodeByName("Armature");

    if (!skeleton || !rootNode) {
        console.error("Ragdoll setup failed: skeleton or rootNode not found", { skeleton, rootNode });
        return;
    }
    const ragdoll = new Ragdoll(skeleton, rootNode, config);

    // for testing purposes
    window.ragdoll = () => ragdoll.ragdoll();

    const viewer = new PhysicsViewer();
    scene.transformNodes.forEach((mesh) => {
        if (mesh.physicsBody) {
            viewer.showBody(mesh.physicsBody);
        }
    });

    return { scene, engine };
};

createScene().then(({ scene, engine }) => {
    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());
});
