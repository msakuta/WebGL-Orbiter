import * as THREE from 'three/src/Three';
import { navballRadius } from './RotationControl';
import { CelestialBody, AxisAngleQuaternion } from './CelestialBody';

import navballUrl from './images/navball.png';
import watermarkUrl from './images/watermark.png';
import progradeUrl from './images/prograde.png';
import retrogradeUrl from './images/retrograde.png';


export default class Overlay{
    readonly overlayCamera: THREE.OrthographicCamera;
    readonly overlay: THREE.Scene;
    protected navballMesh: THREE.Mesh;
    protected prograde: THREE.Mesh;
    protected retrograde: THREE.Mesh;

    constructor(){
        this.overlayCamera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, -1000, 1000 );
        window.addEventListener('resize', () => {
            this.overlayCamera.left = window.innerWidth / - 2;
            this.overlayCamera.right = window.innerWidth / 2;
            this.overlayCamera.top = window.innerHeight / 2;
            this.overlayCamera.bottom = window.innerHeight / - 2;
            this.overlayCamera.updateProjectionMatrix();
        });

        this.overlay = new THREE.Scene();
        const loader = new THREE.TextureLoader();
        loader.load( navballUrl, (texture) => {

            const geometry = new THREE.SphereGeometry( navballRadius, 20, 20 );

            const material = new THREE.MeshBasicMaterial( { map: texture, depthTest: false, depthWrite: false } );
            this.navballMesh = new THREE.Mesh(geometry, material);
            this.overlay.add(this.navballMesh);

            const spriteMaterial = new THREE.SpriteMaterial({
                map: new THREE.TextureLoader().load( watermarkUrl ),
                depthTest: false,
                depthWrite: false,
                transparent: true,
            });
            const watermark = new THREE.Sprite(spriteMaterial);
            watermark.scale.set(64, 32, 64);
            this.navballMesh.add(watermark);
        } );

        const spriteGeometry = new THREE.PlaneGeometry( 40, 40 );
        this.prograde = new THREE.Mesh(spriteGeometry,
            new THREE.MeshBasicMaterial({
                map: new THREE.TextureLoader().load( progradeUrl ),
                color: 0xffffff,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
                transparent: true,
            } )
        );
        this.overlay.add(this.prograde);
        this.retrograde = new THREE.Mesh(spriteGeometry,
            new THREE.MeshBasicMaterial({
                map: new THREE.TextureLoader().load( retrogradeUrl ),
                color: 0xffffff,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
                transparent: true,
            } )
        );
        this.overlay.add(this.retrograde);

    }

    updateRotation(select_obj: CelestialBody){
        if(!(this.navballMesh && select_obj && select_obj.controllable))
            return;
        // First, calculate the quaternion for rotating the system so that
        // X axis points north, Y axis points east and Z axis points zenith.
        const north = new THREE.Vector3(0, 0, 1).applyQuaternion(select_obj.getParent().quaternion);
        const tangent = north.cross(select_obj.position).normalize();
        const qball = new THREE.Quaternion();
        const mat = new THREE.Matrix4();
        const normal = select_obj.position.clone().normalize().negate();
        mat.makeBasis(tangent.clone().cross(normal), tangent, normal);
        qball.setFromRotationMatrix (mat);

        this.navballMesh.quaternion.copy(
            AxisAngleQuaternion(0, 1, 0, -1*Math.PI / 2)
            .multiply(AxisAngleQuaternion(0, 0, 1, Math.PI))
            .multiply(select_obj.quaternion.clone().conjugate())
            .multiply(qball)
            .multiply(AxisAngleQuaternion(1, 0, 0, Math.PI / 2))
            );
        this.navballMesh.position.y = -window.innerHeight / 2 + navballRadius;
        let grade;
        let factor;
        if(new THREE.Vector3(1, 0, 0).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) < 0){
            grade = this.retrograde;
            this.prograde.visible = false;
            factor = -1.;
        }
        else{
            grade = this.prograde;
            this.retrograde.visible = false;
            factor = 1.;
        }
        grade.visible = true;
        grade.position.y = -window.innerHeight / 2 + navballRadius + factor * new THREE.Vector3(0, 1, 0).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) / select_obj.velocity.length() * navballRadius;
        grade.position.x = factor * new THREE.Vector3(0, 0, 1).applyQuaternion(select_obj.quaternion).dot(select_obj.velocity) / select_obj.velocity.length() * navballRadius;
    }

    render(renderer: THREE.Renderer){
        renderer.render( this.overlay, this.overlayCamera);
    }
}