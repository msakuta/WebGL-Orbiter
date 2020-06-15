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
    buttonTop = 154;
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
    protected valueElement: HTMLDivElement;
    protected checkElements: HTMLInputElement[] = [];
    protected visible = false;
    protected mouseOver = false;
    protected iconT: (props: SettingsControl) => JSX.Element;
    protected titleT: (props: SettingsControl) => JSX.Element;
    protected items: {name: string, checked: boolean, label: string}[];
    protected valueT: (props: SettingsControl) => JSX.Element;

    constructor(settings: Settings, config?: Config){
        const setSize = () => {
            this.element.style.left = (window.innerWidth - this.config.buttonWidth) + 'px';
            rightTitleSetSize(title, icon);
        }

        this.settings = settings;
        if(config) this.config = config;
        this.element = document.createElement('div');
        const element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.top = this.config.buttonTop + 'px';
        element.style.left = 0 + 'px';
        element.style.zIndex = '7';
        const icon = document.createElement('div');
        this.iconT = (props: SettingsControl) =>
            <img src={settingsIconUrl}
                style={{
                    width: this.config.buttonWidth + 'px',
                    height: this.config.buttonHeight + 'px',
                }}
            />;
        element.appendChild(icon);
        ReactDOM.render(this.iconT(this), icon);

        const title = document.createElement('div');
        this.titleT = (props: SettingsControl) =>
            <div
                style={{
                    display: props.visible || props.mouseOver ? "block" : "none",
                    position: "absolute",
                    background: 'rgba(0, 0, 0, 0.5)',
                    bottom: 0,
                    right: this.config.buttonWidth,
                    zIndex: 20,
                }}>
                Settings
            </div>;

        element.appendChild(title);

        const names = Object.keys(this.settings);
        this.items = names.filter((item) => item !== 'center_select')
            .map((item, i) => ({name: item, checked: false, label: [
                'Show grid (G)',
                'Chase camera (H)',
                'Nonlinear scale (N)',
                'Units in KM (K)',
                'Center selected (C)'][i]}));
        this.valueElement = document.createElement('div');
        this.valueT = (props: SettingsControl) =>
            props.visible ? <div style={{
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '3px ridge #7f3f3f',
                padding: '3px',
                right: 0,
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
                                {this.items[i].checked = a[field] = !a[field]})(this.settings, item.name, i)}
                    />{item.label}</label></div>)}
            </div> : <div></div>;
        ReactDOM.render(this.valueT(this), this.valueElement);
        element.appendChild(this.valueElement);

        setSize();

        // Register event handlers
        window.addEventListener('resize', setSize);
        icon.ondragstart = (event) => event.preventDefault();
        icon.onclick = (event) => {
            this.visible = !this.visible;
            ReactDOM.render(this.valueT(this), this.valueElement);
            if(this.visible){
                element.style.background = 'rgba(0, 0, 0, 0.5)';
            }
            else{
                element.style.background = 'rgba(0, 0, 0, 0)';
            }
        };
        icon.onmouseenter = (event) => {
            this.mouseOver = true;
            ReactDOM.render(this.titleT(this), title);
            rightTitleSetSize(title, icon);
        };
        icon.onmouseleave = (event) => {
            this.mouseOver = false;
            ReactDOM.render(this.titleT(this), title);
        };

        window.addEventListener( 'keydown', (event: KeyboardEvent) => this.onKeyDown(event), false );
    }

    setText(){
        if(!this.visible)
            return;
        this.items[0].checked = this.settings.grid_enable;
        this.items[1].checked = this.settings.sync_rotate;
        this.items[2].checked = this.settings.nlips_enable;
        this.items[3].checked = this.settings.units_km;
        ReactDOM.render(this.valueT(this), this.valueElement);
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
