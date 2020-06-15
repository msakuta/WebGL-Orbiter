import { MenuControl } from './MenuControl';

import saveIconUrl from './images/saveIcon.png';
import trashcanUrl from './images/trashcan.png';


export class SaveControl extends MenuControl{
    protected showEvent: () => void;
    protected updateSaveDataList: () => void;

    constructor(serializeState: () => any, sendMessage: (msg: string) => void, showEvent: () => void){
        super('Save data', saveIconUrl, {
            buttonTop: 34,
            buttonHeight: 32,
            buttonWidth: 32,
        });
        this.showEvent = showEvent;

        const inputContainer = document.createElement('div');
        inputContainer.style.border = "1px solid #7fff7f";
        inputContainer.style.margin = "5px";
        inputContainer.style.padding = "5px";
        const inputTitle = document.createElement('div');
        inputTitle.innerHTML = 'New Save Name';
        const inputElement = document.createElement('input');
        inputElement.setAttribute('type', 'text');
        const inputButton = document.createElement('button');
        inputButton.innerHTML = 'save'
        inputButton.onclick = (event) => {
            const saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
            saveData.push({title: inputElement.value, state: serializeState()});
            localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
            sendMessage('Game State Saved!');
            this.title.style.display = 'none';
            this.visible = false;
            this.valueElement.style.display = 'none';
        };
        inputElement.onkeydown = (e) => e.stopPropagation();
        inputContainer.appendChild(inputTitle);
        inputContainer.appendChild(inputElement);
        inputContainer.appendChild(inputButton);
        this.valueElement.appendChild(inputContainer);

        const saveContainer = document.createElement('div');

        this.updateSaveDataList = () => {
            while(0 < saveContainer.children.length) saveContainer.removeChild(saveContainer.children[0]);
            const saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
            for(let i = 0; i < saveData.length; i++){
                const elem = document.createElement('div');
                elem.style.margin = "5px";
                elem.style.padding = "5px";
                elem.style.border = "1px solid #00ff00";
                const labelElem = document.createElement('div');
                labelElem.innerHTML = saveData[i].title;
                labelElem.style.cssText = "width: 100%; margin-right: -32px; display: inline-block; text-align: overflow: auto;";
                elem.appendChild(labelElem);
                const deleteElem = document.createElement('img');
                deleteElem.setAttribute('src', trashcanUrl);
                deleteElem.style.width = '20px';
                deleteElem.onclick = ((i) =>
                    (event: MouseEvent) => {
                        saveData.splice(i, 1);
                        localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
                        sendMessage('Game State Deleted!');
                        this.title.style.display = 'none';
                        this.visible = false;
                        this.valueElement.style.display = 'none';
                        event.stopPropagation();
                    }
                )(i);
                elem.appendChild(deleteElem);
                elem.onclick = ((save) =>
                    (event: MouseEvent) => {
                        save.state = serializeState();
                        localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
                        sendMessage('Game State Saved!');
                        this.title.style.display = 'none';
                        this.visible = false;
                        this.valueElement.style.display = 'none';
                    }
                )(saveData[i]);
                saveContainer.appendChild(elem);
            }
        }
        this.valueElement.appendChild(saveContainer);
    }

    setVisible(v: boolean){
        super.setVisible.call(this, v);
        if(this.visible){
            this.showEvent();
        }
        this.updateSaveDataList();
    }
}
