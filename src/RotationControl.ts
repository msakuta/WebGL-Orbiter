export const navballRadius = 64;


import rotateUpUrl from './images/rotate-up.png';
import rotateDownUrl from './images/rotate-down.png';
import rotateLeftUrl from './images/rotate-left.png';
import rotateRightUrl from './images/rotate-right.png';
import rotateCwUrl from './images/rotate-cw.png';
import rotateCcwUrl from './images/rotate-ccw.png';

const buttonHeight = 32;
const buttonWidth = 32;

export class RotationButtons{
    up = false;
    down = false;
    left = false;
    right = false;
    counterclockwise = false;
    clockwise = false;
}

export class RotationControl{
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected buttons: RotationButtons;

    setSize(){
        this.element.style.top = (window.innerHeight - 2 * navballRadius) + 'px';
        this.element.style.left = (window.innerWidth / 2 - navballRadius) + 'px';
    }

    constructor(buttons: RotationButtons){
        this.buttons = buttons;
        function absorbEvent_(event: MouseEvent | TouchEvent) {
            const e = event || window.event;
            e.preventDefault && e.preventDefault();
            e.stopPropagation && e.stopPropagation();
            e.cancelBubble = true;
            e.returnValue = false;
            return false;
        }

        // This is ugly hack, but I don't want to repeat this code 6 times.
        const anyButtons: any = buttons;
        function addArrow(src: string, key: string, left: number, top: number){
            const button = document.createElement('img');
            button.src = src;
            button.width = buttonWidth;
            button.height = buttonHeight;
            button.style.position = 'absolute';
            button.style.top = top + 'px';
            button.style.left = left + 'px';
            button.onmousedown = (event) => anyButtons[key] = true;
            button.onmouseup = (event) => {
                anyButtons[key] = false;
                button.style.boxShadow = '';
            };
            button.ondragstart = (event) => event.preventDefault();
            button.ontouchstart = (event) => {
                anyButtons[key] = true;
                event.preventDefault();
                event.stopPropagation();
            };
            button.ontouchmove = absorbEvent_;
            button.ontouchend = (event) => {
                anyButtons[key] = false;
                button.style.boxShadow = '';
                event.preventDefault();
                event.stopPropagation();
            };
            button.ontouchcancel = absorbEvent_;
            element.appendChild(button);
        }
        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.width = (navballRadius * 2) + 'px';
        this.element.style.height = (navballRadius * 2) + 'px';
        this.setSize();
        this.element.style.zIndex = '5';
        // Introduce internal 'div' because the outer 'div' cannot be
        // hidden since it need to receive mouseenter event.
        let element = document.createElement('div');
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.display = 'none';
        this.element.appendChild(element);
        this.element.onmouseenter = function(event){
            element.style.display = 'block';
        };
        this.element.onmouseleave = function(event){
            element.style.display = 'none';
            buttons.up = buttons.down = buttons.left = buttons.right = false;
        };
        addArrow(rotateUpUrl, 'up', navballRadius - buttonWidth / 2, 0);
        addArrow(rotateDownUrl, 'down', navballRadius - buttonWidth / 2, 2 * navballRadius - buttonHeight);
        addArrow(rotateLeftUrl, 'left', 0, navballRadius - buttonHeight / 2);
        addArrow(rotateRightUrl, 'right', 2 * navballRadius - buttonWidth, navballRadius - buttonHeight / 2);
        addArrow(rotateCwUrl, 'clockwise', 2 * navballRadius - buttonWidth, 0);
        addArrow(rotateCcwUrl, 'counterclockwise', 0, 0);
        window.addEventListener('resize', this.setSize);
    }
}
