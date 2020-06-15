import { rightTitleSetSize } from './SettingsControl';

import closeIconUrl from './images/closeIcon.png';

export class Config{
    buttonTop = 154;
    buttonWidth = 32;
    buttonHeight = 32;
    innerTitle?: string;
}


export class MenuControl{
    protected config = new Config();
    domElement: HTMLElement
    protected icon: HTMLImageElement;
    protected iconMouseOver: boolean;
    protected valueElement: HTMLDivElement;
    protected closeIcon: HTMLImageElement;
    protected title: HTMLDivElement;
    protected visible: boolean = false;

    constructor(titleString: string, iconSrc: string, config: Config){
        this.domElement = document.createElement('div');
        var element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.top = config.buttonTop + 'px';
        element.style.right = 0 + 'px';
        element.style.zIndex = '7';
        this.icon = document.createElement('img');
        this.icon.src = iconSrc;
        this.icon.style.width = config.buttonWidth + 'px';
        this.icon.style.height = config.buttonHeight + 'px';
        var scope = this;
        this.iconMouseOver = false;
        this.icon.ondragstart = (event) => event.preventDefault()
        this.icon.onclick = (event) => this.setVisible(!this.visible);
        this.icon.onmouseenter = function(event){
            if(!scope.visible)
                scope.title.style.display = 'block';
            rightTitleSetSize(scope.title, scope.icon);
            scope.iconMouseOver = true;
        };
        this.icon.onmouseleave = function(event){
            if(!scope.visible)
                scope.title.style.display = 'none';
            scope.iconMouseOver = false;
        };
        element.appendChild(this.icon);

        this.title = document.createElement('div');
        this.title.innerHTML = titleString;
        this.title.style.display = 'none';
        this.title.style.position = 'absolute';
        this.title.style.background = 'rgba(0, 0, 0, 0.5)';
        this.title.style.zIndex = '20';
        element.appendChild(this.title);

        var valueElement = document.createElement('div');
        valueElement.style.cssText = "display: none; position: fixed; left: 50%;"
            + "width: 300px; top: 50%; background-color: rgba(0,0,0,0.85); border: 5px ridge #7fff7f;"
            + "font-size: 15px; text-align: center; font-family: Sans-Serif";
        this.valueElement = valueElement;

        var titleElem = document.createElement('div');
        titleElem.style.margin = "15px";
        titleElem.style.padding = "15px";
        titleElem.style.fontSize = '25px';
        titleElem.innerHTML = config.innerTitle || titleString;
        this.valueElement.appendChild(titleElem);

        this.closeIcon = document.createElement('img');
        this.closeIcon.src = closeIconUrl;
        this.closeIcon.style.cssText = 'position: absolute; top: 0px; right: 0px; border: inset 1px #7f7f7f;';
        this.closeIcon.ondragstart = function(event){
            event.preventDefault();
        };
        this.closeIcon.onclick = function(event){
            scope.setVisible(false);
        };
        this.valueElement.appendChild(this.closeIcon);

        this.domElement.appendChild(this.valueElement);
    }

    setVisible(v: boolean){
        this.visible = v;
        if(this.visible){
            this.valueElement.style.display = 'block';
            var rect = this.valueElement.getBoundingClientRect();
            this.valueElement.style.marginLeft = -rect.width / 2 + "px";
            this.valueElement.style.marginTop = -rect.height / 2 + "px";
        }
        else{
            this.valueElement.style.display = 'none';
            if(!this.iconMouseOver)
                this.title.style.display = 'none';
        }
    };
}
