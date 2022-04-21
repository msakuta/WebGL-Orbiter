import * as THREE from 'three/src/Three';
import { CelestialBody, addPlanet, OrbitalElements, AddPlanetParams } from './CelestialBody';
import { Settings } from './SettingsControl';
import Universe from './Universe';
import { RotationButtons } from './RotationControl';
import { port, websocket } from './orbiter';
import rocketModelUrl from './rocket.obj';


export interface GraphicsParams {
    scene: THREE.Scene;
    viewScale: number;
    overlay: THREE.Scene;
    camera: THREE.Camera;
    windowHalfX: number;
    windowHalfY: number;
}

export interface AddModelPayload {
    name: string,
    parent: string,
    orbitalElements: OrbitalElements,
    modelColor: string,
    sessionId: string,
}

const currentVersion = 3;
export default class GameState{
    simTime: Date;
    startTime: Date;
    realTime: Date;
    timescale = 1e0; // This is not a constant; it can be changed by the user
    select_obj?: CelestialBody = null;
    getSelectObj(){ return this.select_obj; }
    universe: Universe;
    onStateLoad?: () => void = null;
    sendMessage: (text: string) => void;
    graphicsParams: GraphicsParams;
    sessionId?: string;

    constructor(graphicsParams: GraphicsParams, settings: Settings, sendMessage: (text: string) => void){
        this.sendMessage = sendMessage;
        this.graphicsParams = graphicsParams;

        this.universe = new Universe(graphicsParams, settings);
        this.select_obj = this.universe.rocket;
    }

    resetTime(){
        this.simTime = new Date();
        this.realTime = this.simTime;
        this.startTime = this.simTime;
    }

    static get currentVersion() { return currentVersion };

    serializeState(){
        console.log(`this.currentVersion: ${currentVersion}`)
        return {
            saveVersion: currentVersion,
            simTime: this.simTime.getTime() * 1e-3,
            startTime: this.startTime.getTime() * 1e-3,
            bodies: this.universe.sun.serializeTree(),
        };
    }

    loadState(state: any, settings: Settings){
        const version = state.saveVersion || 0;
        if(version !== currentVersion)
            return;
        this.simTime = new Date(state.simTime * 1e3);
        this.startTime = new Date(state.startTime * 1e3);
        this.timescale = state.timeScale;
        const bodies = state.bodies;
        for(let i = 0; i < bodies.length; i++){
            const body = bodies[i];
            let obj = null;
            if(CelestialBody.celestialBodies.has(body.name)){
                obj = CelestialBody.celestialBodies.get(body.name);
                obj.deserialize(body, bodies);
            }
            else if(body.name.match(/rocket\d+/)){
                const parent = body.parent !== null ? CelestialBody.celestialBodies.get(bodies[body.parent].name) : undefined;
                obj = this.universe.addRocket(
                    body.name,
                    body.orbitalElements,
                    parent,
                    this.graphicsParams,
                    settings,
                    body.modelColor);
                obj.deserialize(body, bodies);
            }
            if(this.sessionId && this.sessionId === body.sessionId){
                this.select_obj = obj;
            }
        }

        if(this.select_obj && this.onStateLoad)
            this.onStateLoad();
    }

    addModels(body: AddModelPayload, settings: Settings) {
        let obj;
        if(CelestialBody.celestialBodies.has(body.name)){
            obj = CelestialBody.celestialBodies.get(body.name);
        }
        else if(body.name.match(/rocket\d+/)){
            const parent = body.parent !== null ? CelestialBody.celestialBodies.get(body.parent) : undefined;
            obj = this.universe.addRocket(
                body.name,
                body.orbitalElements,
                parent,
                this.graphicsParams,
                settings,
                body.modelColor);
            obj.sessionId = body.sessionId;
        }
        return obj;
    }

    findSessionRocket(){
        return this.universe.sun.findSessionRocket(this.sessionId);
    }

    startTicking(){
        // Start the clock after the initialization is finished, otherwise
        // the very first frame of simulation can be long.
        this.simTime = new Date();
        this.realTime = this.simTime;
        this.startTime = this.simTime;
    }

    updateTime(): [Date, number, number] {
        const now = new Date();
        const realDeltaTimeMilliSec = now.getTime() - this.realTime.getTime();
        const time = new Date(this.simTime.getTime() + realDeltaTimeMilliSec * this.timescale);
        const deltaTime = (time.getTime() - this.simTime.getTime()) * 1e-3;
        this.realTime = now;
        this.simTime = time;
        return [time, realDeltaTimeMilliSec, deltaTime];
    }

    getMissionTime(){
        return this.simTime.getTime() - this.startTime.getTime();
    }

    simulateBody(deltaTime: number, div: number, buttons: RotationButtons){
        this.universe.simulateBody(this, deltaTime, div, this.timescale, buttons, this.select_obj);
    }

    setTimeScale(scale: number){
        if(this.select_obj && 0 < this.select_obj.throttle){
            this.sendMessage('You cannot timewarp while accelerating');
            return false;
        }
        this.timescale = scale;
        if(websocket && websocket.readyState === 1){
            websocket.send(JSON.stringify({
                type: "timeScale",
                payload: {
                    timeScale: this.timescale,
                }
            }));
        }
        else{
            fetch(`http://${location.hostname}:${port}/api/time_scale`, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    "Content-Type": 'application/json',
                    // "Access-Control-Allow-Origin": "*",
                    // "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
                    // "Access-Control-Max-Age": "2592000",
                },
                body: JSON.stringify({time_scale: scale}),
            });
        }
        return true;
    }

    allowThrottle(pos: number){
        if(1 < this.timescale && 0 < pos){
            this.sendMessage('You cannot accelerate while timewarping');
            return false;
        }
        if(!this.select_obj || !this.select_obj.controllable){
            this.sendMessage('You need to select a controllable object to set throttle');
            return false;
        }
        if(this.select_obj.sessionId !== this.sessionId){
            this.sendMessage('You can only control owned rockets');
            return false;
        }
        return true;
    }
}
