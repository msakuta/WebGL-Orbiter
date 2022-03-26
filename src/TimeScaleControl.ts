import forwardActiveUrl from './images/forward.png';
import forwardInactiveUrl from './images/forward-inactive.png';


export class TimeScaleControl{
    protected setTimeScale: (scale: number) => boolean;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected valueElement: HTMLDivElement;
    protected forwards: HTMLImageElement[] = [];
    protected text: HTMLDivElement;
    protected timeIndex: number;
    protected date: HTMLDivElement;
    static series = [1, 5, 10, 100, 1e3, 1e4, 1e5, 1e6];

    constructor(setTimeScale: (scale: number) => boolean){
        this.setTimeScale = setTimeScale;
        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = '50px';
        this.element.style.background = '#7f7f7f';
        this.element.style.zIndex = '10';
        this.timeIndex = 0;
        for(let i = 0; i < TimeScaleControl.series.length; i++){
            const forward = document.createElement('img');
            forward.src = i <= this.timeIndex ? forwardActiveUrl : forwardInactiveUrl;
            forward.style.width = '15px';
            forward.style.height = '20px';
            forward.addEventListener('click', ((i) => (e: MouseEvent) => this.clickForward(i))(i));
            this.domElement.appendChild(forward);
            this.forwards.push(forward);
        }
        this.text = document.createElement('div');
        this.text.innerHTML = 'Timescale: x1';
        this.domElement.appendChild(this.text);
        this.date = document.createElement('div');
        this.domElement.appendChild(this.date);
    }

    protected clickForward(number: number){
        if(!this.setTimeScale(TimeScaleControl.series[number]))
            return;
        this.setGui(number);
    }

    protected setGui(number: number){
        for(let i = 0; i < this.forwards.length; i++)
            this.forwards[i].src = i <= number ? forwardActiveUrl : forwardInactiveUrl;
        this.text.innerHTML = 'Timescale: x' + TimeScaleControl.series[number];
        this.timeIndex = number;
    }

    increment(){
        if(TimeScaleControl.series.length <= this.timeIndex + 1)
            return;
        this.clickForward(this.timeIndex + 1);
    }

    decrement(){
        if(this.timeIndex - 1 < 0)
            return;
        this.clickForward(this.timeIndex - 1);
    }

    setDate(text: string){
        this.date.innerHTML = text;
    }

    /// Set time scale from server without notifying the server
    setFromServer(value: number){
        for(let i = 0; i < this.forwards.length; i++){
            if(TimeScaleControl.series[i] === value){
                this.setGui(i);
                return;
            }
        }
    }
}