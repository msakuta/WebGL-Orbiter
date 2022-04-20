pub mod celestial_body;
pub mod dyn_iter;
mod protocol;
pub mod quaternion;
mod session;
mod universe;

pub use crate::{
    celestial_body::{
        comb::{CelestialBodyComb, CelestialBodyImComb},
        CelestialBody, CelestialId, OrbitalElements,
    },
    protocol::{SetRocketStateWs, WsMessage},
    session::SessionId,
    universe::{serialize, Universe},
};

pub type Vector3 = cgmath::Vector3<f64>;
pub type Quaternion = cgmath::Quaternion<f64>;

#[allow(non_upper_case_globals)]
const AU: f64 = 149597871.0; // Astronomical unit in kilometers
#[allow(non_upper_case_globals)]
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)
