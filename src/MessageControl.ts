

export type SendMessageCallback = (text: string, timeout: number) => void;

export class MessageControl{
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected showTime: number = 0;

    constructor(){
        this.element = document.createElement('div');
        const element = this.element;
        element.style.position = 'absolute';
        element.style.top = '25%';
        element.style.left = '50%';
        element.style.fontSize = '20px';
        element.style.fontWeight = 'bold';
        element.style.textShadow = '0px 0px 5px rgba(0,0,0,1)';
        element.style.zIndex = '20';

        // Register event handlers
        element.ondragstart = (event) => event.preventDefault();
        // Disable text selection
        element.onselectstart = () => false;
    }

    setText(text: string, timeout: number = 5){
        this.element.innerHTML = text;
        this.element.style.display = 'block';
        this.element.style.opacity = '1';
        this.element.style.marginTop = -this.element.getBoundingClientRect().height / 2 + 'px';
        this.element.style.marginLeft = -this.element.getBoundingClientRect().width / 2 + 'px';
        this.showTime = timeout; // Seconds to show should depend on text length!
    }

    timeStep(deltaTime: number){
        if(this.showTime < deltaTime){
            this.element.style.display = 'none';
            this.showTime = 0;
            return;
        }
        this.showTime -= deltaTime;
        if(this.showTime < 2)
            this.element.style.opacity = (this.showTime / 2).toString();
    }
}
