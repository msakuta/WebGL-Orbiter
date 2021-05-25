import settingsIconUrl from './images/settingsIcon.png';

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

export class SimulationSettings{
    bounce_on_collision = false;
}

export class SettingsControl{
    config = new Config();
    protected settings: Settings;
    protected simulationSettings: SimulationSettings;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }
    protected valueElement: HTMLDivElement;
    protected checkElements: HTMLInputElement[] = [];
    protected visible = false;

    constructor(settings: Settings, simulationSettings: SimulationSettings, config?: Config){
        const setSize = () => {
            this.element.style.left = (window.innerWidth - this.config.buttonWidth) + 'px';
            rightTitleSetSize(title, icon);
        }

        this.settings = settings;
        this.simulationSettings = simulationSettings;
        if(config) this.config = config;
        this.element = document.createElement('div');
        const element = this.domElement;
        element.style.position = 'absolute';
        element.style.textAlign = 'left';
        element.style.top = this.config.buttonTop + 'px';
        element.style.left = 0 + 'px';
        element.style.zIndex = '7';
        const icon = document.createElement('img');
        icon.src = settingsIconUrl;
        icon.style.width = this.config.buttonWidth + 'px';
        icon.style.height = this.config.buttonHeight + 'px';
        element.appendChild(icon);

        const title = document.createElement('div');
        title.innerHTML = 'Settings';
        title.style.display = 'none';
        title.style.position = 'absolute';
        title.style.background = 'rgba(0, 0, 0, 0.5)';
        title.style.zIndex = '20';
        element.appendChild(title);

        this.valueElement = document.createElement('div');
        element.appendChild(this.valueElement);
        this.valueElement.style.display = 'none';
        this.valueElement.style.position = 'absolute';
        this.valueElement.style.background = 'rgba(0, 0, 0, 0.5)';
        this.valueElement.style.border = '3px ridge #7f3f3f';
        this.valueElement.style.padding = '3px';
        const names = Object.keys(this.settings);

        let counter = 0;
        const addButton = (name: string, caption: string, onclick: (event: MouseEvent) => void) => {
            // Hide center_select from visible options
            const lineElement = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.onclick = onclick;
            const id = 'settings_check_' + counter++;
            checkbox.setAttribute('id', id);
            lineElement.appendChild(checkbox);
            this.checkElements.push(checkbox);
            const label = document.createElement('label');
            label.setAttribute('for', id);
            label.innerHTML = caption;
            lineElement.appendChild(label);
            lineElement.style.fontWeight = 'bold';
            lineElement.style.paddingRight = '1em';
            lineElement.style.whiteSpace = 'nowrap';
            this.valueElement.appendChild(lineElement);
        };

        for(const i in names){
            const name = names[i];
            if(name === 'center_select')
                continue;
            addButton(name, [
                'Show&nbsp;grid&nbsp;(G)',
                'Chase&nbsp;camera&nbsp;(H)',
                'Nonlinear&nbsp;scale&nbsp;(N)',
                'Units in KM&nbsp;(K)',
                'Center selected&nbsp;(C)'][i],
                ((a: any, field) => (_event: MouseEvent) => a[field] = !a[field])(this.settings, name));
        }

        addButton('bounce_on_collision', 'Bounce on Collision (B)',
            (_event: MouseEvent) => this.simulationSettings.bounce_on_collision = !this.simulationSettings.bounce_on_collision);

        setSize();

        // Register event handlers
        window.addEventListener('resize', setSize);
        icon.ondragstart = (event) => event.preventDefault();
        icon.onclick = (event) => {
            this.visible = !this.visible;
            if(this.visible){
                this.valueElement.style.display = 'block';
                element.style.background = 'rgba(0, 0, 0, 0.5)';
            }
            else{
                this.valueElement.style.display = 'none';
                element.style.background = 'rgba(0, 0, 0, 0)';
            }
        };
        icon.onmouseenter = (event) => {
            if(!this.visible)
                title.style.display = 'block';
            rightTitleSetSize(title, icon);
        };
        icon.onmouseleave = (event) => {
            if(!this.visible)
                title.style.display = 'none';
        };

        window.addEventListener( 'keydown', (event: KeyboardEvent) => this.onKeyDown(event), false );
    }

    setText(){
        if(!this.visible)
            return;
        for(let pair of [[0, "grid_enable"], [1, "sync_rotate"], [2, "nlips_enable"], [3, "units_km"], [4, "bounce_on_collision"]] as [number, string][])
            this.checkElements[pair[0]].checked = (this.settings as any)[pair[1]];
        for(let pair of [[4, "bounce_on_collision"]] as [number, string][])
            this.checkElements[pair[0]].checked = (this.simulationSettings as any)[pair[1]];
        this.valueElement.style.marginLeft = (this.config.buttonWidth - this.valueElement.getBoundingClientRect().width) + 'px';
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

        case 'b':
            this.simulationSettings.bounce_on_collision = !this.simulationSettings.bounce_on_collision;
            break;
        }
    }
}
