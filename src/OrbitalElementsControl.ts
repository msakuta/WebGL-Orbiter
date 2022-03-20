import { CelestialBody, AU } from './CelestialBody';

import orbitIconUrl from './images/orbitIcon.png';

const buttonHeight = 32;
const buttonWidth = 32;

export class OrbitalElementsControl{
    protected valueElement: HTMLElement;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }

    constructor(){
        this.element = document.createElement('div');
        const element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.top = 120 + 'px';
        element.style.left = 0 + 'px';
        element.style.zIndex = '7';
        let visible = false;
        let icon = document.createElement('img');
        icon.src = orbitIconUrl;
        element.appendChild(icon);

        const title = document.createElement('div');
        title.innerHTML = 'Orbital Elements';
        title.style.display = 'none';
        element.appendChild(title);

        this.valueElement = document.createElement('div');
        element.appendChild(this.valueElement);
        this.valueElement.id = 'orbit';
        this.valueElement.style.display = 'none';

        // Register event handlers
        icon.ondragstart = (event) => event.preventDefault();
        icon.onclick = (event) => {
            visible = !visible;
            if(visible){
                this.valueElement.style.display = 'block';
                element.style.background = 'rgba(0, 0, 0, 0.5)';
            }
            else{
                this.valueElement.style.display = 'none';
                element.style.background = 'rgba(0, 0, 0, 0)';
            }
        };
        icon.onmouseenter = (event) => {
            if(!visible)
                title.style.display = 'block';
        };
        icon.onmouseleave = (event) => {
            if(!visible)
                title.style.display = 'none';
        };
    }

    setText(body: CelestialBody, headingApoapsis: number, units_km: boolean){
        // Convert length of unit au into a fixed-length string considering user unit selection.
        // Also appends unit string for clarity.
        function unitConvLength(au: number){
            if(units_km)
                return (au * AU).toPrecision(10) + ' km';
            else
                return au.toFixed(10) + ' AU';
        }

        const o = body.orbitalElements;

        this.valueElement.innerHTML = '<table class="table1">'
            + ' <tr><td>e</td><td>' + (o.eccentricity || 0).toFixed(10) + '</td></tr>'
            + ' <tr><td>a</td><td>' + unitConvLength(o.semimajor_axis) + '</td></tr>'
            + ' <tr><td>i</td><td>' + (o.inclination / Math.PI).toFixed(10) + '</td></tr>'
            + ' <tr><td>Omega</td><td>' + (o.ascending_node / Math.PI).toFixed(10) + '</td></tr>'
            + ' <tr><td>w</td><td>' + (o.argument_of_perihelion / Math.PI).toFixed(10) + '</td></tr>'
            + ' <tr><td>Periapsis</td><td>' + unitConvLength(o.semimajor_axis * (1 - o.eccentricity)) + '</td></tr>'
            + ' <tr><td>Apoapsis</td><td>' + unitConvLength(o.semimajor_axis * (1 + o.eccentricity)) + '</td></tr>'
            + ' <tr><td>head</td><td>' + headingApoapsis.toFixed(5) + '</td></tr>'
    //							+ ' omega=' + this.angularVelocity.x.toFixed(10) + ',' + '<br>' + this.angularVelocity.y.toFixed(10) + ',' + '<br>' + this.angularVelocity.z.toFixed(10)
            +'</table>';
    }
}
