use crate::{
    celestial_body::{
        builder::AddPlanetParams, iter::CelestialBodyDynIter, CelestialBody, CelestialBodyEntry,
        CelestialId, OrbitalElements,
    },
    session::SessionId,
    GMsun, Quaternion, Vector3, AU,
};
use cgmath::{InnerSpace, Rad, Rotation, Rotation3};
use rand::prelude::*;
use serde::{ser::SerializeMap, Serialize, Serializer};

#[derive(Debug)]
pub struct Universe {
    pub bodies: Vec<CelestialBodyEntry>,
    pub root: usize,
    pub id_gen: usize,
    sim_time: f64,
    start_time: f64,
    time: usize,
    pub time_scale: f64,
    /// Whenever a CelestialBody changes its parent, there is a chance that parent's children list
    /// become inconsistent with the child's parent id. It is especially true with both server and
    /// client tries to update the parent. This flag indicates that a parent has changed since last
    /// update and [`update_parent`] should be called.
    parent_dirty: bool,
}

impl Universe {
    pub fn new(now_unix: f64) -> Self {
        let mut this = Self {
            bodies: vec![],
            root: 0,
            id_gen: 0,
            sim_time: now_unix,
            start_time: now_unix,
            time: 0,
            time_scale: 1.,
            parent_dirty: false,
        };

        let sun = CelestialBody::builder()
            .gm(GMsun)
            .name("sun".to_string())
            .build(OrbitalElements::default());
        let sun_id = this.add_body(sun);

        let rad_per_deg = std::f64::consts::PI / 180.;

        let mercury = CelestialBody::builder()
            .name("mercury".to_string())
            .parent(sun_id)
            .orbit_color("#3f7f7f".to_string())
            .gm(22032. / AU / AU / AU)
            .radius(2439.7)
            .soi(2e5 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 0.387098,
                    eccentricity: 0.205630,
                    inclination: 7.005 * rad_per_deg,
                    ascending_node: 48.331 * rad_per_deg,
                    argument_of_perihelion: 29.124 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 2.04 * rad_per_deg,
                    rotation_period: 58.646 * 24. * 60. * 60.,
                },
            );
        this.add_body(mercury);

        let venus = CelestialBody::builder()
            .name("venus".to_string())
            .parent(sun_id)
            .orbit_color("#7f7f3f".to_string())
            .gm(324859. / AU / AU / AU)
            .radius(6051.8)
            .soi(2e5 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 0.723332,
                    eccentricity: 0.00677323,
                    inclination: 3.39458 * rad_per_deg,
                    ascending_node: 76.678 * rad_per_deg,
                    argument_of_perihelion: 55.186 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 2.64 * rad_per_deg,
                    rotation_period: -243. * 24. * 60. * 60.,
                },
            );
        this.add_body(venus);

        let earth = CelestialBody::builder()
            .name("earth".to_string())
            .parent(sun_id)
            .gm(398600. / AU / AU / AU)
            .radius(6534.)
            .soi(5e5 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 1.,
                    eccentricity: 0.0167086,
                    inclination: 0.,
                    ascending_node: -11.26064 * rad_per_deg,
                    argument_of_perihelion: 114.20783 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 23.4392811 * rad_per_deg,
                    rotation_period: ((23. * 60. + 56.) * 60. + 4.10),
                },
            );
        let earth_id = this.add_body(earth);

        let mut rocket = CelestialBody::builder()
            .name("rocket".to_string())
            .parent(earth_id)
            .controllable(true)
            .gm(100. / AU / AU / AU)
            .radius(0.1)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 10000. / AU,
                    eccentricity: 0.,
                    inclination: 0.,
                    ascending_node: 0.,
                    argument_of_perihelion: 0.,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams::default(),
            );

        let rot = <Quaternion as Rotation3>::from_angle_x(Rad(std::f64::consts::PI / 2.))
            * <Quaternion as Rotation3>::from_angle_y(Rad(std::f64::consts::PI / 2.));
        rocket.quaternion = rot;

        this.add_body(rocket);

        let moon = CelestialBody::builder()
            .name("moon".to_string())
            .parent(earth_id)
            .gm(4904.8695 / AU / AU / AU)
            .radius(1737.1)
            .soi(1e5 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 384399. / AU,
                    eccentricity: 0.048775,
                    inclination: -11.26064 * rad_per_deg,
                    ascending_node: 100.492 * rad_per_deg,
                    argument_of_perihelion: 114.20783 * rad_per_deg, //275.066 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 1.5424 * rad_per_deg,
                    rotation_period: 27.321661 * 24. * 60. * 60.,
                },
            );

        this.add_body(moon);

        let mars = CelestialBody::builder()
            .name("mars".to_string())
            .parent(sun_id)
            .gm(42828. / AU / AU / AU)
            .radius(3389.5)
            .soi(3e5 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 1.523679,
                    eccentricity: 0.0935,
                    inclination: 1.850 * rad_per_deg,
                    ascending_node: 49.562 * rad_per_deg,
                    argument_of_perihelion: 286.537 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 25.19 * rad_per_deg,
                    rotation_period: 24.6229 * 60. * 60.,
                },
            );

        this.add_body(mars);

        let jupiter = CelestialBody::builder()
            .name("jupiter".to_string())
            .parent(sun_id)
            .gm(126686534. / AU / AU / AU)
            .radius(69911.)
            .soi(10e6 / AU)
            .build_from_orbital_elements(
                &mut this,
                OrbitalElements {
                    semimajor_axis: 5.204267,
                    eccentricity: 0.048775,
                    inclination: 1.305 * rad_per_deg,
                    ascending_node: 100.492 * rad_per_deg,
                    argument_of_perihelion: 275.066 * rad_per_deg,
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 3.13 * rad_per_deg,
                    rotation_period: 9.925 * 60. * 60.,
                },
            );

        this.add_body(jupiter);

        // Randomly generate asteroids
        for i in 0..3 {
            let angle: Rad<f64> = Rad(random::<f64>() * std::f64::consts::PI * 2.);
            let position = Quaternion::from_angle_z(angle).rotate_vector(Vector3::new(
                0.1 * (random::<f64>() - 0.5),
                0.1 * (random::<f64>() - 0.5) + 1.,
                0.1 * (random::<f64>() - 0.5),
            )) * 2.5;

            let velocity = Quaternion::from_angle_z(angle).rotate_vector(
                Vector3::new(
                    (random::<f64>() - 0.5) * 0.3 - 1.,
                    (random::<f64>() - 0.5) * 0.3,
                    (random::<f64>() - 0.5) * 0.3,
                ) * (GMsun / position.magnitude()).sqrt(),
            );

            let asteroid_name = format!("asteroid{}", i);
            let asteroid = CelestialBody::builder()
                .name(asteroid_name.clone())
                .parent(sun_id)
                .gm(1e4 / AU / AU / AU)
                .position(position)
                ._velocity(velocity)
                .build(OrbitalElements::default());

            println!("Adding {}", asteroid_name);
            this.add_body(asteroid);
        }

        this
    }

    pub fn get(&self, id: CelestialId) -> Option<&CelestialBody> {
        if let Some(item) = self.bodies.get(id.id as usize) {
            if let Some(body) = item.dynamic.as_ref() {
                if item.gen == id.gen {
                    return Some(body);
                }
            }
        }
        None
    }

    pub fn get_mut(&mut self, id: CelestialId) -> Option<&mut CelestialBody> {
        if let Some(item) = self.bodies.get_mut(id.id as usize) {
            if let Some(body) = item.dynamic.as_mut() {
                if item.gen == id.gen {
                    return Some(body);
                }
            }
        }
        None
    }

    pub fn iter_bodies(&mut self) -> CelestialBodyDynIter {
        CelestialBodyDynIter::new_all(&mut self.bodies)
    }

    pub fn find_by_name(&self, name: &str) -> Option<(CelestialId, &CelestialBody)> {
        self.bodies
            .iter()
            .enumerate()
            .filter_map(|(i, entry)| {
                Some((
                    CelestialId {
                        id: i as u32,
                        gen: entry.gen,
                    },
                    entry.dynamic.as_ref()?,
                ))
            })
            .find(|(_, body)| body.name == name)
    }

    pub fn find_by_name_mut(&mut self, name: &str) -> Option<(CelestialId, &mut CelestialBody)> {
        self.bodies
            .iter_mut()
            .enumerate()
            .filter_map(|(i, entry)| {
                Some((
                    CelestialId {
                        id: i as u32,
                        gen: entry.gen,
                    },
                    entry.dynamic.as_mut()?,
                ))
            })
            .find(|(_, body)| body.name == name)
    }

    pub fn new_rocket(&mut self) -> (SessionId, CelestialId) {
        let earth_id = self
            .bodies
            .iter()
            .enumerate()
            .find(|(_, entry)| {
                entry
                    .dynamic
                    .as_ref()
                    .map(|body| body.name == "earth")
                    .unwrap_or(false)
            })
            .map(|(i, entry)| CelestialId {
                id: i as u32,
                gen: entry.gen,
            })
            .unwrap();

        let rad_per_deg = std::f64::consts::PI / 180.;

        let mut rng = thread_rng();

        let mut rocket = CelestialBody::builder()
            .name(format!("rocket{}", self.bodies.len()))
            .parent(earth_id)
            .controllable(true)
            .gm(100. / AU / AU / AU)
            .radius(0.1)
            .build_from_orbital_elements(
                self,
                OrbitalElements {
                    semimajor_axis: rng.gen_range(10000.0..20000.) / AU,
                    eccentricity: rng.gen_range(0.0..0.5),
                    inclination: rng.gen_range(0.0..30. * rad_per_deg),
                    ascending_node: rng.gen_range(0.0..360. * rad_per_deg),
                    argument_of_perihelion: rng.gen_range(0.0..360. * rad_per_deg),
                    epoch: 0.,
                    mean_anomaly: 0.,
                },
                AddPlanetParams {
                    axial_tilt: 0.,
                    rotation_period: 0.,
                },
            );

        let rot = <Quaternion as Rotation3>::from_angle_x(Rad(std::f64::consts::PI / 2.))
            * <Quaternion as Rotation3>::from_angle_y(Rad(std::f64::consts::PI / 2.));
        rocket.quaternion = rot;

        let session_id = SessionId::new();
        rocket.session_id = Some(session_id);

        let rocket_id = self.add_body(rocket);

        (session_id, rocket_id)
    }

    fn add_body(&mut self, body: CelestialBody) -> CelestialId {
        // First, find an empty slot
        let id = self
            .bodies
            .iter()
            .enumerate()
            .find(|(_, s)| s.dynamic.is_none())
            .map(|(i, slot)| CelestialId {
                id: i as u32,
                gen: slot.gen,
            })
            .unwrap_or_else(|| CelestialId {
                id: self.bodies.len() as u32,
                gen: 0,
            });

        if let Some(parent_id) = body.parent {
            if let Some(parent) = self.get_mut(parent_id) {
                // println!("Add {} to {}", ret.lock().unwrap().name, parent.name);
                parent.children.push(id);
            }
        }

        if id.id < self.bodies.len() as u32 {
            self.bodies[id.id as usize].dynamic = Some(body);

            println!(
                "Inserted to an empty slot: {}/{}, id: {:?}",
                self.bodies.iter().filter(|s| s.dynamic.is_none()).count(),
                self.bodies.len(),
                id
            );
        } else {
            self.bodies.push(CelestialBodyEntry {
                gen: 0,
                dynamic: Some(body),
            });
            println!(
                "Pushed to the end({:?}): {}/{}",
                id,
                self.bodies.iter().filter(|s| s.dynamic.is_none()).count(),
                self.bodies.len()
            );
        }

        id
    }

    pub fn split_bodies(
        bodies: &'_ mut [CelestialBodyEntry],
        i: usize,
    ) -> anyhow::Result<(&mut CelestialBody, CelestialBodyDynIter)> {
        let (body, rest) = CelestialBodyDynIter::new(bodies, i)?;
        if let Some(ref mut body) = body.dynamic {
            Ok((body, rest))
        } else {
            Err(anyhow::anyhow!("Split fail"))
        }
    }

    pub fn split_bodies_id(
        bodies: &'_ mut [CelestialBodyEntry],
        i: usize,
    ) -> anyhow::Result<(&mut CelestialBody, CelestialId, CelestialBodyDynIter)> {
        let (entry, rest) = CelestialBodyDynIter::new(bodies, i)?;
        if let Some(ref mut body) = entry.dynamic {
            let id = CelestialId {
                id: i as u32,
                gen: entry.gen,
            };
            Ok((body, id, rest))
        } else {
            Err(anyhow::anyhow!("Split fail"))
        }
    }

    pub fn simulate_bodies(&mut self, delta_time: f64, div: usize) {
        let mut bodies = std::mem::take(&mut self.bodies);
        for i in 0..bodies.len() {
            if let Ok((center, chained)) = Self::split_bodies(&mut bodies, i) {
                match center.simulate_body(chained, delta_time, div as f64) {
                    Ok(true) => self.parent_dirty = true,
                    Err(e) => println!("Error in simulate_body: {:?}", e),
                    _ => (),
                }
            }
        }
        self.update_parent(&mut bodies);
        self.bodies = bodies;
    }

    pub fn update(&mut self) {
        let mut bodies = std::mem::take(&mut self.bodies);

        self.update_parent(&mut bodies);
        self.bodies = bodies;

        let div = 100;
        for _ in 0..div {
            self.simulate_bodies(self.time_scale, div);
        }

        let mut bodies = std::mem::take(&mut self.bodies);
        for i in 0..bodies.len() {
            if let Ok((center, chained)) = Self::split_bodies(&mut bodies, i) {
                center.update(chained);
            }
        }
        self.update_parent(&mut bodies);
        self.bodies = bodies;
        self.time += 1;
        self.sim_time += self.time_scale;
    }

    pub fn update_parent(&mut self, bodies: &mut Vec<CelestialBodyEntry>) {
        if !self.parent_dirty {
            return;
        }

        for body in bodies.iter_mut() {
            if let Some(body) = body.dynamic.as_mut() {
                body.children.clear();
            }
        }

        for body_idx in 0..bodies.len() {
            if let Ok((body, id, mut rest)) = Self::split_bodies_id(bodies, body_idx) {
                if let Some(parent) = body.parent {
                    if let Some(parent_body) = rest.get_mut(parent) {
                        parent_body.children.push(id);
                    }
                }
            }
        }

        println!("Dirty parent repaired");
        self.parent_dirty = false;
    }

    pub fn mark_dirty(&mut self) {
        self.parent_dirty = true;
    }

    pub fn get_time(&self) -> usize {
        self.time
    }

    pub fn get_sim_time(&self) -> f64 {
        self.sim_time
    }
}

/// A wrapper struct to serialize a quaternion to THREE.js friendly format.
struct CelestialBodyEntrySerial(CelestialBodyEntry);

impl Serialize for CelestialBodyEntrySerial {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.dynamic.serialize(serializer)
    }
}

impl Serialize for Universe {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(3))?;
        map.serialize_entry("simTime", &self.sim_time)?;
        map.serialize_entry("startTime", &self.start_time)?;
        map.serialize_entry(
            "bodies",
            &self
                .bodies
                .iter()
                .map(|entry| &entry.dynamic)
                .collect::<Vec<_>>(),
        )?;
        map.serialize_entry("timeScale", &self.time_scale)?;
        map.end()
    }
}

impl Universe {
    pub fn deserialize(&mut self, json: serde_json::Value) -> anyhow::Result<()> {
        if let serde_json::Value::Object(map) = json {
            if let Some(v) = map.get("simTime").and_then(|v| v.as_f64()) {
                self.sim_time = v;
            }
            if let Some(v) = map.get("startTime").and_then(|v| v.as_f64()) {
                self.start_time = v;
            }
            if let Some(serde_json::Value::Array(arr)) = map.get("bodies") {
                self.bodies = arr
                    .iter()
                    .map(|v| {
                        let cel = CelestialBody::deserialize(v)?;
                        Ok(CelestialBodyEntry {
                            dynamic: Some(cel),
                            gen: 0,
                        })
                    })
                    .collect::<anyhow::Result<Vec<_>>>()?;
                self.id_gen = self.bodies.len();
            }
            if let Some(v) = map.get("timeScale").and_then(|v| v.as_f64()) {
                self.time_scale = v;
            }
        }
        Ok(())
    }
}

pub fn serialize(this: &Universe) -> serde_json::Result<String> {
    serde_json::to_string(&this)
}

#[test]
fn test_universe() {
    let _ = Universe::new(0.);
}
