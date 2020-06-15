import settingsIconUrl from './images/settingsIcon.png';
import * as React from "react";
import * as ReactDOM from "react-dom";

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

export class SettingsControl extends React.Component<SettingsControlProps, {visible: boolean, mouseOver: boolean}>{
    config = new Config();

    render(): JSX.Element{

        const iconT = () =>
            <img src={settingsIconUrl}
                style={{
                    pointerEvents: 'auto',
                    float: 'right',
                    width: this.config.buttonWidth + 'px',
                    height: this.config.buttonHeight + 'px',
                }}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                    this.setState({visible: !this.state.visible, mouseOver: this.state.mouseOver});
                }}
                onMouseEnter={(event) => {
                    this.setState({visible: this.state.visible, mouseOver: true});
                }}
                onMouseLeave={(event) => {
                    this.setState({visible: this.state.visible, mouseOver: false});
                }}
            />;
        const titleT = () =>
            <div
                style={{
                    display: this.state.visible || this.state.mouseOver ? "inline" : "none",
                    position: "relative",
                    float: 'right',
                    background: this.state.visible ? 'rgba(0, 0, 0, 0.5)' : '',
                    bottom: 0,
                    right: 0,
                    top: (this.config.buttonHeight - 20) + 'px',
                    zIndex: 20,
                }}>
                Settings
            </div>;

        const valueT = () =>
            this.state.visible ? <div style={{
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
            </div> : <div></div>;

        return <div
            style={{
                float: 'right',
                clear: 'both',
                textAlign: 'left',
                marginTop: 2,
                zIndex: 7,
            }}>{iconT()}
            {titleT()}
            {valueT()}</div>;

    }

    constructor(props: SettingsControlProps){
        super(props);
        this.state = {visible: false, mouseOver: false};
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
