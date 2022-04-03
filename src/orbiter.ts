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
import { ChatControl } from './ChatControl';
import Overlay from './Overlay';
import GameState from './GameState';

import backgroundUrl from './images/hipparcoscyl1.jpg';

// Note that a dynamic `import` statement here is required due to
// webpack/webpack#6615, but in theory `import { greet } from './pkg';`
// will work here one day as well!
const rust = import('../orbiter-wasm/pkg');
let wasmModule: any = null;
let wasmState: any = null;

rust.then((module) => {
    // module.greet();
    wasmModule = module;
})


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
let chatControl: ChatControl;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let viewScale = 100;

let gameState: GameState;
let settings = new Settings();

let buttons = new RotationButtons();
let accelerate = false;
let decelerate = false;

export const port = process.env.SERVER_PORT || 8088;

export let websocket: WebSocket = null;

export function reconnectWebSocket(){
    if(gameState.sessionId){
        websocket = new WebSocket(`ws://${location.hostname}:${port}/ws/${gameState.sessionId}`);
        websocket.addEventListener("message", (event: MessageEvent) => {
            // console.log(`Event through WebSocket: ${event.data}`);
            const data = JSON.parse(event.data);
            if(data.type === "clientUpdate"){
                const payload = data.payload;
                const body = CelestialBody.celestialBodies.get(payload.bodyState.name);
                if(body){
                    body.clientUpdate(payload.bodyState);
                }
            }
            else if(data.type === "newBody"){
                const payload = data.payload;
                const body = payload.body;
                const parent = CelestialBody.celestialBodies.get(payload.bodyParent);
                const obj = gameState.universe.addRocket(
                    body.name,
                    body.orbitalElements,
                    parent,
                    gameState.graphicsParams,
                    settings,
                    body.modelColor);
                obj.deserialize(body);
                bodiesControl.setContent(gameState.universe.sun);
                bodiesControl.highlightBody(gameState.findSessionRocket());
            }
            else if(data.type === "message"){
                chatControl.addMessage(data.payload);
            }
            else if(data.type === "timeScale"){
                gameState.timescale = data.payload.timeScale;
                timescaleControl.setFromServer(data.payload.timeScale);
            }
            else if(data.type === "chatHistory"){
                chatControl.setHistory(data.payload);
            }
        });
    }
}

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

    const rotationControl = new RotationControl(buttons, () => gameState.getSelectObj());
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
        gameState.select_obj = selectedObj;
        throttleControl.visible = selectedObj.controllable;
    });
    container.appendChild( bodiesControl.domElement );

    bodiesControl.setContent(gameState.universe.sun);
    bodiesControl.selectBody(gameState.select_obj);
    bodiesControl.highlightBody(gameState.findSessionRocket());

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

    gameState.onStateLoad = () => throttleControl.setThrottle(gameState.select_obj.throttle);

    chatControl = new ChatControl(messageControl.setText);
    container.appendChild(chatControl.domElement);

    async function tryLoadState(){
        const res = await fetch(`http://${location.hostname}:${port}/api/load`, {
            method: "GET"
        });
        if(res.status === 200){
            const data = await res.json();
            console.log(data);
            wasmState = wasmModule.load_state(data, Date.now(), viewScale);
            gameState.universe.sun.forEachBody((body) => {
                wasmState.set_body_model(body.name, body.model);
            });
            // gameState.loadState(data, settings);
            bodiesControl.setContent(gameState.universe.sun);
            bodiesControl.highlightBody(gameState.findSessionRocket());
        }
    }

    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', onKeyDown, false );
    window.addEventListener( 'keyup', onKeyUp, false );
    window.addEventListener( 'load', async function(){
        const restoredSession = localStorage.getItem('WebGLOrbiterSession');
        if(restoredSession){
            gameState.sessionId = JSON.parse(restoredSession).sessionId;
        }

        console.log(`gameSession: ${gameState.sessionId}`);

        await tryLoadState();

        let sessionRocket;
        if(gameState.sessionId){
            sessionRocket = gameState.findSessionRocket();
            if(sessionRocket)
                gameState.select_obj = sessionRocket;
        }
        if(!sessionRocket){
            const sessionRes = await fetch(`http://${location.hostname}:${port}/api/session`, {
                method: "POST"
            });
            const sessionId = await sessionRes.text();
            gameState.sessionId = sessionId;
            await tryLoadState();
        }

        if(!websocket){
            reconnectWebSocket();
        }

        // const state = localStorage.getItem('WebGLOrbiterAutoSave');
        // if(state){
        //     gameState.loadState(JSON.parse(state));
        // }
    });
    window.addEventListener( 'beforeunload', function(){
        // const gameSerialized = JSON.stringify(gameState.serializeState());
        localStorage.setItem('WebGLOrbiterSession', JSON.stringify({
            sessionId: gameState.sessionId
        }));
        // fetch(`http://${location.hostname}:${port}/save`, {
        //     method: "POST",
        //     body: gameSerialized
        // });
    });
    // setInterval(tryLoadState, 10000);

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

    if(!websocket || websocket.readyState === 3){
        reconnectWebSocket();
    }
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

        // gameState.simulateBody(deltaTime, div, buttons);
    }

    if(wasmState){
        wasmState.simulate_body(deltaTime, div, JSON.stringify(buttons));
        wasmState.set_camera(JSON.stringify(camera.position));
        wasmState.update_model(gameState.getSelectObj()?.name, (model: THREE.Object3D, position: any, scale: number, quaternion: any) => {
            if(model){
                // console.log(`model: ${model.name}`);
                model.position.copy(position);
                model.scale.set(scale, scale, scale);
                model.quaternion.copy(quaternion);
            }
        });
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
