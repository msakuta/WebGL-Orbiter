mod celestial_body;
mod dyn_iter;
mod session;
mod universe;

pub use crate::celestial_body::{AddPlanetParams, CelestialBody, OrbitalElements};
pub use crate::universe::{serialize, Universe};

type Vector3 = cgmath::Vector3<f64>;
type Quaternion = cgmath::Quaternion<f64>;

const AU: f64 = 149597871.0; // Astronomical unit in kilometers
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)
