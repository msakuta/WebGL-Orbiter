import * as React from "react";

export interface ContainerControlProps {
    buttonTop: number;
    buttonWidth: number;
    buttonHeight: number;
    side?: "left" | "right";
    children: JSX.Element;
    iconUrl: string;
    caption: string;
    visible: boolean;
    onSetVisible: (v: boolean) => void;
}

export class ContainerControl extends React.Component<ContainerControlProps, {mouseOver: boolean}>{

    render(): JSX.Element{

        const iconT =
            <img src={this.props.iconUrl}
                style={{
                    pointerEvents: 'auto',
                    float: this.props.side ?? 'right',
                    width: this.props.buttonWidth + 'px',
                    height: this.props.buttonHeight + 'px',
                }}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                    this.props.onSetVisible(!this.props.visible);
                }}
                onMouseEnter={(event) => {
                    this.setState({mouseOver: true});
                }}
                onMouseLeave={(event) => {
                    this.setState({mouseOver: false});
                }}
            />;
        const titleT =
            <div
                style={{
                    display: this.props.visible || this.state.mouseOver ? "inline" : "none",
                    position: "relative",
                    float: this.props.side ?? 'right',
                    background: this.props.visible ? 'rgba(0, 0, 0, 0.5)' : '',
                    bottom: 0,
                    right: 0,
                    top: (this.props.buttonHeight - 20) + 'px',
                    zIndex: 20,
                }}>
                {this.props.caption}
            </div>;

        return <div
            style={{
                float: this.props.side ?? 'right',
                clear: 'both',
                textAlign: 'left',
                marginTop: 2,
                zIndex: 7,
            }}>{iconT}
            {titleT}
            {this.props.visible ? this.props.children : ''}</div>;
    }

    constructor(props: ContainerControlProps){
        super(props);
        this.state = {mouseOver: false};
    }
}
