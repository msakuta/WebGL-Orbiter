mod celestial_body;

pub use crate::celestial_body::{AddPlanetParams, CelestialBody, OrbitalElements};
use cgmath::{Rad, Rotation3, Zero};
use std::sync::{Arc, Mutex};

type Vector3 = cgmath::Vector3<f64>;
type Quaternion = cgmath::Quaternion<f64>;

const AU: f64 = 149597871.0; // Astronomical unit in kilometers
const GMsun: f64 = 1.327124400e11 / AU / AU / AU; // Product of gravitational constant (G) and Sun's mass (Msun)

#[derive(Debug)]
pub struct Universe {
    pub bodies: Vec<Arc<Mutex<CelestialBody>>>,
    pub root: usize,
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
            OrbitalElements::default(),
        );

        let rad_per_deg = std::f64::consts::PI / 180.;

        let params = AddPlanetParams {
            axial_tilt: 23.4392811 * rad_per_deg,
            rotation_period: ((23. * 60. + 56.) * 60. + 4.10),
            // soi: 5e5,
            quaternion: Quaternion::new(1., 0., 0., 0.),
            angular_velocity: Vector3::zero(),
        };

        let earth = CelestialBody::from_orbital_elements(
            &mut id_gen,
            Some(sun.clone()),
            OrbitalElements {
                semimajor_axis: 1.,
                eccentricity: 0.0167086,
                inclination: 0.,
                ascending_node: -11.26064 * rad_per_deg,
                argument_of_perihelion: 114.20783 * rad_per_deg,
                epoch: 0.,
                mean_anomaly: 0.,
                soi: 1.,
            },
            398600. / AU / AU / AU,
            6534.,
            "earth".to_string(),
        );

        let rocket = CelestialBody::new(
            &mut id_gen,
            Some(earth.clone()),
            Vector3::new(104200., 0., 0.),
            "#3f7f7f".to_string(),
            100. / AU / AU / AU,
            "rocket".to_string(),
            OrbitalElements::default(),
        );

        let rot = <Quaternion as Rotation3>::from_angle_x(Rad(std::f64::consts::PI / 2.))
            * <Quaternion as Rotation3>::from_angle_y(Rad(std::f64::consts::PI / 2.));
        rocket.lock().unwrap().quaternion = rot;

        let bodies = vec![sun, earth, rocket];

        Self {
            bodies,
            root: 0,
            id_gen,
            time: 0,
        }
    }

    pub fn update(&mut self) {
        let mut sun = self.bodies[0].lock().unwrap();
        let div = 10;
        for _ in 0..div {
            sun.simulate_body(1., div as f64, 1.);
        }
        sun.update();
        println!(
            "Sun refs: {}/{}",
            Arc::strong_count(&self.bodies[0]),
            Arc::weak_count(&self.bodies[0])
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
