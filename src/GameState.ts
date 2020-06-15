import * as THREE from 'three/src/Three';
import { CelestialBody, addPlanet } from './CelestialBody';
import { Settings } from './SettingsControl';
import Universe from './Universe';
import { RotationButtons } from './RotationControl';


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

    constructor(scene: THREE.Scene, viewScale: number, overlay: THREE.Scene, settings: Settings, camera: THREE.Camera, windowHalfX: number, windowHalfY: number, sendMessage: (text: string) => void){
        this.sendMessage = sendMessage;

        const AddPlanet = (semimajor_axis: number, eccentricity: number, inclination: number, ascending_node: number, argument_of_perihelion: number, color: string, GM: number, parent: CelestialBody, texture: string, radius: number, params: any, name: string, orbitGeometry: THREE.Geometry) =>
            addPlanet(semimajor_axis, eccentricity, inclination, ascending_node, argument_of_perihelion, color, GM, parent, texture, radius, params, name,
                scene, viewScale, overlay, orbitGeometry, settings.center_select, settings, camera, windowHalfX, windowHalfY);

        this.universe = new Universe(scene, AddPlanet, settings.center_select, viewScale, settings, camera, windowHalfX, windowHalfY);
        this.select_obj = this.universe.rocket;
    }

    resetTime(){
        this.simTime = new Date();
        this.realTime = this.simTime;
        this.startTime = this.simTime;
    }

    serializeState(){
        return {
            simTime: this.simTime,
            startTime: this.startTime,
            bodies: this.universe.sun.serializeTree(),
        };
    }

    loadState(state: any){
        this.simTime = new Date(state.simTime);
        this.startTime = new Date(state.startTime);
        const bodies = state.bodies;
        for(let i = 0; i < bodies.length; i++){
            const body = bodies[i];
            if(CelestialBody.celestialBodies.has(body.name)){
                CelestialBody.celestialBodies.get(body.name).deserialize(body);
            }
        }
        if(this.select_obj && this.onStateLoad)
            this.onStateLoad();
    }

    startTicking(){
        // Start the clock after the initialization is finished, otherwise
        // the very first frame of simulation can be long.
        this.simTime = new Date();
        this.realTime = this.simTime;
        this.startTime = this.simTime;
    }

    updateTime(){
        var now = new Date();
        var realDeltaTimeMilliSec = now.getTime() - this.realTime.getTime();
        var time = new Date(this.simTime.getTime() + realDeltaTimeMilliSec * this.timescale);
        var deltaTime = (time.getTime() - this.simTime.getTime()) * 1e-3;
        this.realTime = now;
        this.simTime = time;
        return [time, realDeltaTimeMilliSec, deltaTime];
    }

    getMissionTime(){
        return this.simTime.getTime() - this.startTime.getTime();
    }

    simulateBody(deltaTime: number, div: number, buttons: RotationButtons){
        this.universe.simulateBody(deltaTime, div, this.timescale, buttons, this.select_obj);
    }

    setTimeScale(scale: number){
        if(this.select_obj && 0 < this.select_obj.throttle){
            this.sendMessage('You cannot timewarp while accelerating');
            return false;
        }
        this.timescale = scale;
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
        return true;
    }
}