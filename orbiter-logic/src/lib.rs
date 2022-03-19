mod celestial_body;

use celestial_body::CelestialBody;
use cgmath::{Rad, Rotation3, Zero};
use std::{cell::RefCell, rc::Rc};

type Vector3 = cgmath::Vector3<f64>;
type Quaternion = cgmath::Quaternion<f64>;

const AU: f64 = 149597871.0; // Astronomical unit in kilometers
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)

#[derive(Debug)]
pub struct Universe {
    sun: Rc<RefCell<CelestialBody>>,
    rocket: Rc<RefCell<CelestialBody>>,
    id_gen: usize,
}

impl Universe {
    pub fn new() -> Self {
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
            Vector3::new(104200., 0., 0.),
            "#3f7f7f".to_string(),
            100. / AU / AU / AU,
            "rocket".to_string(),
        );

        let rot = <Quaternion as Rotation3>::from_angle_x(Rad(std::f64::consts::PI / 2.))
            * <Quaternion as Rotation3>::from_angle_y(Rad(std::f64::consts::PI / 2.));
        rocket.borrow_mut().quaternion = rot;

        Self {
            sun,
            rocket,
            id_gen,
        }
    }

    pub fn update(&mut self) {
        let mut sun = self.sun.borrow_mut();
        let div = 10;
        for _ in 0..div {
            sun.simulate_body(1., div as f64, 1.);
        }
        sun.update();
        println!(
            "Sun refs: {}/{}",
            Rc::strong_count(&self.sun),
            Rc::weak_count(&self.sun)
        );
    }
}

#[test]
fn test_universe() {
    let mut universe = Universe::new();
}
