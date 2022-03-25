mod celestial_body;
mod dyn_iter;
mod session;
mod universe;

pub use crate::celestial_body::{CelestialBody, CelestialId, OrbitalElements};
pub use crate::session::SessionId;
pub use crate::universe::{serialize, Universe};

pub type Vector3 = cgmath::Vector3<f64>;
pub type Quaternion = cgmath::Quaternion<f64>;

#[allow(non_upper_case_globals)]
const AU: f64 = 149597871.0; // Astronomical unit in kilometers
#[allow(non_upper_case_globals)]
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)
