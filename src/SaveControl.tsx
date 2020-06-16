import { MenuComponent } from './MenuComponent';
import * as React from "react";

import saveIconUrl from './images/saveIcon.png';
import trashcanUrl from './images/trashcan.png';

export interface SaveControlProps{
    serializeState: () => any,
    sendMessage: (msg: string) => void,
    showEvent: () => void,
}

export class SaveControl extends React.Component<SaveControlProps, {visible: boolean, saveName: string}>{

    constructor(props: SaveControlProps){
        super(props);
        this.state = {visible: false, saveName: ''};
    }

    render(){
        const config = {
            buttonTop: 34,
            buttonHeight: 32,
            buttonWidth: 32,
        };

        const inputContainer = <div
            style={{
                border: "1px solid #7fff7f",
                margin: "5px",
                padding: "5px",
            }}>
                <div>New Save Name</div>
                <input type='text'
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(event) => this.setState({saveName: event.target.value})}
                    value={this.state.saveName}
                    >
                    </input>
                <button onClick={(event) => {
                    const saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) : [];
                    saveData.push({title: this.state.saveName, state: this.props.serializeState()});
                    localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
                    this.props.sendMessage('Game State Saved!');
                    this.setState({visible: false});
                    this.props.showEvent();
                }}>Save
                </button>
            </div>

        const saveData = localStorage.getItem('WebGLOrbiterSavedData') ? JSON.parse(localStorage.getItem('WebGLOrbiterSavedData')) as any[] : [];
        const saveContainer = saveData.map((save, i) => 
            <div
                key={i}
                style={{
                    margin: "5px",
                    padding: "5px",
                    border: "1px solid #00ff00",
                }}
                onClick={((save) =>
                        () => {
                            save.state = this.props.serializeState();
                            localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
                            this.props.sendMessage('Game State Saved!');
                            this.setState({visible: false});
                        }
                    )(saveData[i])}
                >
                <div
                    style={{
                        width: "100%",
                        marginRight: -32,
                        display: "inline-block",
                        overflow: "auto",
                    }}>{saveData[i].title}</div>
                <img
                    src={trashcanUrl}
                    style={{width: '20px'}}
                    onClick={((i) =>
                    (event: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
                        saveData.splice(i, 1);
                        localStorage.setItem('WebGLOrbiterSavedData', JSON.stringify(saveData));
                        this.props.sendMessage('Game State Deleted!');
                        this.setState({visible: false});
                        event.stopPropagation();
                    }
                    )(i)
                    }/>
            </div>
        );

        return <MenuComponent
            config={config}
            caption="Save data"
            iconUrl={saveIconUrl}
            visible={this.state.visible}
            onSetVisible={(v) => this.setState({visible: v})}
            style={"5px ridge #7fff7f"}
            ><div>{inputContainer}{saveContainer}</div></MenuComponent>;
    }
}
