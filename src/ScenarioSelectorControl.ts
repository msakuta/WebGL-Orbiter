import * as THREE from 'three/src/Three';

import { MenuControl } from './MenuControl';
import { AU, AxisAngleQuaternion, CelestialBody } from './CelestialBody';

import menuIconUrl from './images/menuIcon.png';


export class ScenarioSelectorControl extends MenuControl{

    protected getSelectObj: () => CelestialBody;
    protected showEvent: () => void;

    constructor(
        getRocket: () => CelestialBody,
        setSelectObj: (obj: CelestialBody) => void,
        setThrottle: (throttle: number) => void,
        resetTime: () => void,
        sendMessage: (msg: string) => void,
        showEvent: () => void)
    {
        const config = {
            buttonTop: 0,
            buttonHeight: 32,
            buttonWidth: 32,
            innerTitle: "Scenario Selector",
        };
        super('Scenarios', menuIconUrl, config);

        this.getSelectObj = getRocket;
        this.showEvent = showEvent;

        this.valueElement.style.border = "5px ridge #ffff7f";
        const scenarios: {
            title: string,
            parent: string,
            semimajor_axis: number,
            ascending_node?: number,
            eccentricity?: number,
            rotation?: THREE.Quaternion,
        }[] = [
            {title: "Earth orbit", parent: "earth", semimajor_axis: 10000 / AU},
            {title: "Moon orbit", parent: "moon", semimajor_axis: 3000 / AU},
            {title: "Mars orbit", parent: "mars", semimajor_axis: 5000 / AU},
            {title: "Venus orbit", parent: "venus", semimajor_axis: 10000 / AU, ascending_node: Math.PI},
            {title: "Jupiter orbit", parent: "jupiter", semimajor_axis: 100000 / AU},
        ];
        for(let i = 0; i < scenarios.length; i++){
            const elem = document.createElement('div');
            elem.style.margin = "15px";
            elem.style.padding = "15px";
            elem.style.border = "1px solid #ffff00";
            elem.innerHTML = scenarios[i].title;
            elem.onclick = ((scenario) => {
                return () => {
                    const ascending_node = scenario.ascending_node || 0.;
                    var eccentricity = scenario.eccentricity || 0.;
                    var rotation = scenario.rotation ?? (() => {
                        var rotation = AxisAngleQuaternion(0, 0, 1, ascending_node - Math.PI / 2);
                        rotation.multiply(AxisAngleQuaternion(0, 1, 0, Math.PI));
                        return rotation;
                    })();
                    const select_obj = getRocket();
                    const parent = CelestialBody.findBody(scenario.parent);
                    if(!parent)
                        return;
                    select_obj.setParent(parent);
                    select_obj.position = new THREE.Vector3(0, 1 - eccentricity, 0)
                        .multiplyScalar(scenario.semimajor_axis).applyQuaternion(rotation);
                    select_obj.quaternion = rotation.clone();
                    select_obj.quaternion.multiply(AxisAngleQuaternion(1, 0, 0, -Math.PI / 2));
                    select_obj.angularVelocity = new THREE.Vector3();
                    setThrottle(0);
                    select_obj.setOrbitingVelocity(scenario.semimajor_axis, rotation);
                    select_obj.totalDeltaV = 0.;
                    select_obj.ignitionCount = 0;
                    setSelectObj(select_obj);
                    resetTime();
                    sendMessage('Scenario ' + scenario.title + ' Loaded!');
                    this.title.style.display = 'none';
                    this.visible = false;
                    this.valueElement.style.display = 'none';
                }
            })(scenarios[i]);
            this.valueElement.appendChild(elem);
        }
    }

    setVisible(v: boolean){
        super.setVisible.call(this, v);
        if(this.visible){
            this.showEvent();
        }
    }
}