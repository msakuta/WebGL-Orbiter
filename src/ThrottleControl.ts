import { CelestialBody } from "CelestialBody";
import { navballRadius } from './NavBallControl';

import throttleMaxUrl from './images/throttle-max.png';
import throttleMinUrl from './images/throttle-min.png';
import throttleBackUrl from './images/throttle-back.png';
import throttleHandleUrl from './images/throttle-handle.png';


export class ThrottleControl{
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected allowThrottleCallback: (thr: number) => boolean;
    protected getSelectObj: () => CelestialBody;
    protected throttleBack: HTMLImageElement;
    protected handle: HTMLImageElement;

    constructor(windowHalfX: number, allowThrottleCallback: (thr: number) => boolean, getSelectObj: () => CelestialBody){
        this.allowThrottleCallback = allowThrottleCallback;
        this.getSelectObj = getSelectObj;
        var guideHeight = 128;
        var guideWidth = 32;
        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = (window.innerHeight - guideHeight) + 'px';
        this.element.style.left = (windowHalfX - navballRadius - guideWidth) + 'px';
        this.element.style.background = '#7f7f7f';
        this.element.style.zIndex = '10';
        var element = this.domElement;
        var dragging = false;
        var scope = this;
        var throttleMax = document.createElement('img');
        throttleMax.src = throttleMaxUrl;
        throttleMax.style.position = "absolute";
        throttleMax.style.left = '0px';
        throttleMax.style.top = '0px';
        throttleMax.onmousedown = (event) => this.setThrottle(1);
        throttleMax.ondragstart = (event) => event.preventDefault();
        this.domElement.appendChild(throttleMax);
        this.throttleBack = document.createElement('img');
        this.throttleBack.src = throttleBackUrl;
        this.throttleBack.style.position = "absolute";
        this.throttleBack.style.left = '0px';
        this.throttleBack.style.top = '25px';
        this.throttleBack.onmousedown = (event) => {
            dragging = true;
            this.movePosition(event);
        };
        this.throttleBack.onmousemove = (event) => {
            if(dragging && event.buttons & 1)
                this.movePosition(event);
        };
        this.throttleBack.onmouseup = (event) => {
            dragging = false;
        };
        this.throttleBack.draggable = true;
        this.throttleBack.ondragstart = (event) => {
            event.preventDefault();
        };
        this.domElement.appendChild(this.throttleBack);
        var throttleMin = document.createElement('img');
        throttleMin.src = throttleMinUrl;
        throttleMin.style.position = "absolute";
        throttleMin.style.left = '0px';
        throttleMin.style.top = '106px';
        throttleMin.onmousedown = (event) => this.setThrottle(0);
        throttleMin.ondragstart = (event) => event.preventDefault();
        this.domElement.appendChild(throttleMin);
        this.handle = document.createElement('img');
        this.handle.src = throttleHandleUrl;
        this.handle.style.position = 'absolute';
        this.handle.style.top = (guideHeight - 16) + 'px';
        this.handle.style.left = '0px';
        this.handle.onmousemove = this.throttleBack.onmousemove;
        this.handle.onmousedown = this.throttleBack.onmousedown;
        this.handle.onmouseup = this.throttleBack.onmouseup;
        this.handle.ondragstart = this.throttleBack.ondragstart;
        this.domElement.appendChild(this.handle);
        window.addEventListener('resize', () => {
            element.style.top = (window.innerHeight - guideHeight) + 'px';
            element.style.left = (window.innerWidth / 2 - navballRadius - guideWidth) + 'px';
        });
        window.addEventListener('load', () => this.visualizePosition());
    }

    protected movePosition(event: MouseEvent){
        var rect = this.throttleBack.getBoundingClientRect();
        var handleRect = this.handle.getBoundingClientRect();
        var max = rect.height - handleRect.height;
        var pos = Math.min(max, Math.max(0, (event.clientY - rect.top) - handleRect.height / 2));
        this.setThrottle(1 - pos / max);
    }

    protected setThrottle(pos: number){
        if(!this.allowThrottleCallback(pos))
            return;
        const select_obj = this.getSelectObj();
        if(!select_obj)
            return;
        if(select_obj.throttle === 0. && 0. < pos)
            select_obj.ignitionCount++;
        select_obj.throttle = pos;
        if(select_obj && select_obj.blastModel){
            select_obj.blastModel.visible = 0 < select_obj.throttle;
            var size = (select_obj.throttle + 0.1) / 1.1;
            select_obj.blastModel.scale.set(size, size, size);
        }
        this.visualizePosition();
    }

    protected visualizePosition(){
        const select_obj = this.getSelectObj();
        if(!select_obj)
            return;
        var backRect = this.element.getBoundingClientRect();
        var rect = this.throttleBack.getBoundingClientRect();
        var handleRect = this.handle.getBoundingClientRect();
        var max = rect.height - handleRect.height;
        this.handle.style.top = (1 - select_obj.throttle) * max + (rect.top - backRect.top) + 'px';
    }

    increment(delta: number){
        const select_obj = this.getSelectObj();
        if(select_obj)
            this.setThrottle(Math.min(1, select_obj.throttle + delta));
    }

    decrement(delta: number){
        const select_obj = this.getSelectObj();
        if(select_obj)
            this.setThrottle(Math.max(0, select_obj.throttle - delta));
    }
}
