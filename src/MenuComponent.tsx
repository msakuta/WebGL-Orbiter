import * as React from "react";
import { ContainerControl } from './ContainerControl';

import closeIconUrl from './images/closeIcon.png';

export class Config{
    buttonTop = 154;
    buttonWidth = 32;
    buttonHeight = 32;
}


export interface MenuComponentProps{
    caption: string,
    innerTitle?: string;
    config: Config,
    iconUrl: string,
    visible: boolean,
    style?: string,
    onSetVisible: (v: boolean) => void,
    children: JSX.Element,
}

export class MenuComponent extends React.Component<MenuComponentProps>{
    constructor(props: MenuComponentProps){
        super(props);
    }

    render(){

        const closeIcon = <img src={closeIconUrl}
            style={{
                position: "absolute",
                top: 0,
                right: 0,
                border: "inset 1px #7f7f7f"
            }}
            onDragStart={(event) => event.preventDefault()}
            onClick={(event) => this.props.onSetVisible(false)}
            />;

        const titleElement = <div
            style={{
                margin: 15,
                padding: 15,
                fontSize: 25,
            }}>
            {this.props.innerTitle ?? this.props.caption}
        </div>;

        const valueElement = <div
        style={{
            border: this.props.style ?? "5px ridge #ffff7f",
            pointerEvents: "auto",
            position: "fixed",
            left: 0,
            right: 0,
            marginRight: "auto",
            marginLeft: "auto",
            width: "300px",
            top: 0,
            bottom: 0,
            marginTop: "auto",
            marginBottom: "auto",
            height: "70%",
            backgroundColor: "rgba(0,0,0,0.85)",
            fontSize: 15,
            textAlign: "center",
            fontFamily: "Sans-Serif",
            overflowY: "auto",
        }}
        >{titleElement}{closeIcon}{this.props.children}</div>;

        const container = <ContainerControl
            buttonTop={this.props.config.buttonTop}
            buttonWidth={this.props.config.buttonWidth}
            buttonHeight={this.props.config.buttonWidth}
            iconUrl={this.props.iconUrl}
            caption={this.props.caption}
            visible={this.props.visible}
            onSetVisible={(v) => this.props.onSetVisible(v)}
        >{valueElement}</ContainerControl>;

        return container;
    }
}
