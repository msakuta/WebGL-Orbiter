import { CelestialBody, AU } from './CelestialBody';

import bodiesIconUrl from './images/bodiesIcon.png';

const buttonTop = 160;
const buttonHeight = 32;
const buttonWidth = 32;

export class BodiesControl{
    protected valueElement: HTMLElement;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    visible: boolean = false;
    protected onSetSelectObj: (_: CelestialBody) => void;
    protected bodyList: [CelestialBody, HTMLDivElement][] = [];

    constructor(setSelectObj: (selectObj: CelestialBody) => void){
        this.onSetSelectObj = setSelectObj;
        this.element = document.createElement('div');
        const element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.top = `${buttonTop}px`;
        element.style.left = '0px';
        element.style.zIndex = '7';

        const iconContainer = document.createElement('div');
        iconContainer.style.position = 'relative';

        const icon = document.createElement('img');
        icon.src = bodiesIconUrl;
        iconContainer.appendChild(icon);

        const title = document.createElement('div');
        title.innerHTML = 'Celestial&nbsp;Bodies';
        title.style.display = 'none';
        title.style.position = 'absolute';
        title.style.left = `${buttonWidth}px`;
        title.style.bottom = '0px';
        iconContainer.appendChild(title);

        element.appendChild(iconContainer);

        this.valueElement = document.createElement('div');
        this.valueElement.style.cssText = "display: none;"
            + "padding: 5px; background-color: rgba(0,0,0,0.85); border: 4px solid #7f7f7f;"
            + "font-size: 15px; text-align: left; font-family: Sans-Serif";
        element.appendChild(this.valueElement);
        this.valueElement.id = 'orbit';

        icon.ondragstart = (event) => event.preventDefault();
        icon.onclick = (event) => {
            this.visible = !this.visible;
            if(this.visible){
                this.valueElement.style.display = 'block';
                element.style.background = 'rgba(0, 0, 0, 0.5)';
            }
            else{
                this.valueElement.style.display = 'none';
                element.style.background = 'rgba(0, 0, 0, 0)';
            }
        };
        icon.onmouseenter = (event) => {
            if(!this.visible)
                title.style.display = 'block';
        };
        icon.onmouseleave = (event) => {
            if(!this.visible)
                title.style.display = 'none';
        };
    }

    selectBody(body: CelestialBody, idx?: number){
        if(idx === undefined)
            idx = this.bodyList.findIndex((value) => value[0] === body);
        this.onSetSelectObj(body);
        for(let i = 0; i < this.bodyList.length; i++){
            this.bodyList[i][1].style.border = i === idx ? "1px solid #7faf7f" : "";
            this.bodyList[i][1].style.backgroundColor = i === idx ? "rgba(127, 191, 127, 0.5)" : "";
        }
    }

    setContent(root: CelestialBody){
        while(this.valueElement.hasChildNodes())
            this.valueElement.removeChild(this.valueElement.firstChild);

        root.forEachBody((body) => {
            const elem = document.createElement('div');
            elem.innerHTML = body.name;
            this.valueElement.appendChild(elem);
            elem.addEventListener('click', () => this.selectBody(body));
            this.bodyList.push([body, elem]);
        });
    }
}
