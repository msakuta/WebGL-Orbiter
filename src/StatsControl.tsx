import { rightTitleSetSize, SettingsControl } from './SettingsControl';
import { ContainerControl } from './ContainerControl';
import { CelestialBody, AU } from './CelestialBody';
import * as React from "react";

import statsIconUrl from './images/statsIcon.png';


const buttonTop = 0;
const buttonHeight = 32;
const buttonWidth = 32;

// Fills leading zero if the value is less than 10, making the returned string always two characters long.
// Note that values not less than 100 or negative values are not guaranteed to be two characters wide.
// This function is for date time formatting purpose only.
export function zerofill(v: number){
	if(v < 10)
		return "0" + v;
	else
		return v;
}

export interface StatsControlProps{
    select_obj: CelestialBody;
    items: {title: string, value: string}[];
}

export class StatsControl extends React.Component<StatsControlProps, {visible: boolean}>{
    constructor(props: StatsControlProps){
        super(props);
        this.state = {visible: false};
    }

    render(){
        return <ContainerControl
            buttonTop={buttonTop}
            buttonWidth={buttonWidth}
            buttonHeight={buttonHeight}
            iconUrl={statsIconUrl}
            caption="Statistics"
            visible={this.state.visible}
            onSetVisible={(v) => this.setState({visible: v})}
        ><div style={{
            pointerEvents: 'auto',
            display: 'inline',
            float: 'right',
            clear: 'both',
            background: 'rgba(0, 0, 0, 0.5)',
            border: '3px ridge #7f3f3f',
            padding: '3px',
        }}>
        {
            this.props.items.map((item, i) => <>
                <div
                key={`title-${i}`}
                style={{
                    fontWeight: 'bold',
                    paddingRight: '1em',
                }}>{item.title}</div>
                <div
                key={`value-${i}`}
                style={{
                    textAlign: 'right',
                }}>{item.value}</div>
            </>)
        }
        </div></ContainerControl>;
    }

    static setText(statsItems: {title: string, value: string}[], select_obj: CelestialBody, missionTime: number){
        if(!select_obj){
            statsItems[3].value = statsItems[2].value = '';
            return;
        }
        const totalSeconds = missionTime / 1e3;
        const seconds = Math.floor(totalSeconds) % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 60 / 60) % 24;
        const days = Math.floor(totalSeconds / 60 / 60 / 24);
        statsItems[0].value = days + 'd ' + zerofill(hours) + ':' + zerofill(minutes) + ':' + zerofill(seconds);
        const deltaVkm = select_obj.totalDeltaV * AU;
        let deltaV;
        if(deltaVkm < 10)
            deltaV = (deltaVkm * 1e3).toFixed(1) + 'm/s';
        else
            deltaV = deltaVkm.toFixed(4) + 'km/s';
        statsItems[1].value = deltaV;
        statsItems[2].value = select_obj.ignitionCount.toString();
    }
}
