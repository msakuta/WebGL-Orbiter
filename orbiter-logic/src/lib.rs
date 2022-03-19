mod celestial_body;

use celestial_body::CelestialBody;
use cgmath::Zero;
use std::rc::Rc;

type Vector3 = cgmath::Vector3<f64>;
type Quaternion = cgmath::Quaternion<f64>;

const AU: f64 = 149597871.0; // Astronomical unit in kilometers
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)

pub struct Universe {
    sun: Rc<CelestialBody>,
    rocket: Rc<CelestialBody>,
    id_gen: usize,
}

impl Universe {
    fn new() -> Self {
        let mut id_gen = 0;
        let sun = CelestialBody::new(
            &mut id_gen,
            None,
            Vector3::zero(),
            "#ffffff".to_string(),
            GMsun,
            "sun".to_string(),
        );
        let rocket = CelestialBody::new(
            &mut id_gen,
            Some(sun.clone()),
            Vector3::zero(),
            "#3f7f7f".to_string(),
            100. / AU / AU / AU,
            "rocket".to_string(),
        );
        Self {
            sun,
            rocket,
            id_gen,
        }
    }
}

#[test]
fn test_universe() {
    let mut universe = Universe::new();
}
