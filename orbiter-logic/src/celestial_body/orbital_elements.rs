use crate::Vector3;
use ::cgmath::Zero;
use ::serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Default, Debug)]
pub struct OrbitalElementsInput {
    pub semimajor_axis: f64,
    pub ascending_node: f64,
    pub inclination: f64,
    pub eccentricity: f64,
    pub epoch: f64,
    pub argument_of_perihelion: f64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct OrbitalElements {
    pub semimajor_axis: f64,
    pub ascending_node: f64,
    pub inclination: f64,
    pub eccentricity: f64,
    pub epoch: f64,
    pub mean_anomaly: f64,
    pub argument_of_perihelion: f64,
    #[serde(skip_deserializing, default = "Vector3::zero")]
    pub angular_momentum: Vector3,
    #[serde(skip_deserializing)]
    pub heading_apoapsis: bool,
    #[serde(skip_deserializing, default = "Vector3::zero")]
    pub orbit_position: Vector3,
}

impl Default for OrbitalElements {
    fn default() -> Self {
        Self {
            semimajor_axis: 0.,
            ascending_node: 0.,
            inclination: 0.,
            eccentricity: 0.,
            epoch: 0.,
            mean_anomaly: 0.,
            argument_of_perihelion: 0.,
            angular_momentum: Vector3::zero(),
            heading_apoapsis: false,
            orbit_position: Vector3::zero(),
        }
    }
}

impl From<OrbitalElementsInput> for OrbitalElements {
    fn from(input: OrbitalElementsInput) -> Self {
        Self {
            semimajor_axis: input.semimajor_axis,
            ascending_node: input.ascending_node,
            inclination: input.inclination,
            eccentricity: input.eccentricity,
            epoch: input.epoch,
            mean_anomaly: 0.,
            argument_of_perihelion: input.argument_of_perihelion,
            angular_momentum: Vector3::zero(),
            heading_apoapsis: false,
            orbit_position: Vector3::zero(),
        }
    }
}
