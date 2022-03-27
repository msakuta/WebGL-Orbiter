import * as THREE from 'three/src/Three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import "./main.css";

import { CelestialBody, AU, AxisAngleQuaternion } from './CelestialBody';
import { Settings, SettingsControl } from './SettingsControl';
import { TimeScaleControl } from './TimeScaleControl';
import { ThrottleControl } from './ThrottleControl';
import { navballRadius, RotationControl, RotationButtons } from './RotationControl';
import { OrbitalElementsControl } from './OrbitalElementsControl';
import { zerofill, StatsControl } from './StatsControl';
import { BodiesControl } from './BodiesControl';
import { MessageControl } from './MessageControl';
import { ScenarioSelectorControl } from './ScenarioSelectorControl';
import { SaveControl } from './SaveControl';
import { LoadControl } from './LoadControl';
import Overlay from './Overlay';
import GameState from './GameState';

import backgroundUrl from './images/hipparcoscyl1.jpg';


let container: HTMLElement;
let stats: Stats;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let background: THREE.Scene;
let overlay: Overlay;
let timescaleControl: TimeScaleControl;
let throttleControl: ThrottleControl;
let speedControl: any;
let orbitalElementsControl: OrbitalElementsControl;
let statsControl: StatsControl;
let bodiesControl: BodiesControl;
let settingsControl: SettingsControl;
let altitudeControl: any;
let messageControl: MessageControl;
let cameraControls: OrbitControls;
let grids: THREE.Object3D;
let scenarioSelectorControl: ScenarioSelectorControl;
let saveControl: SaveControl;
let loadControl: LoadControl;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let viewScale = 100;

let gameState: GameState;
let settings = new Settings();

let buttons = new RotationButtons();
let accelerate = false;
let decelerate = false;

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild(container);

    const headerTitle = document.createElement('div');
    headerTitle.id = 'info';
    headerTitle.innerHTML = 'Orbital rocket simulation demo - powered by <a href="http://threejs.org" target="_blank">three.js</a>';
    document.body.appendChild(headerTitle);

    const metaViewport = document.createElement('meta');
    metaViewport.setAttribute('name', 'viewport');
    metaViewport.setAttribute('content', "width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0");
    document.head.appendChild(metaViewport);

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.y = 300;
    camera.position.z = 1000;
    camera.up.set(0,0,1);

    background = new THREE.Scene();
    background.rotation.x = Math.PI / 2;
    const loader = new THREE.TextureLoader();
    loader.load( backgroundUrl, function ( texture ) {

        const geometry = new THREE.SphereGeometry( 2, 20, 20 );

        const material = new THREE.MeshBasicMaterial( { map: texture, depthTest: false, depthWrite: false, side: THREE.BackSide } );
        material.depthWrite = false;
        const mesh = new THREE.Mesh(geometry, material);
        background.add(mesh);

    } );

    overlay = new Overlay();

    scene = new THREE.Scene();

    const orbitMaterial = new THREE.LineBasicMaterial({color: 0x3f3f7f});
    CelestialBody.prototype.orbitMaterial = orbitMaterial; // Default orbit material

    gameState = new GameState({
        scene,
        viewScale,
        overlay: overlay.overlay,
        camera,
        windowHalfX,
        windowHalfY,
     }, settings, (msg) => messageControl.setText(msg));

    const meshMaterial = new THREE.LineBasicMaterial({color: 0x3f3f3f});
    const meshGeometry = new THREE.BufferGeometry();
    const meshVertices = [];
    for(let x = -10; x <= 10; x++)
        meshVertices.push( -10, x, 0, 10, x, 0);
    for(let x = -10; x <= 10; x++)
        meshVertices.push(   x, -10, 0, x, 10, 0);
    meshGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meshVertices), 3));
    grids = new THREE.Object3D();
    const mesh = new THREE.LineSegments(meshGeometry, meshMaterial);
    mesh.scale.x = mesh.scale.y = 100;
    grids.add(mesh);
    const mesh2 = new THREE.LineSegments(meshGeometry, meshMaterial);
    mesh2.scale.x = mesh2.scale.y = 10000 / AU * 100;
    grids.add(mesh2);

    function addAxis(axisVector: THREE.Vector3, color: number){
        const axisXMaterial = new THREE.LineBasicMaterial({color: color});
        const axisXGeometry = new THREE.BufferGeometry();
        axisXGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(
            [0, 0, 0, axisVector.x, axisVector.y, axisVector.z]), 3));
        const axisX = new THREE.Line(axisXGeometry, axisXMaterial);
        axisX.scale.multiplyScalar(100);
        grids.add(axisX);
    }
    addAxis(new THREE.Vector3(100,0,0), 0xff0000);
    addAxis(new THREE.Vector3(0,100,0), 0x00ff00);
    addAxis(new THREE.Vector3(0,0,100), 0x0000ff);

    scene.add(grids);

    camera.position.set(0.005, 0.003, 0.005);

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor( 0x000000 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.autoClear = false;

    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.target.set( 0, 0, 0);
    cameraControls.enablePan = false;
    cameraControls.maxDistance = 4000;
    cameraControls.minDistance = 1 / AU;
    cameraControls.zoomSpeed = 5.;
    cameraControls.update();

    container.appendChild( renderer.domElement );

    stats = Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );

    timescaleControl = new TimeScaleControl(function(scale){ return gameState.setTimeScale(scale); });
    container.appendChild( timescaleControl.domElement );

    throttleControl = new ThrottleControl(windowHalfX, function(pos){ return gameState.allowThrottle(pos); },
        function(){ return gameState.getSelectObj(); });
    container.appendChild( throttleControl.domElement );

    const rotationControl = new RotationControl(buttons);
    container.appendChild( rotationControl.domElement );

    class SpeedControl{
        protected element: HTMLDivElement;
        get domElement(){ return this.element; }
        protected valueElement: HTMLDivElement;
        constructor(){
            function setSize(){
                element.style.top = (window.innerHeight - 2 * navballRadius - 32) + 'px';
                element.style.left = (window.innerWidth / 2 - element.getBoundingClientRect().width / 2) + 'px';
            }
            const buttonHeight = 32;
            const buttonWidth = 32;
            this.element = document.createElement('div');
            const element = this.element;
            element.style.position = 'absolute';
            setSize();
            element.style.zIndex = '7';
            element.style.background = 'rgba(0, 0, 0, 0.5)';
            window.addEventListener('resize', setSize);
            const title = document.createElement('div');
            title.innerHTML = 'Orbit';
            element.appendChild(title);
            this.valueElement = document.createElement('div');
            element.appendChild(this.valueElement);
        }

        setSpeed(){
            if(gameState.select_obj){
                const value = gameState.select_obj.velocity.length() * AU;
                if(value < 1)
                    this.valueElement.innerHTML = (value * 1000).toFixed(4) + 'm/s';
                else
                    this.valueElement.innerHTML = value.toFixed(4) + 'km/s';
            }
            else
                this.valueElement.innerHTML = '';
            this.element.style.left = (window.innerWidth / 2 - this.element.getBoundingClientRect().width / 2) + 'px';
        }
    }
    speedControl = new SpeedControl();
    container.appendChild( speedControl.domElement );

    orbitalElementsControl = new OrbitalElementsControl();
    container.appendChild( orbitalElementsControl.domElement );

    bodiesControl = new BodiesControl((selectedObj) => {
        gameState.select_obj = selectedObj
    });
    container.appendChild( bodiesControl.domElement );

    bodiesControl.setContent(gameState.universe.sun);

    settingsControl = new SettingsControl(settings);
    statsControl = new StatsControl(settingsControl, function() { return gameState.getSelectObj(); });
    container.appendChild( statsControl.domElement );
    container.appendChild( settingsControl.domElement );

    class AltitudeControl{
        protected element: HTMLDivElement;
        get domElement(){ return this.element; }
        protected valueElement: HTMLDivElement;
        constructor(){
            const buttonHeight = 32;
            const buttonWidth = 32;
            this.element = document.createElement('div');
            const element = this.element;
            element.style.position = 'absolute';
            element.style.top = '2em';
            element.style.left = '50%';
            element.style.background = 'rgba(0,0,0,0.5)';
            element.style.zIndex = '8';
            const visible = false;

            // Register event handlers
            element.ondragstart = function(event){
                event.preventDefault();
            };
        }

        setText(value: number){
            let text;
            if(value < 1e5)
                text = value.toFixed(4) + 'km';
            else if(value < 1e8)
                text = (value / 1000).toFixed(4) + 'Mm';
            else
                text = (value / AU).toFixed(4) + 'AU';
            this.element.innerHTML = text;
            this.element.style.marginLeft = -this.element.getBoundingClientRect().width / 2 + 'px';
        }
    }
    altitudeControl = new AltitudeControl();
    container.appendChild( altitudeControl.domElement );

    messageControl = new MessageControl();
    container.appendChild( messageControl.domElement );

    scenarioSelectorControl = new ScenarioSelectorControl(
        function(){ return gameState.getSelectObj(); },
        function(throttle){ throttleControl.setThrottle(throttle); },
        function(){ gameState.resetTime(); },
        function(msg){ messageControl.setText(msg); },
        function(){
            [saveControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
        }
    );
    container.appendChild( scenarioSelectorControl.domElement );

    saveControl = new SaveControl(
        function(){ return gameState.serializeState(); },
        function(msg){ messageControl.setText(msg); },
        function(){
            [scenarioSelectorControl, loadControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
        }
    );
    container.appendChild( saveControl.domElement );

    gameState.onStateLoad = () => throttleControl.setThrottle(gameState.select_obj.throttle);

    loadControl = new LoadControl(
        function(state){ gameState.loadState(state) },
        function(msg){ messageControl.setText(msg); },
        function(){
            [scenarioSelectorControl, saveControl].map(function(control){ control.setVisible(false); }); // Mutually exclusive
        }
    );
    container.appendChild( loadControl.domElement );

    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', onKeyDown, false );
    window.addEventListener( 'keyup', onKeyUp, false );
    window.addEventListener( 'pageshow', function(){
        const state = localStorage.getItem('WebGLOrbiterAutoSave');
        if(state){
            gameState.loadState(JSON.parse(state));
        }
    });
    window.addEventListener( 'beforeunload', function(){
        localStorage.setItem('WebGLOrbiterAutoSave', JSON.stringify(gameState.serializeState()));
    });

    gameState.startTicking();
}

function onWindowResize() {

    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    requestAnimationFrame( animate );

    render();
    stats.update();

}

function render() {
    const [time, realDeltaTimeMilliSec, deltaTime] = gameState.updateTime();
    timescaleControl.setDate(time.getFullYear() + '/' + zerofill(time.getMonth() + 1) + '/' + zerofill(time.getDate())
        + ' ' + zerofill(time.getHours()) + ':' + zerofill(time.getMinutes()) + ':' + zerofill(time.getSeconds()));
    speedControl.setSpeed();
    statsControl.setText(gameState.getMissionTime());
    settingsControl.setText();
    messageControl.timeStep(realDeltaTimeMilliSec * 1e-3);

    camera.near = Math.min(1, cameraControls.target.distanceTo(camera.position) / 10);
    camera.updateProjectionMatrix();

    const acceleration = 5e-10;
    const div = 100; // We should pick subdivide simulation step count by angular speed!

    for(let d = 0; d < div; d++){
        // Allow trying to increase throttle when timewarping in order to show the message
        if(accelerate) throttleControl.increment(deltaTime / div);
        if(decelerate) throttleControl.decrement(deltaTime / div);

        gameState.simulateBody(deltaTime, div, buttons);
    }

    const select_obj = gameState.getSelectObj();
    gameState.universe.update(settings.center_select, viewScale, settings.nlips_enable, camera, windowHalfX, windowHalfY,
        settings.units_km,
        function(o, headingApoapsis){
            orbitalElementsControl.setText(o, headingApoapsis, settings.units_km);
        },
        scene,
        select_obj
    );

    grids.visible = settings.grid_enable;

//				camera.up.copy(new THREE.Vector3(0,0,1)); // This did't work with OrbitControls
    cameraControls.update();

    const oldPosition = camera.position.clone();
    const oldQuaternion = camera.quaternion.clone();
    if(settings.sync_rotate && select_obj){
        camera.quaternion.copy(
            select_obj.quaternion.clone()
            .multiply(AxisAngleQuaternion(0, 1, 0, -1*Math.PI / 2)));
        camera.position.copy(new THREE.Vector3(0, 0.2, 1).normalize().multiplyScalar(camera.position.length()).applyQuaternion(camera.quaternion));
    }
    const position = camera.position.clone();
    camera.position.set(0,0,0);
    renderer.render( background, camera);
    camera.position.copy(position);
    renderer.render( scene, camera );

    if(select_obj && select_obj.controllable){
        overlay.updateRotation(select_obj);
        camera.position.set(0,0,0);
        camera.quaternion.set(1,0,0,0);
        overlay.render(renderer);
    }

    const orbitalElementsBottom = orbitalElementsControl.getBottom();
    bodiesControl.domElement.style.top = `${orbitalElementsBottom + 4}px`;

    // Restore the original state because cameraControls expect these variables unchanged
    camera.quaternion.copy(oldQuaternion);
    camera.position.copy(oldPosition);

    if(select_obj && select_obj.getParent()){
        altitudeControl.setText(select_obj.position.length() * AU - select_obj.getParent().radius);
    }
    else
        altitudeControl.setText(0);
}

function onKeyDown( event: KeyboardEvent ) {
    const char = String.fromCharCode(event.which || event.keyCode).toLowerCase();

    const select_obj = gameState.getSelectObj();
    if(select_obj && select_obj.controllable) switch( char ){
        case 'z':
            throttleControl.setThrottle(1);
            break;
        case 'x':
            throttleControl.setThrottle(0);
            break;
    }

    // Annoying browser incompatibilities
    const code = event.which || event.keyCode;
    // Also support numpad plus and minus
    if(code === 107 || code === 187 && event.shiftKey)
        timescaleControl.increment();
    if(code === 109 || code === 189)
        timescaleControl.decrement();
    if(code === 16)
        accelerate = true;
    if(code === 17)
        decelerate = true;
}

function onKeyUp( event: KeyboardEvent ) {
    // Annoying browser incompatibilities
    const code = event.which || event.keyCode;
    if(code === 16)
        accelerate = false;
    if(code === 17)
        decelerate = false;
}

init();
animate();
