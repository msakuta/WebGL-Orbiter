import settingsIconUrl from './images/settingsIcon.png';
import { ContainerControl } from './ContainerControl';
import * as React from "react";

export function rightTitleSetSize(title: HTMLElement, icon: HTMLElement){
    const r = title.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect()
    title.style.top = (iconRect.height - r.height) + 'px';
    title.style.right = iconRect.width + 'px';
}

export class Config{
    buttonTop = 34;
    buttonWidth = 32;
    buttonHeight = 32;
}

export class Settings{
    grid_enable = false;
    sync_rotate = false;
    nlips_enable = true;
    units_km = true;
    center_select = true;
}

export interface SettingsControlProps {
    items: {name: string, checked: boolean, label: string, shortcutKey: string}[]
    onChangeItem: (i: number, name: string) => void;
}

export class SettingsControl extends React.Component<SettingsControlProps>{
    config = new Config();

    render(): JSX.Element{
        const valueT = () =>
            <div style={{
                pointerEvents: 'auto',
                float: 'right',
                clear: 'both',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '3px ridge #7f3f3f',
                padding: '3px',
            }}>
                {this.props.items.map((item: {name: string, checked: boolean, label: string}, i: number) =>
                    <div style={{
                        fontWeight: 'bold',
                        paddingRight: '1em',
                        whiteSpace: 'nowrap',
                    }}
                    key={i}><label><input type="checkbox"
                        checked={item.checked}
                        onChange={((field, i) =>
                            (event: React.ChangeEvent<HTMLInputElement>) =>
                                {
                                    this.props.onChangeItem(i, field);
                                    this.setState({});
                                })(item.name, i)}
                    />{item.label}</label></div>)}
            </div>;

        return <ContainerControl
           buttonTop={this.config.buttonTop}
           buttonWidth={this.config.buttonWidth}
           buttonHeight={this.config.buttonHeight}
           iconUrl={settingsIconUrl}
           caption="Settings"
        >{valueT()}</ContainerControl>;

    }

    constructor(props: SettingsControlProps){
        super(props);
        window.addEventListener( 'keydown', (event: KeyboardEvent) => this.onKeyDown(event), false );
    }

    onKeyDown(event: KeyboardEvent){
        const char = String.fromCharCode(event.which || event.keyCode).toLowerCase();
        for(let i = 0; i < this.props.items.length; i++){
            if(this.props.items[i].shortcutKey === char){
                this.props.onChangeItem(i, this.props.items[i].name);
                this.setState({});
            }
        }
    }
}
