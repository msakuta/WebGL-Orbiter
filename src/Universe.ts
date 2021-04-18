import * as THREE from 'three/src/Three';

import { CelestialBody, AU, AxisAngleQuaternion, AddPlanetParams } from './CelestialBody';
import { Settings } from './SettingsControl';
import { RotationButtons } from './RotationControl';

import moonUrl from './images/moon.png';
import mercuryUrl from './images/mercury.jpg';
import marsUrl from './images/mars.jpg';
import venusUrl from './images/venus.jpg';
import jupiterUrl from './images/jupiter.jpg';
import earthUrl from './images/land_ocean_ice_cloud_2048.jpg';
import rocketModelUrl from './rocket.obj';
import perlinUrl from './images/perlin.jpg';

const GMsun = 1.327124400e11 / AU / AU/ AU; // Product of gravitational constant (G) and Sun's mass (Msun)
const rad_per_deg = Math.PI / 180; // Radians per degrees

type AddPlanetArgType = (semimajor_axis: number, eccentricity: number, inclination: number, ascending_node: number,
    argument_of_perihelion: number, color: string, GM: number, parent: CelestialBody, texture: string, radius: number,
    params: AddPlanetParams, name: string, orbitGeometry: THREE.BufferGeometry) => CelestialBody;


export default class Universe{
    sun: CelestialBody;
    rocket: CelestialBody;
    light: THREE.PointLight;

    constructor(scene: THREE.Scene, AddPlanetArg: AddPlanetArgType, center_select: boolean, viewScale: number, settings: Settings, camera: THREE.Camera, windowHalfX: number, windowHalfY: number){
        this.light = new THREE.PointLight( 0xffffff, 1, 0, 1e-6 );
        scene.add( this.light );
        scene.add( new THREE.AmbientLight( 0x202020 ) );

        const curve = new THREE.EllipseCurve(0, 0, 1, 1,
            0, Math.PI * 2, false, 90);
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints( curve.getPoints(256) );

        const group = new THREE.Object3D();
        const material = new THREE.MeshBasicMaterial( { color: "#ffffff" } );

        const Rsun = 695800.;
        const sunGeometry = new THREE.SphereGeometry( 1, 20, 20 );

        const sunMesh = new THREE.Mesh( sunGeometry, material );
        sunMesh.scale.setScalar(viewScale * Rsun / AU);
        group.add( sunMesh );

        scene.add(group);

        const AddPlanet = (semimajor_axis: number, eccentricity: number, inclination: number, ascending_node: number, argument_of_perihelion: number, color: string, GM: number, parent: CelestialBody, texture: string, radius: number, params: AddPlanetParams, name: string) =>
            AddPlanetArg(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name, orbitGeometry);

        this.sun = new CelestialBody(null, new THREE.Vector3(), null, "#ffffff", GMsun, "sun");
        this.sun.radius = Rsun;
        this.sun.model = group;
        const mercury = AddPlanet(0.387098, 0.205630, 7.005 * rad_per_deg, 48.331 * rad_per_deg, 29.124 * rad_per_deg, "#3f7f7f", 22032 / AU / AU / AU, this.sun, mercuryUrl, 2439.7, {soi: 2e5}, "mercury");
        const venus = AddPlanet(0.723332, 0.00677323, 3.39458 * rad_per_deg, 76.678 * rad_per_deg, 55.186 * rad_per_deg, "#7f7f3f", 324859 / AU / AU / AU, this.sun, venusUrl, 6051.8, {soi: 5e5}, "venus");
        // Earth is at 1 AU (which is the AU's definition) and orbits around the ecliptic.
        const earth = AddPlanet(1, 0.0167086, 0, -11.26064 * rad_per_deg, 114.20783 * rad_per_deg, "#3f7f3f", 398600 / AU / AU / AU, this.sun, earthUrl, 6534,
            {axialTilt: 23.4392811 * rad_per_deg,
            rotationPeriod: ((23 * 60 + 56) * 60 + 4.10),
            soi: 5e5}, "earth");
        this.rocket = AddPlanet(10000 / AU, 0., 0, 0, 0, "#3f7f7f", 100 / AU / AU / AU, earth, undefined, 0.1, {modelName: rocketModelUrl, controllable: true}, "rocket");
        this.rocket.quaternion.multiply(AxisAngleQuaternion(1, 0, 0, Math.PI / 2)).multiply(AxisAngleQuaternion(0, 1, 0, Math.PI / 2));
        const moon = AddPlanet(384399 / AU, 0.0167086, 0, -11.26064 * rad_per_deg, 114.20783 * rad_per_deg, "#5f5f5f", 4904.8695 / AU / AU / AU, earth, moonUrl, 1737.1, {soi: 1e5}, "moon");
        const mars = AddPlanet(1.523679, 0.0935, 1.850 * rad_per_deg, 49.562 * rad_per_deg, 286.537 * rad_per_deg, "#7f3f3f", 42828 / AU / AU / AU, this.sun, marsUrl, 3389.5, {soi: 3e5}, "mars");
        const jupiter = AddPlanet(5.204267, 0.048775, 1.305 * rad_per_deg, 100.492 * rad_per_deg, 275.066 * rad_per_deg, "#7f7f3f", 126686534 / AU / AU / AU, this.sun, jupiterUrl, 69911, {soi: 10e6}, "jupiter");

        // Use icosahedron instead of sphere to make it look like uniform
        const asteroidGeometry = new THREE.IcosahedronGeometry( 1, 2 );
        // const asteroidVertices = asteroidGeometry.getAttribute('position') as THREE.BufferAttribute;
        // const asteroidArray = new Float32Array();
        // asteroidVertices.copyArray(asteroidArray);
        // Modulate the vertices randomly to make it look like an asteroid. Simplex noise is desirable.
        // for(let i = 0; i < asteroidArray.length; i += 3){
        //     const vec = new THREE.Vector3(asteroidArray[i], asteroidArray[i+1], asteroidArray[i+2]);
        //     vec.multiplyScalar(0.3 * (Math.random() - 0.5) + 1);
        //     asteroidArray[i] = vec.x;
        //     asteroidArray[i+1] = vec.y;
        //     asteroidArray[i+2] = vec.z;
        // }
        // asteroidGeometry.setAttribute('position', new THREE.BufferAttribute(asteroidArray, 3));
        // Recalculate normal vectors according to updated vertices
        // asteroidGeometry.computeFaceNormals();
        asteroidGeometry.computeVertexNormals();

        // Perlin noise is applied as detail texture.
        // It's asynchrnonous because it's shared by multiple asteroids.
        const asteroidTexture = new THREE.TextureLoader().load(perlinUrl);
        asteroidTexture.wrapS = THREE.RepeatWrapping;
        asteroidTexture.wrapT = THREE.RepeatWrapping;
        asteroidTexture.repeat.set(4, 4);
        const asteroidMaterial = new THREE.MeshLambertMaterial( {
            map: asteroidTexture,
            color: 0xffaf7f, flatShading: false
        } );

        // Randomly generate asteroids
        for (let i = 0; i < 3; i ++ ) {

            const angle = Math.random() * Math.PI * 2;
            const position = new THREE.Vector3();
            position.x = 0.1 * (Math.random() - 0.5);
            position.y = 0.1 * (Math.random() - 0.5) + 1;
            position.z = 0.1 * (Math.random() - 0.5);
            position.applyQuaternion(AxisAngleQuaternion(0, 0, 1, angle));

            position.multiplyScalar(2.5);
            const asteroid = new CelestialBody(this.sun, position, undefined, undefined, undefined, "asteroid" + i);
            asteroid.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.3 - 1, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
                .multiplyScalar(Math.sqrt(GMsun / position.length())).applyQuaternion(AxisAngleQuaternion(0, 0, 1, angle));

            asteroid.radius = Math.random() * 1 + 0.1;
            // We need nested Object3D for NLIPS
            asteroid.model = new THREE.Object3D();
            // The inner Mesh object has scale determined by radius
            const shape = new THREE.Mesh( asteroidGeometry, asteroidMaterial );
            asteroid.model.add(shape);
            const radiusInAu = viewScale * asteroid.radius / AU;
            shape.scale.set(radiusInAu, radiusInAu, radiusInAu);
            shape.up.set(0,0,1);
            scene.add( asteroid.model );

            asteroid.orbitMaterial = new THREE.LineBasicMaterial({color: 0x7f3f7f});
            const orbitMesh = new THREE.Line(orbitGeometry, asteroid.orbitMaterial);
            asteroid.orbit = orbitMesh;
            scene.add(orbitMesh);

            asteroid.init();
            asteroid.update(center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
                settings.units_km, (_) => {}, scene);

        }

    }

    update(center_select: boolean, viewScale: number, nlips_enable: boolean,
        camera: THREE.Camera, windowHalfX: number, windowHalfY: number,
        units_km: boolean, updateOrbitalElements: (o: CelestialBody, headingApoapsis: number) => void,
        scene: THREE.Scene, select_obj?: CelestialBody)
    {
        this.sun.update(center_select, viewScale, nlips_enable, camera, windowHalfX, windowHalfY,
            units_km,
            updateOrbitalElements,
            scene,
            select_obj);

        // offset sun position
        this.light.position.copy(this.sun.model.position);
    }

    simulateBody(deltaTime: number, div: number, timescale: number, buttons: RotationButtons, select_obj?: CelestialBody){
        this.sun.simulateBody(deltaTime, div, timescale, buttons, select_obj);
    }
}
