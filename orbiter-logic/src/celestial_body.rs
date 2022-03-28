pub(crate) mod builder;

use self::builder::CelestialBodyBuilder;
use super::{Quaternion, Universe, Vector3};
use crate::{dyn_iter::DynIterMut, session::SessionId};
use anyhow::anyhow;
use cgmath::{InnerSpace, Rad, Rotation, Rotation3, Zero};
use serde::{ser::SerializeMap, Deserialize, Serialize, Serializer};

#[allow(non_upper_case_globals)]
const Rsun: f64 = 695800.;
const EPSILON: f64 = 1e-40; // Doesn't the machine epsilon depend on browsers!??
                            // const acceleration: f64 = 5e-10;

#[derive(Deserialize, Serialize, Default, Debug)]
pub struct OrbitalElements {
    pub semimajor_axis: f64,
    pub ascending_node: f64,
    pub inclination: f64,
    pub eccentricity: f64,
    pub epoch: f64,
    pub mean_anomaly: f64,
    pub argument_of_perihelion: f64,
}

pub type CelestialId = usize;

#[allow(non_snake_case)]
#[derive(Debug)]
pub struct CelestialBody {
    pub id: CelestialId,
    pub name: String,
    pub position: Vector3,
    pub velocity: Vector3,
    pub quaternion: Quaternion,
    pub angular_velocity: Vector3,
    orbit_color: String,
    model_color: String,
    pub children: Vec<CelestialId>,
    pub parent: Option<CelestialId>,
    pub session_id: Option<SessionId>,

    GM: f64,
    radius: f64,

    orbital_elements: OrbitalElements,
    pub soi: f64,
}

impl Default for CelestialBody {
    fn default() -> Self {
        Self {
            id: 0,
            name: "".to_string(),
            position: Vector3::zero(),
            velocity: Vector3::zero(),
            quaternion: Quaternion::new(1., 0., 0., 0.),
            angular_velocity: Vector3::zero(),
            orbit_color: "".to_string(),
            model_color: "1 1 1".to_string(),
            children: vec![],
            parent: None,
            session_id: None,
            GM: super::GMsun,
            radius: Rsun,
            orbital_elements: OrbitalElements::default(),
            soi: 0.,
        }
    }
}

impl CelestialBody {
    pub(super) fn builder() -> CelestialBodyBuilder {
        CelestialBodyBuilder::new()
    }

    pub fn get_session_id(&self) -> Option<SessionId> {
        self.session_id
    }

    fn set_orbiting_velocity<'a>(
        &'a mut self,
        mut bodies: impl Iterator<Item = &'a CelestialBody>,
        semimajor_axis: f64,
        rotation: Quaternion,
    ) {
        if let Some(parent) = self.parent {
            if let Some(parent) = bodies.find(|body| body.id == parent) {
                self.velocity = rotation.rotate_vector(
                    Vector3::new(1., 0., 0.)
                        * (parent.GM * (2. / self.position.magnitude() - 1. / semimajor_axis))
                            .sqrt(),
                );
            }
        }
    }

    /// Update orbital elements from position and velocity.
    /// The whole discussion is found in chapter 4.4 in
    /// https://www.academia.edu/8612052/ORBITAL_MECHANICS_FOR_ENGINEERING_STUDENTS
    pub(crate) fn update(&mut self, mut bodies: impl DynIterMut<Item = CelestialBody>) {
        if let Some(parent) = self
            .parent
            .and_then(|parent| bodies.dyn_iter_mut().find(|body| body.id == parent))
        {
            // Angular momentum vectors
            let ang = self.velocity.cross(self.position);
            let r = self.position.magnitude();
            let v = self.velocity.magnitude();
            // Node vector
            let n = Vector3::new(0., 0., 1.).cross(ang);
            // Eccentricity vector
            let e = self.position.clone() * (1. / parent.GM * (v * v - parent.GM / r))
                - self.velocity * (self.position.dot(self.velocity) / parent.GM);
            self.orbital_elements.eccentricity = e.magnitude();
            self.orbital_elements.inclination = (-ang.z / ang.magnitude()).acos();
            // Avoid zero division
            if n.magnitude2() <= EPSILON {
                self.orbital_elements.ascending_node = 0.;
            } else {
                self.orbital_elements.ascending_node = (n.x / n.magnitude()).acos();
                if n.y < 0. {
                    self.orbital_elements.ascending_node =
                        2. * std::f64::consts::PI - self.orbital_elements.ascending_node;
                }
            }
            self.orbital_elements.semimajor_axis = 1. / (2. / r - v * v / parent.GM);

            // Rotation to perifocal frame
            // let ascending_node_rot = <Quaternion as Rotation3>::from_axis_angle(
            //     Vector3::new(0., 0., 1.),
            //     Rad(self.orbital_elements.ascending_node - std::f64::consts::PI / 2.),
            // );
            // let inclination_rot = Quaternion::from_axis_angle(
            //     Vector3::new(0., 1., 0.),
            //     Rad(std::f64::consts::PI - self.orbital_elements.inclination),
            // );
            // let plane_rot = ascending_node_rot * inclination_rot;

            // let heading_apoapsis =
            //     -self.position.dot(self.velocity) / (self.position.dot(self.velocity)).abs();

            // Avoid zero division and still get the correct answer when N == 0.
            // This is necessary to draw orbit with zero inclination and nonzero eccentricity.
            if n.magnitude2() <= EPSILON || e.magnitude2() <= EPSILON {
                self.orbital_elements.argument_of_perihelion =
                    (if ang.z < 0. { -e.y } else { e.y }).atan2(e.x);
            } else {
                self.orbital_elements.argument_of_perihelion =
                    (n.dot(e) / n.magnitude() / e.magnitude()).acos();
                if e.z < 0. {
                    self.orbital_elements.argument_of_perihelion =
                        2. * std::f64::consts::PI - self.orbital_elements.argument_of_perihelion;
                }
            }
        }
    }

    pub(crate) fn simulate_body(
        &self,
        mut bodies: impl DynIterMut<Item = CelestialBody>,
        delta_time: f64,
        div: f64,
    ) {
        // let children = &self.children;
        for body in bodies.dyn_iter_mut() {
            if self.children.iter().find(|id| **id == body.id).is_none() {
                continue;
            }
            let a = body;
            let sl = a.position.magnitude2();
            // println!(
            //     "Body {} simulating with {}... sl: {}",
            //     a.name, delta_time, sl
            // );
            if sl != 0. {
                let accel = -a.position.normalize() * (delta_time / div * self.GM / sl);
                let dvelo = accel * 0.5;
                let vec0 = a.position + a.velocity.clone() * (delta_time / div / 2.);
                let accel1 = -vec0.normalize() * (delta_time / div * self.GM / vec0.magnitude2());
                let velo1 = a.velocity + dvelo;

                a.velocity += accel1;
                a.position += velo1 * (delta_time / div);
                if 0. < a.angular_velocity.magnitude2() {
                    let axis = a.angular_velocity.normalize();
                    // We have to multiply in this order!
                    a.quaternion = Quaternion::from_axis_angle(
                        axis,
                        Rad(a.angular_velocity.magnitude() * delta_time / div),
                    ) * a.quaternion;
                }
            }
            // a.simulate_body(bodies, delta_time, div, timescale);
        }
    }
}

/// A wrapper struct to serialize a quaternion to THREE.js friendly format.
struct QuaternionSerial(Quaternion);

impl Serialize for QuaternionSerial {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("_x", &self.0.v.x)?;
        map.serialize_entry("_y", &self.0.v.y)?;
        map.serialize_entry("_z", &self.0.v.z)?;
        map.serialize_entry("_w", &self.0.s)?;
        map.end()
    }
}

impl Serialize for CelestialBody {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("id", &self.id)?;
        map.serialize_entry("name", &self.name)?;
        map.serialize_entry("position", &self.position)?;
        map.serialize_entry("velocity", &self.velocity)?;
        map.serialize_entry("quaternion", &QuaternionSerial(self.quaternion))?;
        map.serialize_entry("angularVelocity", &self.angular_velocity)?;
        map.serialize_entry("orbitColor", &self.orbit_color)?;
        map.serialize_entry("modelColor", &self.model_color)?;
        map.serialize_entry("children", &self.children)?;
        map.serialize_entry("parent", &self.parent)?;
        map.serialize_entry("sessionId", &self.session_id)?;
        map.serialize_entry("radius", &self.radius)?;
        map.serialize_entry("GM", &self.GM)?;
        map.serialize_entry("orbitalElements", &self.orbital_elements)?;
        map.end()
    }
}

impl CelestialBody {
    /// We don't use serde deserializer since our json format is too complex
    pub(crate) fn deserialize(json: &serde_json::Value) -> anyhow::Result<Self> {
        let map = if let serde_json::Value::Object(map) = json {
            map
        } else {
            return Err(anyhow!(""));
        };
        let mut ret = CelestialBody::default();
        let deserialize_usize = |target: &mut usize, key: &str| {
            if let Some(v) = map.get(key).and_then(|v| v.as_u64()) {
                *target = v as usize;
            }
        };
        let deserialize_f64 =
            |target: &mut f64, map: &serde_json::Map<String, serde_json::Value>, key: &str| {
                if let Some(v) = map.get(key).and_then(|v| v.as_f64()) {
                    *target = v as f64;
                }
            };
        let deserialize_str = |target: &mut String, key: &str| {
            if let Some(v) = map.get(key).and_then(|v| v.as_str()) {
                *target = v.to_string();
            }
        };
        let deserialize_vector3 = |target: &mut Vector3, key: &str| -> anyhow::Result<()> {
            if let Some(v) = map.get(key) {
                *target = serde_json::from_value(v.clone())?;
            }
            Ok(())
        };
        let deserialize_quaternion = |target: &mut Quaternion, key: &str| {
            if let Some(serde_json::Value::Object(v)) = map.get(key) {
                deserialize_f64(&mut target.s, v, "w");
                deserialize_f64(&mut target.v.x, v, "x");
                deserialize_f64(&mut target.v.y, v, "y");
                deserialize_f64(&mut target.v.z, v, "z");
            }
            Some(())
        };
        let deserialize_vec = |target: &mut Vec<CelestialId>, key: &str| {
            if let Some(serde_json::Value::Array(arr)) = map.get(key) {
                *target = arr
                    .iter()
                    .filter_map(|v| v.as_u64().map(|v| v as usize))
                    .collect();
            }
            Some(())
        };

        deserialize_usize(&mut ret.id, "id");
        deserialize_str(&mut ret.name, "name");
        deserialize_vector3(&mut ret.position, "position")?;
        deserialize_vector3(&mut ret.velocity, "velocity")?;
        deserialize_quaternion(&mut ret.quaternion, "quaternion");
        deserialize_vector3(&mut ret.angular_velocity, "angularVelocity")?;
        deserialize_str(&mut ret.orbit_color, "orbitColor");
        deserialize_str(&mut ret.model_color, "modelColor");
        deserialize_vec(&mut ret.children, "children");
        ret.parent = map
            .get("parent")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);
        ret.session_id = map
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|v| SessionId::from(v));
        deserialize_f64(&mut ret.radius, map, "radius");
        deserialize_f64(&mut ret.GM, map, "GM");
        if let Some(val) = map.get("orbitalElements") {
            ret.orbital_elements = serde_json::from_value(val.clone())?;
        }
        Ok(ret)
    }
}

#[test]
fn serialize_cel() {
    let cel = CelestialBody::default();

    let ser = serde_json::to_string(&cel).unwrap();
    assert_eq!(ser, "{\"id\":0,\"name\":\"\",\"position\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"quaternion\":{\"_x\":0.0,\"_y\":0.0,\"_z\":0.0,\"_w\":1.0},\"angularVelocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"orbitColor\":\"\",\"children\":[],\"parent\":null,\"sessionId\":null,\"radius\":695800.0,\"GM\":3.9640159680940277e-14,\"orbitalElements\":{\"semimajor_axis\":0.0,\"ascending_node\":0.0,\"inclination\":0.0,\"eccentricity\":0.0,\"epoch\":0.0,\"mean_anomaly\":0.0,\"argument_of_perihelion\":0.0,\"soi\":0.0}}");
}
