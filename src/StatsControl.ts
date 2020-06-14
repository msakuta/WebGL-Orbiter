import { rightTitleSetSize, SettingsControl } from './SettingsControl';
import { CelestialBody, AU } from './CelestialBody';

import statsIconUrl from './images/statsIcon.png';


const buttonTop = 120;
const buttonHeight = 32;
const buttonWidth = 32;

// Fills leading zero if the value is less than 10, making the returned string always two characters long.
// Note that values not less than 100 or negative values are not guaranteed to be two characters wide.
// This function is for date time formatting purpose only.
export function zerofill(v: number){
	if(v < 10)
		return "0" + v;
	else
		return v;
}


export class StatsControl{
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected valueElement: HTMLElement;
    protected valueElements: HTMLElement[] = [];
    protected visible: boolean = false;
    protected getSelectObj: () => CelestialBody;
    protected settingsControl: SettingsControl;

    constructor(settingsControl: SettingsControl, getSelectObj: () => CelestialBody){
        this.settingsControl = settingsControl;
        this.getSelectObj = getSelectObj;

        const setSize = () => {
            this.element.style.left = (window.innerWidth - buttonWidth) + 'px';
            rightTitleSetSize(title, icon);
        }

        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.textAlign = 'left';
        this.element.style.top = buttonTop + 'px';
        this.element.style.left = 0 + 'px';
        this.element.style.zIndex = '7';
        const icon = document.createElement('img');
        icon.src = statsIconUrl;
        icon.style.width = buttonWidth + 'px';
        icon.style.height = buttonHeight + 'px';
        this.element.appendChild(icon);

        const title = document.createElement('div');
        title.innerHTML = 'Statistics';
        title.style.display = 'none';
        title.style.position = 'absolute';
        title.style.top = buttonTop + 'px';
        title.style.background = 'rgba(0, 0, 0, 0.5)';
        title.style.zIndex = '20';
        this.element.appendChild(title);

        this.valueElement = document.createElement('div');
        this.element.appendChild(this.valueElement);
        this.valueElement.style.display = 'none';
        this.valueElement.style.position = 'absolute';
        this.valueElement.style.background = 'rgba(0, 0, 0, 0.5)';
        this.valueElement.style.border = '3px ridge #7f3f3f';
        this.valueElement.style.padding = '3px';
        for(let i = 0; i < 3; i++){
            const titleElement = document.createElement('div');
            titleElement.innerHTML = ['Mission Time', 'Delta-V', 'Ignition&nbsp;Count'][i];
            titleElement.style.fontWeight = 'bold';
            titleElement.style.paddingRight = '1em';
            this.valueElement.appendChild(titleElement);
            const valueElementChild = document.createElement('div');
            valueElementChild.style.textAlign = 'right';
            this.valueElements.push(valueElementChild);
            this.valueElement.appendChild(valueElementChild);
        }

        setSize();

        // Register event handlers
        window.addEventListener('resize', setSize);
        icon.ondragstart = (event) => event.preventDefault();
        icon.onclick = (event) => {
            this.visible = !this.visible;
            if(this.visible){
                this.valueElement.style.display = 'block';
                this.element.style.background = 'rgba(0, 0, 0, 0.5)';
            }
            else{
                this.valueElement.style.display = 'none';
                this.element.style.background = 'rgba(0, 0, 0, 0)';
                settingsControl.domElement.style.top = this.element.getBoundingClientRect().bottom + 'px';
            }
        };
        icon.onmouseenter = (event) => {
            if(!this.visible)
                title.style.display = 'block';
            rightTitleSetSize(title, icon);
        };
        icon.onmouseleave = (event) => {
            if(!this.visible)
                title.style.display = 'none';
        };
    }

    setText(simTime: Date, startTime: Date){
        if(!this.visible)
            return;
        const select_obj = this.getSelectObj();
        if(!select_obj){
            this.valueElements[3].innerHTML = this.valueElements[2].innerHTML = '';
            return;
        }
        const totalSeconds = (simTime.getTime() - startTime.getTime()) / 1e3;
        const seconds = Math.floor(totalSeconds) % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 60 / 60) % 24;
        const days = Math.floor(totalSeconds / 60 / 60 / 24);
        this.valueElements[0].innerHTML = days + 'd ' + zerofill(hours) + ':' + zerofill(minutes) + ':' + zerofill(seconds);
        const deltaVkm = select_obj.totalDeltaV * AU;
        let deltaV;
        if(deltaVkm < 10)
            deltaV = (deltaVkm * 1e3).toFixed(1) + 'm/s';
        else
            deltaV = deltaVkm.toFixed(4) + 'km/s';
        this.valueElements[1].innerHTML = deltaV;
        this.valueElements[2].innerHTML = select_obj.ignitionCount.toString();
        this.valueElement.style.marginLeft = (buttonWidth - this.valueElement.getBoundingClientRect().width) + 'px';
        this.settingsControl.domElement.style.top = this.valueElement.getBoundingClientRect().bottom + 'px';
    }
}
