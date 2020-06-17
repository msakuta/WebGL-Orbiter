import { ContainerControl } from './ContainerControl';
import { CelestialBody, AU } from './CelestialBody';
import * as React from "react";

import orbitIconUrl from './images/orbitIcon.png';

const buttonTop = 120;
const buttonLeft = 0;
const buttonHeight = 32;
const buttonWidth = 32;

export class OrbitalElementsControlProps{
    body: CelestialBody;
    headingApoapsis: number;
    units_km: boolean;
}

export class OrbitalElementsControl extends React.Component<OrbitalElementsControlProps, {visible: boolean}>{
    protected valueElement: HTMLElement;
    protected element: HTMLElement;
    get domElement(): HTMLElement{ return this.element; }

    constructor(props: OrbitalElementsControlProps){
        super(props);
        this.state = {visible: false};
    }

    render(){
        // Convert length of unit au into a fixed-length string considering user unit selection.
        // Also appends unit string for clarity.
        const unitConvLength = (au: number) => {
            if(this.props.units_km)
                return (au * AU).toPrecision(10) + ' km';
            else
                return au.toFixed(10) + ' AU';
        }

        const body = this.props.body;

        return <div style={{
            position: "absolute",
            top: "120px",
        }}
        ><ContainerControl
            buttonTop={buttonTop}
            buttonWidth={buttonWidth}
            buttonHeight={buttonHeight}
            iconUrl={orbitIconUrl}
            side='left'
            caption="Orbital Elements"
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
            <table className="table1">
                <tr><td>e</td><td>{(body.eccentricity || 0).toFixed(10)}</td></tr>
                <tr><td>a</td><td>{unitConvLength(body.semimajor_axis)}</td></tr>
                <tr><td>i</td><td>{(body.inclination / Math.PI).toFixed(10)}</td></tr>
                <tr><td>Omega</td><td>{(body.ascending_node / Math.PI).toFixed(10)}</td></tr>
                <tr><td>w</td><td>{(body.argument_of_perihelion / Math.PI).toFixed(10)}</td></tr>
                <tr><td>Periapsis</td><td>{unitConvLength(body.semimajor_axis * (1 - body.eccentricity))}</td></tr>
                <tr><td>Apoapsis</td><td>{unitConvLength(body.semimajor_axis * (1 + body.eccentricity))}</td></tr>
                <tr><td>head</td><td>{this.props.headingApoapsis.toFixed(5)}</td></tr>
            {/* ' omega=' + this.angularVelocity.x.toFixed(10) + ',' + '<br>' + this.angularVelocity.y.toFixed(10) + ',' + '<br>' + this.angularVelocity.z.toFixed(10) */}
            </table>
        }
        </div></ContainerControl></div>;
    }
}
