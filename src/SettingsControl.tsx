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

export class SettingsControl{
    config = new Config();
    protected settings: Settings;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected checkElements: HTMLInputElement[] = [];
    protected visible = false;
    protected mouseOver = false;
    protected render: (props: SettingsControl) => JSX.Element;
    protected items: {name: string, checked: boolean, label: string}[];

    constructor(settings: Settings, config?: Config){
        // const setSize = () => {
        //     this.element.style.left = (window.innerWidth - this.config.buttonWidth) + 'px';
        //     rightTitleSetSize(title, icon);
        // }

        this.settings = settings;
        if(config) this.config = config;
        const iconT = (props: SettingsControl) =>
            <img src={settingsIconUrl}
                style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: this.config.buttonWidth + 'px',
                    height: this.config.buttonHeight + 'px',
                }}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                    this.visible = !this.visible;
                    ReactDOM.render(this.render(this), this.element);
                    if(this.visible){
                        element.style.background = 'rgba(0, 0, 0, 0.5)';
                    }
                    else{
                        element.style.background = 'rgba(0, 0, 0, 0)';
                    }
                }}
                onMouseEnter={(event) => {
                    this.mouseOver = true;
                    ReactDOM.render(this.render(this), this.element);
                    // rightTitleSetSize(title, icon);
                }}
                onMouseLeave={(event) => {
                    this.mouseOver = false;
                    ReactDOM.render(this.render(this), this.element);
                }}
            />;
        const titleT = (props: SettingsControl) =>
            <div
                style={{
                    display: props.visible || props.mouseOver ? "block" : "none",
                    position: "absolute",
                    background: 'rgba(0, 0, 0, 0.5)',
                    bottom: 0,
                    right: this.config.buttonWidth,
                    top: 0,
                    zIndex: 20,
                }}>
                Settings
            </div>;

        const valueT = (props: SettingsControl) =>
            props.visible ? <div style={{
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '3px ridge #7f3f3f',
                padding: '3px',
                right: 0,
                top: this.config.buttonHeight,
            }}>
                {props.items.map((item: {name: string, checked: boolean, label: string}, i: number) =>
                    <div style={{
                        fontWeight: 'bold',
                        paddingRight: '1em',
                        whiteSpace: 'nowrap',
                    }}
                    key={i}><label><input type="checkbox"
                        checked={item.checked}
                        onChange={((a: any, field, i) =>
                            (event: React.ChangeEvent<HTMLInputElement>) =>
                                {
                                    this.items[i].checked = a[field] = !a[field];
                                    ReactDOM.render(this.render(this), element);
                                })(this.settings, item.name, i)}
                    />{item.label}</label></div>)}
            </div> : <div></div>;

        this.render = (props: SettingsControl) => <div
            style={{
                position: 'relative',
                textAlign: 'left',
                top: this.config.buttonTop + 'px',
                right: 0 + 'px',
                zIndex: 7,
            }}>{iconT(props)}
            {titleT(props)}
            {valueT(props)}</div>;

        this.element = document.createElement('div');
        const element = this.domElement;
        ReactDOM.render(this.render(this), element);

        const names = Object.keys(this.settings);
        this.items = names.filter((item) => item !== 'center_select')
            .map((item, i) => ({name: item, checked: false, label: [
                'Show grid (G)',
                'Chase camera (H)',
                'Nonlinear scale (N)',
                'Units in KM (K)',
                'Center selected (C)'][i]}));

        window.addEventListener( 'keydown', (event: KeyboardEvent) => this.onKeyDown(event), false );
    }

    setText(){
        if(!this.visible)
            return;
        this.items[0].checked = this.settings.grid_enable;
        this.items[1].checked = this.settings.sync_rotate;
        this.items[2].checked = this.settings.nlips_enable;
        this.items[3].checked = this.settings.units_km;
        ReactDOM.render(this.render(this), this.element);
    }

    onKeyDown(event: KeyboardEvent){
        const char = String.fromCharCode(event.which || event.keyCode).toLowerCase();
        switch(char){
        case 'c':
            this.settings.center_select = !this.settings.center_select;
            break;

        case 'n': // toggle NLIPS
            this.settings.nlips_enable = !this.settings.nlips_enable;
            break;

        case 'g':
            this.settings.grid_enable = !this.settings.grid_enable;
            break;

        case 'h':
            this.settings.sync_rotate = !this.settings.sync_rotate;
            break;

        case 'k':
            this.settings.units_km = !this.settings.units_km;
            break;
        }
    }
}
