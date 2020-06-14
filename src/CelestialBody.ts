import * as THREE from 'three/src/Three';

const AU = 149597871; // Astronomical unit in kilometers
const GMsun = 1.327124400e11 / AU / AU/ AU; // Product of gravitational constant (G) and Sun's mass (Msun)
const epsilon = 1e-40; // Doesn't the machine epsilon depend on browsers!??

function deserializeVector3(json: any){
    return new THREE.Vector3(json.x, json.y, json.z);
}

function deserializeQuaternion(json: any){
    return new THREE.Quaternion(json._x, json._y, json._z, json._w);
}

function AxisAngleQuaternion(x: number, y: number, z: number, angle: number){
	var q = new THREE.Quaternion();
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
    children: Array<CelestialBody>;
    parent: CelestialBody;
    GM: number;
    radius: number;
    apoapsis?: THREE.Sprite = null;
    periapsis?: THREE.Sprite = null;
    vertex?: THREE.Vector3 = null;
    model?: THREE.Object3D = null;
    hyperbolicGeometry?: THREE.Geometry = null;
    hyperbolicMesh?: THREE.Line = null;
    orbit?: THREE.Line = null;

    // Orbital elements
    semimajor_axis: number;
    ascending_node: number;
    inclination: number;
    eccentricity: number;
    epoch: number;
    mean_anomaly: number;
    argument_of_perihelion: number;

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
        var td = time - this.epoch;
        var period = 2 * Math.PI * Math.sqrt(Math.pow(this.semimajor_axis * AU, 3) / this.parent.GM);
        var now_anomaly = this.mean_anomaly + td * 2 * Math.PI / period;
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
        var ret = [];
        ret.push(this.serialize());
        for(var i = 0; i < this.children.length; i++)
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
            var j = this.parent.children.indexOf(this);
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
        units_km: boolean, updateOrbitalElements: (o: CelestialBody) => void,
        scene: THREE.Scene, select_obj?: CelestialBody)
    {
        let scope = this;
        function visualPosition(o: CelestialBody){
            var position = o.getWorldPosition();
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
            var g_nlips_factor = 1e6;
            var d = visualPosition(o).distanceTo(camera.position) / viewScale;
            var f = d / o.radius * g_nlips_factor + 1;
            return f;
        }

        /// Calculate position of periapsis and apoapsis on the screen
        /// for placing overlay icons.
        /// peri = -1 if periapsis, otherwise 1
        function calcApsePosition(peri: number, apsis: THREE.Sprite){
            var worldPos = e.clone().normalize().multiplyScalar(peri * scope.semimajor_axis * (1 - peri * scope.eccentricity)).sub(scope.position);
            var cameraPos = worldPos.multiplyScalar(viewScale).applyMatrix4(camera.matrixWorldInverse);
            var persPos = cameraPos.applyMatrix4(camera.projectionMatrix);
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

        // Convert length of unit au into a fixed-length string considering user unit selection.
        // Also appends unit string for clarity.
        function unitConvLength(au: number){
            if(units_km)
                return (au * AU).toPrecision(10) + ' km';
            else
                return au.toFixed(10) + ' AU';
        }

        if(this.vertex)
            this.vertex.copy(visualPosition(this));

        if(this.model){
            this.model.position.copy(visualPosition(this));
            this.model.scale.set(1,1,1).multiplyScalar(nlipsFactor(this));
            this.model.quaternion.copy(this.quaternion);
        }

        if(this.parent){
            // Angular momentum vectors
            var ang = this.velocity.clone().cross(this.position);
            var r = this.position.length();
            var v = this.velocity.length();
            // Node vector
            var N = (new THREE.Vector3(0, 0, 1)).cross(ang);
            // Eccentricity vector
            var e = this.position.clone().multiplyScalar(1 / this.parent.GM * ((v * v - this.parent.GM / r))).sub(this.velocity.clone().multiplyScalar(this.position.dot(this.velocity) / this.parent.GM));
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
            var planeRot = AxisAngleQuaternion(0, 0, 1, this.ascending_node - Math.PI / 2).multiply(AxisAngleQuaternion(0, 1, 0, Math.PI - this.inclination));

            var headingApoapsis = -this.position.dot(this.velocity)/Math.abs(this.position.dot(this.velocity));

            // Avoid zero division and still get the correct answer when N == 0.
            // This is necessary to draw orbit with zero inclination and nonzero eccentricity.
            if(N.lengthSq() <= epsilon || e.lengthSq() <= epsilon)
                this.argument_of_perihelion = Math.atan2(-e.y, e.x);
            else{
                this.argument_of_perihelion = Math.acos(N.dot(e) / N.length() / e.length());
                if(e.z < 0) this.argument_of_perihelion = 2 * Math.PI - this.argument_of_perihelion;
            }

            // Total rotation of the orbit
            var rotation = planeRot.clone().multiply(AxisAngleQuaternion(0, 0, 1, this.argument_of_perihelion));

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
                if(!this.hyperbolicGeometry)
                    this.hyperbolicGeometry = new THREE.Geometry();

                // Calculate the vertices every frame since the hyperbola changes shape
                // depending on orbital elements.
                var thetaInf = Math.acos(-1 / this.eccentricity);
                this.hyperbolicGeometry.vertices.length = 0;
                var h2 = ang.lengthSq();
                for(var i = -19; i < 20; i++){
                    // Transform by square root to make far side of the hyperbola less "polygonic"
                    var isign = i < 0 ? -1 : 1;
                    var theta = thetaInf * isign * Math.sqrt(Math.abs(i) / 20);
                    this.hyperbolicGeometry.vertices.push(
                        new THREE.Vector3( Math.sin(theta), Math.cos(theta), 0 )
                        .multiplyScalar(h2 / this.parent.GM / (1 + this.eccentricity * Math.cos(theta))) );
                }
                // Signal three.js to update the vertices
                this.hyperbolicGeometry.verticesNeedUpdate = true;

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

        for(var i = 0; i < this.children.length; i++){
            var a = this.children[i];
            a.update(center_select, viewScale, nlips_enable, camera, windowHalfX, windowHalfY,
                units_km, updateOrbitalElements, scene, select_obj);
        }

    };
}

