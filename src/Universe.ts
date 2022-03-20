import * as THREE from 'three/src/Three';

import { CelestialBody, OrbitalElements, AU, AxisAngleQuaternion, AddPlanetParams, addPlanet } from './CelestialBody';
import { Settings } from './SettingsControl';
import { RotationButtons } from './RotationControl';
import { ModulatedIcosahedronGeometry } from './ModulatedIcosahedronGeometry';
import { GraphicsParams } from './GameState';

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

type AddPlanetArgType = (orbitalElements: OrbitalElements,
    params: AddPlanetParams, orbitGeometry: THREE.BufferGeometry) => CelestialBody;


export default class Universe{
    sun: CelestialBody;
    rocket: CelestialBody;
    light: THREE.PointLight;
    orbitGeometry: THREE.BufferGeometry;

    constructor(graphicsParams: GraphicsParams, settings: Settings){
        const { scene, viewScale, camera, windowHalfX, windowHalfY } = graphicsParams;
        this.light = new THREE.PointLight( 0xffffff, 1, 0, 1e-6 );
        scene.add( this.light );
        scene.add( new THREE.AmbientLight( 0x202020 ) );

        const curve = new THREE.EllipseCurve(0, 0, 1, 1,
            0, Math.PI * 2, false, 90);
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints( curve.getPoints(256) );
        this.orbitGeometry = orbitGeometry;

        const group = new THREE.Object3D();
        const material = new THREE.MeshBasicMaterial( { color: "#ffffff" } );

        const Rsun = 695800.;
        const sunGeometry = new THREE.SphereGeometry( 1, 20, 20 );

        const sunMesh = new THREE.Mesh( sunGeometry, material );
        sunMesh.scale.setScalar(viewScale * Rsun / AU);
        group.add( sunMesh );

        scene.add(group);

        const addPlanetLocal = (orbitalElements: OrbitalElements, params: AddPlanetParams) =>
            addPlanet(orbitalElements, params, graphicsParams, orbitGeometry, settings);

        this.sun = new CelestialBody(null, new THREE.Vector3(), null, "#ffffff", GMsun, "sun");
        this.sun.radius = Rsun;
        this.sun.model = group;

        const mercury = addPlanetLocal({
            semimajor_axis: 0.387098,
            eccentricity: 0.205630,
            inclination: 7.005 * rad_per_deg,
            ascending_node: 48.331 * rad_per_deg,
            argument_of_perihelion: 29.124 * rad_per_deg
        },
        {
            name: "mercury",
            parent: this.sun,
            color: "#3f7f7f",
            texture: mercuryUrl,
            GM: 22032 / AU / AU / AU,
            radius: 2439.7,
            soi: 2e5,
        });

        const venus = addPlanetLocal({
            semimajor_axis: 0.723332,
            eccentricity: 0.00677323,
            inclination: 3.39458 * rad_per_deg,
            ascending_node: 76.678 * rad_per_deg,
            argument_of_perihelion: 55.186 * rad_per_deg
        },
        {
            name: "venus",
            parent: this.sun,
            color: "#7f7f3f",
            texture: venusUrl,
            GM: 324859 / AU / AU / AU,
            radius: 6051.8,
            soi: 5e5,
        });

        // Earth is at 1 AU (which is the AU's definition) and orbits around the ecliptic.
        const earth = addPlanetLocal({
            semimajor_axis: 1,
            eccentricity: 0.0167086,
            inclination: 0,
            ascending_node: -11.26064 * rad_per_deg,
            argument_of_perihelion: 114.20783 * rad_per_deg
        },
        {
            name: "earth",
            parent: this.sun,
            color: "#3f7f3f",
            texture: earthUrl,
            GM: 398600 / AU / AU / AU,
            radius: 6534,
            axialTilt: 23.4392811 * rad_per_deg,
            rotationPeriod: ((23 * 60 + 56) * 60 + 4.10),
            soi: 5e5
        });

        this.rocket = this.addRocket(
            "rocket",
            {
                semimajor_axis: 10000 / AU,
                eccentricity: 0.,
                inclination: 0,
                ascending_node: 0,
                argument_of_perihelion: 0
            },
            earth,
            graphicsParams,
            settings
        );

        const moon = addPlanetLocal({
            semimajor_axis: 384399 / AU,
            eccentricity: 0.0167086,
            inclination: 0,
            ascending_node: -11.26064 * rad_per_deg,
            argument_of_perihelion: 114.20783 * rad_per_deg
        },
        {
            name: "moon",
            parent: earth,
            color: "#5f5f5f",
            texture: moonUrl,
            GM: 4904.8695 / AU / AU / AU,
            radius: 1737.1,
            soi: 1e5,
        });

        const mars = addPlanetLocal({
            semimajor_axis: 1.523679,
            eccentricity: 0.0935,
            inclination: 1.850 * rad_per_deg,
            ascending_node: 49.562 * rad_per_deg,
            argument_of_perihelion: 286.537 * rad_per_deg
        },
        {
            name: "mars",
            parent: this.sun,
            color: "#7f3f3f",
            texture: marsUrl,
            GM: 42828 / AU / AU / AU,
            radius: 3389.5,
            soi: 3e5
        });

        const jupiter = addPlanetLocal({
            semimajor_axis: 5.204267,
            eccentricity: 0.048775,
            inclination: 1.305 * rad_per_deg,
            ascending_node: 100.492 * rad_per_deg,
            argument_of_perihelion: 275.066 * rad_per_deg
        },
        {
            name: "jupiter",
            parent: this.sun,
            color: "#7f7f3f",
            texture: jupiterUrl,
            GM: 126686534 / AU / AU / AU,
            radius: 69911,
            soi: 10e6,
        });

        // Use icosahedron instead of sphere to make it look like uniform
        // TODO: use simplex noise to make more smooth asteroid
        const asteroidGeometry = new ModulatedIcosahedronGeometry( 1, 2, (vec) => vec.multiplyScalar(0.3 * (Math.random() - 0.5) + 1) );
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
            asteroid.update(settings.center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
                settings.units_km, (_) => {}, scene);

        }

    }

    addRocket(name: string, orbitalElements: OrbitalElements, parent: CelestialBody, graphicsParams: GraphicsParams, settings: Settings){
        const rocket = addPlanet(orbitalElements,
        {
            name,
            parent,
            color: "#3f7f7f",
            GM: 100 / AU / AU / AU,
            radius: 0.1,
            modelName: rocketModelUrl,
            controllable: true
        },
        graphicsParams, this.orbitGeometry, settings);
        rocket.quaternion.multiply(AxisAngleQuaternion(1, 0, 0, Math.PI / 2)).multiply(AxisAngleQuaternion(0, 1, 0, Math.PI / 2));

        return rocket;
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
