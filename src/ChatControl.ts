import { Config } from './MenuControl';
import { websocket } from './orbiter';

import saveIconUrl from './images/saveIcon.png';
import trashcanUrl from './images/trashcan.png';

interface ClientMessage {
    sessionId: string,
    message: string
}

const panelHeight = 300;
const maxHistory = 100;

export class ChatControl {
    domElement: HTMLElement;
    protected icon: HTMLImageElement;
    protected iconMouseOver: boolean;
    protected visible: boolean = false;
    protected valueElement: HTMLDivElement;
    protected title: HTMLDivElement;
    protected chatHistory: Array<ClientMessage> = [];

    protected showEvent: () => void = () => (void 0);
    protected updateChatHistory: () => void;

    constructor(sendMessage: (msg: string) => void){
        const titleString = "Chat";
        const config: Config = {
            buttonTop: 186,
            buttonWidth: 32,
            buttonHeight: 32,
            innerTitle: "Chat",
        };
        this.domElement = document.createElement('div');
        const element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.bottom = '0px';
        element.style.right = 0 + 'px';
        element.style.zIndex = '7';
        this.icon = document.createElement('img');
        this.icon.src = saveIconUrl;
        this.icon.style.position = 'absolute';
        this.icon.style.bottom = '0px';
        this.icon.style.right = '0px';
        this.icon.style.width = config.buttonWidth + 'px';
        this.icon.style.height = config.buttonHeight + 'px';
        const scope = this;
        this.iconMouseOver = false;
        this.icon.ondragstart = (event) => event.preventDefault();
        this.icon.onclick = (event) => this.setVisible(!this.visible);
        this.icon.onmouseenter = function(event){
            if(!scope.visible)
                scope.title.style.display = 'block';
            scope.iconMouseOver = true;
        };
        this.icon.onmouseleave = function(event){
            if(!scope.visible)
                scope.title.style.display = 'none';
            scope.iconMouseOver = false;
        };
        element.appendChild(this.icon);

        var valueElement = document.createElement('div');
        valueElement.style.cssText = "display: none; position: fixed; right: 0;"
            + `width: 30%; bottom: 0; max-height: ${panelHeight}px; background-color: rgba(0,0,0,0.85); border: 5px ridge #7fff7f;`
            + "font-size: 15px; font-family: Sans-Serif; flex-direction: column; flex-wrap: nowrap";
        this.valueElement = valueElement;
        this.domElement.appendChild(this.valueElement);

        this.title = document.createElement('div');
        this.title.innerHTML = titleString;
        this.title.style.display = 'none';
        this.title.style.position = 'absolute';
        this.title.style.background = 'rgba(0, 0, 0, 0.5)';
        this.title.style.zIndex = '20';
        element.appendChild(this.title);

        const inputContainer = document.createElement('div');
        inputContainer.style.border = "1px solid #7fff7f";
        inputContainer.style.margin = "5px";
        inputContainer.style.padding = "5px";
        inputContainer.style.flexShrink = "0";
        const inputTitle = document.createElement('div');
        inputTitle.innerHTML = 'Chat';
        const inputRow = document.createElement('div');
        inputRow.style.display = 'flex';
        inputRow.style.flexDirection = 'row';
        const inputElement = document.createElement('input');
        inputElement.setAttribute('type', 'text');
        inputElement.style.flexGrow = '1';
        const inputButton = document.createElement('button');
        inputButton.innerHTML = 'Send'
        inputButton.onclick = (event) => {
            this.send(inputElement);
        };
        inputElement.addEventListener('keydown', (event) => {
            // Annoying browser incompatibilities
            const code = event.which || event.keyCode;
    
            if(code === 13){ // 'enter'
                this.send(inputElement);
            }
            if(code === 27){ // escape
                inputElement.blur();
            }
            event.stopPropagation();
        });
    
        inputContainer.appendChild(inputTitle);
        inputRow.appendChild(inputElement);
        inputRow.appendChild(inputButton);
        inputContainer.appendChild(inputRow);
        this.valueElement.appendChild(inputContainer);

        const chatHistoryContainer = document.createElement('div');
        // chatHistoryContainer.style.height = "100%";
        // chatHistoryContainer.style.position = "relative";
        chatHistoryContainer.style.flexGrow = "1";
        chatHistoryContainer.style.maxHeight = `${panelHeight}px`;
        chatHistoryContainer.style.overflowY = "scroll";

        this.updateChatHistory = () => {
            while(0 < chatHistoryContainer.children.length) chatHistoryContainer.removeChild(chatHistoryContainer.children[0]);
            for(let i = 0; i < this.chatHistory.length; i++){
                const elem = document.createElement('div');
                elem.style.margin = "3px";
                elem.style.padding = "2px";
                elem.style.border = "1px solid #00ff00";
                const labelElem = document.createElement('div');
                const msg = this.chatHistory[i];
                labelElem.innerHTML = `${msg.sessionId}: ${msg.message}`;
                labelElem.style.cssText = "width: 100%; margin-right: -32px; display: inline-block; text-align: overflow: auto;";
                elem.appendChild(labelElem);
                chatHistoryContainer.insertBefore(elem, chatHistoryContainer.firstChild);
            }
        }
        this.valueElement.appendChild(chatHistoryContainer);
    }

    setVisible(v: boolean){
        this.visible = v;
        if(this.visible){
            this.valueElement.style.display = 'flex';
            this.icon.style.bottom = `${panelHeight + 16}px`;
        }
        else{
            this.valueElement.style.display = 'none';
            if(!this.iconMouseOver)
                this.title.style.display = 'none';
            this.icon.style.bottom = `0px`;
        }
        if(this.visible){
            this.showEvent();
            this.updateChatHistory();
        }
    }

    send(textElement: HTMLInputElement){
        if(textElement.value !== ""){
            websocket.send(JSON.stringify({
                type: "message",
                payload: textElement.value,
            }))
            textElement.value = "";
        }
    }

    addMessage(msg: ClientMessage){
        if(maxHistory <= this.chatHistory.length)
            this.chatHistory.shift();
        this.chatHistory.push(msg);
        this.updateChatHistory();
    }
}
