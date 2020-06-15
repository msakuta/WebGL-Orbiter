import { MenuControl } from './MenuControl';

import loadIconUrl from './images/loadIcon.png';
import trashcanUrl from './images/trashcan.png';

export class LoadControl extends MenuControl{
    protected showEvent: () => void;
    protected updateSaveDataList: () => void;

    constructor(loadState: (a: any) => void, sendMessage: (msg: string) => void, showEvent: () => void){
        super('Load data', loadIconUrl, {
            buttonTop: 34 * 2,
            buttonHeight: 32,
            buttonWidth: 32,
        });
        this.showEvent = showEvent;
        this.valueElement.style.border = "5px ridge #ff7fff";

        const saveContainer = document.createElement('div');

        this.updateSaveDataList = () => {
            while(0 < saveContainer.children.length) saveContainer.removeChild(saveContainer.children[0]);
            const saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
            for(let i = 0; i < saveData.length; i++){
                const elem = document.createElement('div');
                elem.style.margin = "5px";
                elem.style.padding = "5px";
                elem.style.border = "1px solid #ff00ff";
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
                    () => {
                        loadState(save.state);
                        sendMessage('Game State Loaded!');
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
            this.updateSaveDataList();
        }
    }
}
