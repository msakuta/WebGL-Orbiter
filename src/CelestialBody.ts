import * as THREE from 'three/src/Three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import blastUrl from './images/blast.png';
import apoapsisUrl from './images/apoapsis.png';
import periapsisUrl from './images/periapsis.png';
import { Settings } from './SettingsControl';
import { RotationButtons } from './RotationControl';

export const AU = 149597871; // Astronomical unit in kilometers
const GMsun = 1.327124400e11 / AU / AU/ AU; // Product of gravitational constant (G) and Sun's mass (Msun)
const epsilon = 1e-40; // Doesn't the machine epsilon depend on browsers!??
const acceleration = 5e-10;

function deserializeVector3(json: any){
    return new THREE.Vector3(json.x, json.y, json.z);
}

function deserializeQuaternion(json: any){
    return new THREE.Quaternion(json._x, json._y, json._z, json._w);
}

export function AxisAngleQuaternion(x: number, y: number, z: number, angle: number){
	const q = new THREE.Quaternion();
	q.setFromAxisAngle(new THREE.Vector3(x, y, z), angle);
	return q;
}


export class CelestialBody{
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    quaternion: THREE.Quaternion;
    angularVelocity: THREE.Vector3;
    orbitColor: string;
    orbitMaterial: THREE.LineBasicMaterial;
    protected children: Array<CelestialBody>;
    getChildren(){ return this.children; }
    protected parent: CelestialBody;
    getParent(){ return this.parent; }
    GM: number;
    radius: number;
    apoapsis?: THREE.Sprite = null;
    periapsis?: THREE.Sprite = null;
    vertex?: THREE.Vector3 = null;
    model?: THREE.Object3D = null;
    hyperbolicGeometry?: THREE.BufferGeometry = null;
    hyperbolicMesh?: THREE.Line = null;
    orbit?: THREE.Line = null;
    blastModel?: THREE.Object3D = null;

    // Orbital elements
    semimajor_axis: number;
    ascending_node: number;
    inclination: number;
    eccentricity: number;
    epoch: number;
    mean_anomaly: number;
    argument_of_perihelion: number;
    soi: number;

    controllable: boolean;
    throttle: number;
    totalDeltaV: number;
    ignitionCount: number;
    name: string;
    static celestialBodies = new Map<string, CelestialBody>();

    constructor(parent: CelestialBody, position: THREE.Vector3, vertex: THREE.Vector3, orbitColor: string, GM: number, name: string){
        this.position = position;
        this.velocity = new THREE.Vector3(0,0,0);
        this.quaternion = new THREE.Quaternion(0,0,0,1);
        this.angularVelocity = new THREE.Vector3(0,0,0);
        if(orbitColor) this.orbitMaterial = new THREE.LineBasicMaterial({color: orbitColor});
        this.children = [];
        this.parent = parent;
        this.GM = GM || GMsun;
        if(parent) parent.children.push(this);
        this.radius = 1 / AU;
        this.controllable = false;
        this.throttle = 0.;
        this.totalDeltaV = 0.;
        this.ignitionCount = 0;
        this.name = name;
        CelestialBody.celestialBodies.set(name, this);
    }


    init(){
        this.ascending_node = Math.random() * Math.PI * 2;
        this.epoch = Math.random();
        this.mean_anomaly = Math.random();
        // this.update();
    }

    get_eccentric_anomaly(time: number){
        // Calculates eccentric anomaly from mean anomaly in first order approximation
        // see http://en.wikipedia.org/wiki/Eccentric_anomaly
        const td = time - this.epoch;
        const period = 2 * Math.PI * Math.sqrt(Math.pow(this.semimajor_axis * AU, 3) / this.parent.GM);
        const now_anomaly = this.mean_anomaly + td * 2 * Math.PI / period;
        return now_anomaly + this.eccentricity * Math.sin(now_anomaly);
    }

    getWorldPosition(): THREE.Vector3{
        if(this.parent)
            return this.parent.getWorldPosition().clone().add(this.position);
        else
            return this.position;
    }

    setOrbitingVelocity(semimajor_axis: number, rotation: THREE.Quaternion){
        this.velocity = new THREE.Vector3(1, 0, 0)
            .multiplyScalar(Math.sqrt(this.parent.GM * (2 / this.position.length() - 1 / semimajor_axis)))
            .applyQuaternion(rotation);
    }

    serialize(){
        return {
            name: this.name,
            parent: this.parent ? this.parent.name : null,
            position: this.position,
            velocity: this.velocity,
            quaternion: this.quaternion,
            angularVelocity: this.angularVelocity,
            totalDeltaV: this.totalDeltaV || undefined,
            ignitionCount: this.ignitionCount || undefined,
        };
    }

    serializeTree(): Array<any>{
        let ret = [];
        ret.push(this.serialize());
        for(let i = 0; i < this.children.length; i++)
            ret = ret.concat(this.children[i].serializeTree());
        return ret;
    }

    deserialize(json: any){
        this.name = json.name;
        this.setParent(CelestialBody.celestialBodies.get(json.parent));
        this.position = deserializeVector3(json.position);
        this.velocity = deserializeVector3(json.velocity);
        this.quaternion = deserializeQuaternion(json.quaternion);
        this.angularVelocity = deserializeVector3(json.angularVelocity);
        this.totalDeltaV = json.totalDeltaV || 0;
        this.ignitionCount = json.ignitionCount || 0;
    }

    setParent(newParent?: CelestialBody){
        if(this.parent === newParent) return;
        if(this.parent){
            const j = this.parent.children.indexOf(this);
            if(0 <= j) this.parent.children.splice(j, 1);
        }
        this.parent = newParent;
        if(this.parent)
            this.parent.children.push(this);
    }

    // Update orbital elements from position and velocity.
    // The whole discussion is found in chapter 4.4 in
    // https://www.academia.edu/8612052/ORBITAL_MECHANICS_FOR_ENGINEERING_STUDENTS
    update(center_select: boolean, viewScale: number, nlips_enable: boolean,
        camera: THREE.Camera, windowHalfX: number, windowHalfY: number,
        units_km: boolean, updateOrbitalElements: (o: CelestialBody, headingApoapsis: number) => void,
        scene: THREE.Scene, select_obj?: CelestialBody)
    {
        let scope = this;
        function visualPosition(o: CelestialBody){
            const position = o.getWorldPosition();
            if(select_obj && center_select)
                position.sub(select_obj.getWorldPosition());
            position.multiplyScalar(viewScale);
            return position;
        }
        /// NLIPS: Non-Linear Inverse Perspective Scrolling
        /// Idea originally found in a game Homeworld that enable
        /// distant small objects to appear on screen in recognizable size
        /// but still renders in real scale when zoomed up.
        function nlipsFactor(o: CelestialBody){
            if(!nlips_enable)
                return 1;
            const g_nlips_factor = 1e6;
            const d = visualPosition(o).distanceTo(camera.position) / viewScale;
            const f = d / o.radius * g_nlips_factor + 1;
            return f;
        }

        let e = new THREE.Vector3(0,0,0);

        /// Calculate position of periapsis and apoapsis on the screen
        /// for placing overlay icons.
        /// peri = -1 if periapsis, otherwise 1
        function calcApsePosition(peri: number, apsis: THREE.Sprite){
            const worldPos = e.clone().normalize().multiplyScalar(peri * scope.semimajor_axis * (1 - peri * scope.eccentricity)).sub(scope.position);
            const cameraPos = worldPos.multiplyScalar(viewScale).applyMatrix4(camera.matrixWorldInverse);
            const persPos = cameraPos.applyMatrix4(camera.projectionMatrix);
            persPos.x *= windowHalfX;
            persPos.y *= windowHalfY;
            persPos.y -= peri * 8;
            if(0 < persPos.z && persPos.z < 1){
                apsis.position.copy(persPos);
                apsis.visible = true;
            }
            else
                apsis.visible = false;
        }

        if(this.vertex)
            this.vertex.copy(visualPosition(this));

        if(this.model){
            this.model.position.copy(visualPosition(this));
            this.model.scale.set(1,1,1).multiplyScalar(nlipsFactor(this));
            this.model.quaternion.copy(this.quaternion);
        }

        let headingApoapsis = 0;

        if(this.parent){
            // Angular momentum vectors
            const ang = this.velocity.clone().cross(this.position);
            const r = this.position.length();
            const v = this.velocity.length();
            // Node vector
            const N = (new THREE.Vector3(0, 0, 1)).cross(ang);
            // Eccentricity vector
            e = this.position.clone().multiplyScalar(1 / this.parent.GM * ((v * v - this.parent.GM / r))).sub(this.velocity.clone().multiplyScalar(this.position.dot(this.velocity) / this.parent.GM));
            this.eccentricity = e.length();
            this.inclination = Math.acos(-ang.z / ang.length());
            // Avoid zero division
            if(N.lengthSq() <= epsilon)
                this.ascending_node = 0;
            else{
                this.ascending_node = Math.acos(N.x / N.length());
                if(N.y < 0) this.ascending_node = 2 * Math.PI - this.ascending_node;
            }
            this.semimajor_axis = 1 / (2 / r - v * v / this.parent.GM);

            // Rotation to perifocal frame
            const planeRot = AxisAngleQuaternion(0, 0, 1, this.ascending_node - Math.PI / 2).multiply(AxisAngleQuaternion(0, 1, 0, Math.PI - this.inclination));

            headingApoapsis = -this.position.dot(this.velocity)/Math.abs(this.position.dot(this.velocity));

            // Avoid zero division and still get the correct answer when N == 0.
            // This is necessary to draw orbit with zero inclination and nonzero eccentricity.
            if(N.lengthSq() <= epsilon || e.lengthSq() <= epsilon)
                this.argument_of_perihelion = Math.atan2(ang.z < 0 ? -e.y : e.y, e.x);
            else{
                this.argument_of_perihelion = Math.acos(N.dot(e) / N.length() / e.length());
                if(e.z < 0) this.argument_of_perihelion = 2 * Math.PI - this.argument_of_perihelion;
            }

            // Total rotation of the orbit
            const rotation = planeRot.clone().multiply(AxisAngleQuaternion(0, 0, 1, this.argument_of_perihelion));

            // Show orbit information
            if(this === select_obj){
                // Yes, building a whole table markup by string manipulation.
                // I know it's inefficient, but it's easy to implement. I'm lazy.

            }

            // If eccentricity is over 1, the trajectory is a hyperbola.
            // It could be parabola in case of eccentricity == 1, but we ignore
            // this impractical case for now.
            if(1 < this.eccentricity){
                // Allocate the hyperbolic shape and mesh only if necessary,
                // since most of celestial bodies are all on permanent elliptical orbit.
                
                if(!this.hyperbolicGeometry){
                    this.hyperbolicGeometry = new THREE.BufferGeometry();
                }
                let hyperbolicGeometryVertices = [];

                // Calculate the vertices every frame since the hyperbola changes shape
                // depending on orbital elements.
                const thetaInf = Math.acos(-1 / this.eccentricity);
                const h2 = ang.lengthSq();
                for(let i = -19; i < 20; i++){
                    // Transform by square root to make far side of the hyperbola less "polygonic"
                    const isign = i < 0 ? -1 : 1;
                    const theta = thetaInf * isign * Math.sqrt(Math.abs(i) / 20);
                    const vec = new THREE.Vector3( Math.sin(theta), Math.cos(theta), 0 )
                        .multiplyScalar(h2 / this.parent.GM / (1 + this.eccentricity * Math.cos(theta)));
                    hyperbolicGeometryVertices.push(vec.x, vec.y, vec.z);
                }
                this.hyperbolicGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hyperbolicGeometryVertices), 3));
                // Signal three.js to update the vertices
                // this.hyperbolicGeometry.verticesNeedUpdate = true;

                // Allocate hyperbola mesh and add it to the scene.
                if(!this.hyperbolicMesh){
                    this.hyperbolicMesh = new THREE.Line(this.hyperbolicGeometry, this.orbitMaterial);
                    scene.add(this.hyperbolicMesh);
                }
                this.hyperbolicMesh.quaternion.copy(rotation);
                this.hyperbolicMesh.scale.x = viewScale;
                this.hyperbolicMesh.scale.y = viewScale;
                this.hyperbolicMesh.position.copy(this.parent.getWorldPosition());
                if(select_obj && center_select)
                    this.hyperbolicMesh.position.sub(select_obj.getWorldPosition());
                this.hyperbolicMesh.position.multiplyScalar(viewScale);

                // Switch from ellipse to hyperbola
                this.hyperbolicMesh.visible = true;
                if(this.orbit)
                    this.orbit.visible = false;
            }
            else if(this.hyperbolicMesh){
                // Switch back to ellipse from hyperbola
                if(this.orbit)
                    this.orbit.visible = true;
                this.hyperbolicMesh.visible = false;
            }

            // Apply transformation to orbit mesh
            if(this.orbit){
                this.orbit.quaternion.copy(rotation);
                this.orbit.scale.x = this.semimajor_axis * viewScale * Math.sqrt(1. - this.eccentricity * this.eccentricity);
                this.orbit.scale.y = this.semimajor_axis * viewScale;
                this.orbit.position.copy(new THREE.Vector3(0, -this.semimajor_axis * this.eccentricity, 0).applyQuaternion(rotation).add(this.parent.getWorldPosition()));
                if(select_obj && center_select)
                    this.orbit.position.sub(select_obj.getWorldPosition());
                this.orbit.position.multiplyScalar(viewScale);
            }

            if(this.apoapsis){
                // if eccentricity is zero or more than 1, apoapsis is not defined
                if(this === select_obj && 0 < this.eccentricity && this.eccentricity < 1)
                    calcApsePosition(-1, this.apoapsis);
                else
                    this.apoapsis.visible = false;
            }
            if(this.periapsis){
                // if eccentricity is zero, periapsis is not defined
                if(this === select_obj && 0 < this.eccentricity)
                    calcApsePosition(1, this.periapsis);
                else
                    this.periapsis.visible = false;
            }
        }

        if(select_obj === this)
            updateOrbitalElements(this, headingApoapsis);

        for(let i = 0; i < this.children.length; i++){
            const a = this.children[i];
            a.update(center_select, viewScale, nlips_enable, camera, windowHalfX, windowHalfY,
                units_km, updateOrbitalElements, scene, select_obj);
        }

    };

    simulateBody(deltaTime: number, div: number, timescale: number, buttons: RotationButtons, select_obj?: CelestialBody){
        const children = this.children;
        for(let i = 0; i < children.length;){
            const a = children[i];
            const sl = a.position.lengthSq();
            if(sl !== 0){
                const angleAcceleration = 1e-0;
                const accel = a.position.clone().negate().normalize().multiplyScalar(deltaTime / div * a.parent.GM / sl);
                if(select_obj === a && select_obj.controllable && timescale <= 1){
                    if(buttons.up) select_obj.angularVelocity.add(new THREE.Vector3(0, 0, 1).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(buttons.down) select_obj.angularVelocity.add(new THREE.Vector3(0, 0, -1).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(buttons.left) select_obj.angularVelocity.add(new THREE.Vector3(0, 1, 0).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(buttons.right) select_obj.angularVelocity.add(new THREE.Vector3(0, -1, 0).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(buttons.counterclockwise) select_obj.angularVelocity.add(new THREE.Vector3(1, 0, 0).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(buttons.clockwise) select_obj.angularVelocity.add(new THREE.Vector3(-1, 0, 0).applyQuaternion(select_obj.quaternion).multiplyScalar(angleAcceleration * deltaTime / div));
                    if(!buttons.up && !buttons.down && !buttons.left && !buttons.right && !buttons.counterclockwise && !buttons.clockwise){
                        // Immediately stop micro-rotation if the body is controlled.
                        // This is done to make it still in larger timescale, since micro-rotation cannot be canceled
                        // by product of angularVelocity and quaternion which underflows by square.
                        // Think that the vehicle has a momentum wheels that cancels micro-rotation continuously working.
                        if(1e-6 < select_obj.angularVelocity.lengthSq())
                            select_obj.angularVelocity.add(select_obj.angularVelocity.clone().normalize().multiplyScalar(-angleAcceleration * deltaTime / div));
                        else
                            select_obj.angularVelocity.set(0, 0, 0);
                    }
                    if(0 < select_obj.throttle){
                        const deltaV = acceleration * select_obj.throttle * deltaTime / div;
                        select_obj.velocity.add(new THREE.Vector3(1, 0, 0).applyQuaternion(select_obj.quaternion).multiplyScalar(deltaV));
                        select_obj.totalDeltaV += deltaV;
                    }
                }
                const dvelo = accel.clone().multiplyScalar(0.5);
                const vec0 = a.position.clone().add(a.velocity.clone().multiplyScalar(deltaTime / div / 2.));
                const accel1 = vec0.clone().negate().normalize().multiplyScalar(deltaTime / div * a.parent.GM / vec0.lengthSq());
                const velo1 = a.velocity.clone().add(dvelo);

                a.velocity.add(accel1);
                a.position.add(velo1.multiplyScalar(deltaTime / div));
                if(0 < a.angularVelocity.lengthSq()){
                    const axis = a.angularVelocity.clone().normalize();
                    // We have to multiply in this order!
                    a.quaternion.multiplyQuaternions(AxisAngleQuaternion(axis.x, axis.y, axis.z, a.angularVelocity.length() * deltaTime / div), a.quaternion);
                }
            }
            // Only controllable objects can change orbiting body
            if(a.controllable){
                // Check if we are leaving sphere of influence of current parent.
                if(a.parent.parent && a.parent.soi && a.parent.soi * 1.01 < a.position.length()){
                    a.position.add(this.position);
                    a.velocity.add(this.velocity);
                    const j = children.indexOf(a);
                    if(0 <= j)
                        children.splice(j, 1);
                    a.parent = this.parent;
                    a.parent.children.push(a);
                    continue; // Continue but not increment i
                }
                let skip = false;
                // Check if we are entering sphere of influence of another sibling.
                for(let j = 0; j < children.length; j++){
                    const aj = children[j];
                    if(aj === a)
                        continue;
                    if(!aj.soi)
                        continue;
                    if(aj.position.distanceTo(a.position) < aj.soi * .99){
                        a.position.sub(aj.position);
                        a.velocity.sub(aj.velocity);
                        const k = children.indexOf(a);
                        if(0 <= k)
                            children.splice(k, 1);
                        a.parent = aj;
                        aj.children.push(a);
                        skip = true;
                        break;
                    }
                }
                if(skip)
                    continue; // Continue but not increment i
            }
            a.simulateBody(deltaTime, div, timescale, buttons, select_obj);
            i++;
        }
    }

    static findBody(name: string){
        return this.celestialBodies.get(name);
    }
}


export interface AddPlanetParams{
    modelName?: string;
    controllable?: boolean;
    soi?: number;
    axialTilt?: number;
    rotationPeriod?: number;
    quaternion?: THREE.Quaternion;
    angularVelocity?: THREE.Vector3;
}

// Add a planet having desired orbital elements. Note that there's no way to specify anomaly (phase) on the orbit right now.
// It's a bit difficult to calculate in Newtonian dynamics simulation.
export function addPlanet(semimajor_axis: number, eccentricity: number, inclination: number, ascending_node: number, argument_of_perihelion: number,
    color: string, GM: number, parent: CelestialBody | null, texture: string, radius: number, params: AddPlanetParams, name: string, scene: THREE.Scene,
    viewScale: number, overlay: THREE.Scene, orbitGeometry: THREE.BufferGeometry, center_select: boolean, settings: Settings, camera: THREE.Camera,
    windowHalfX: number, windowHalfY: number)
{
    const rotation = AxisAngleQuaternion(0, 0, 1, ascending_node - Math.PI / 2)
        .multiply(AxisAngleQuaternion(0, 1, 0, Math.PI - inclination))
        .multiply(AxisAngleQuaternion(0, 0, 1, argument_of_perihelion));
    const group = new THREE.Object3D();
    const ret = new CelestialBody(parent, new THREE.Vector3(0, 1 - eccentricity, 0).multiplyScalar(semimajor_axis).applyQuaternion(rotation), group.position, color, GM, name);
    ret.model = group;
    ret.radius = radius;
    scene.add( group );

    if(texture){
        const loader = new THREE.TextureLoader();
        loader.load( texture, function ( texture ) {

            const geometry = new THREE.SphereGeometry( 1, 20, 20 );

            const material = new THREE.MeshLambertMaterial( { map: texture, color: 0xffffff, flatShading: false } );
            const mesh = new THREE.Mesh( geometry, material );
            const radiusInAu = viewScale * (radius || 6534) / AU;
            mesh.scale.set(radiusInAu, radiusInAu, radiusInAu);
            mesh.rotation.x = Math.PI / 2;
            group.add( mesh );

        } );
    }
    else if(params.modelName){
        const loader = new OBJLoader();
        loader.load( params.modelName, function ( object ) {
            const radiusInAu = 100 * (radius || 6534) / AU;
            object.scale.set(radiusInAu, radiusInAu, radiusInAu);
            group.add( object );
        } );
        const blastGroup = new THREE.Object3D();
        group.add(blastGroup);
        blastGroup.visible = false;
        blastGroup.position.x = -60 / AU;
        ret.blastModel = blastGroup;
        const spriteMaterial = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load( blastUrl ),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
        });
        const blast = new THREE.Sprite(spriteMaterial);
        blast.position.x = -30 / AU;
        blast.scale.multiplyScalar(100 / AU);
        blastGroup.add(blast);
        const blast2 = new THREE.Sprite(spriteMaterial);
        blast2.position.x = -60 / AU;
        blast2.scale.multiplyScalar(50 / AU);
        blastGroup.add(blast2);
        const blast3 = new THREE.Sprite(spriteMaterial);
        blast3.position.x = -80 / AU;
        blast3.scale.multiplyScalar(30 / AU);
        blastGroup.add(blast3);
    }

    if(params && params.controllable)
        ret.controllable = params.controllable;

    ret.soi = params && params.soi ? params.soi / AU : 0;

    ret.apoapsis = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load(apoapsisUrl),
        transparent: true,
    }));
    ret.apoapsis.scale.set(16,16,16);
    overlay.add(ret.apoapsis);

    ret.periapsis = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load(periapsisUrl),
        transparent: true,
    }));
    ret.periapsis.scale.set(16,16,16);
    overlay.add(ret.periapsis);

    // Orbital speed at given position and eccentricity can be calculated by v = \sqrt(\mu (2 / r - 1 / a))
    // https://en.wikipedia.org/wiki/Orbital_speed
    ret.setOrbitingVelocity(semimajor_axis, rotation);
    if(params && params.axialTilt && params.rotationPeriod){
        ret.quaternion = AxisAngleQuaternion(1, 0, 0, params.axialTilt);
        ret.angularVelocity = new THREE.Vector3(0, 0, 2 * Math.PI / params.rotationPeriod).applyQuaternion(ret.quaternion);
    }
    if(params && params.angularVelocity) ret.angularVelocity = params.angularVelocity;
    if(params && params.quaternion) ret.quaternion = params.quaternion;
    const orbitMesh = new THREE.Line(orbitGeometry, ret.orbitMaterial);
    ret.orbit = orbitMesh;
    scene.add(orbitMesh);
    ret.init();
    ret.update(center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
        settings.units_km, (_) => {}, scene);
    return ret;
}
