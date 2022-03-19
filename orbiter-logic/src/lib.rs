mod celestial_body;

use celestial_body::CelestialBody;
use cgmath::{Rad, Rotation3, Zero};
use std::{
    cell::RefCell,
    sync::{Arc, Mutex},
};

type Vector3 = cgmath::Vector3<f64>;
type Quaternion = cgmath::Quaternion<f64>;

const AU: f64 = 149597871.0; // Astronomical unit in kilometers
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)

#[derive(Debug)]
pub struct Universe {
    pub sun: Arc<Mutex<CelestialBody>>,
    rocket: Arc<Mutex<CelestialBody>>,
    id_gen: usize,
    time: usize,
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
        rocket.lock().unwrap().quaternion = rot;

        Self {
            sun,
            rocket,
            id_gen,
            time: 0,
        }
    }

    pub fn update(&mut self) {
        let mut sun = self.sun.lock().unwrap();
        let div = 10;
        for _ in 0..div {
            sun.simulate_body(1., div as f64, 1.);
        }
        sun.update();
        println!(
            "Sun refs: {}/{}",
            Arc::strong_count(&self.sun),
            Arc::weak_count(&self.sun)
        );
        self.time += 1;
    }

    pub fn get_time(&self) -> usize {
        self.time
    }
}

#[test]
fn test_universe() {
    let _ = Universe::new();
}
