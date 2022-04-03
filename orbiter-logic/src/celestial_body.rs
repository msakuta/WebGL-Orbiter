pub(crate) mod builder;
pub(crate) mod iter;

use self::{builder::CelestialBodyBuilder, iter::CelestialBodyDynIter};
use super::{Quaternion, Universe, Vector3};
use crate::session::SessionId;
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

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CelestialId {
    pub id: u32,
    pub gen: u32,
}

impl CelestialId {
    fn _new(id: u32) -> Self {
        Self { id, gen: 0 }
    }
}

impl Serialize for CelestialId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.id.serialize(serializer)
    }
}

#[allow(non_snake_case)]
#[derive(Debug)]
pub struct CelestialBody {
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
    pub controllable: bool,

    GM: f64,
    radius: f64,

    orbital_elements: OrbitalElements,
    pub soi: f64,

    #[cfg(feature = "wasm")]
    pub model: wasm_bindgen::JsValue,
}

impl Default for CelestialBody {
    fn default() -> Self {
        Self {
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
            controllable: false,
            GM: super::GMsun,
            radius: Rsun,
            orbital_elements: OrbitalElements::default(),
            soi: 0.,
            #[cfg(feature = "wasm")]
            model: wasm_bindgen::JsValue::null(),
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
        bodies: CelestialBodyDynIter,
        semimajor_axis: f64,
        rotation: Quaternion,
    ) {
        if let Some(parent) = self.parent {
            if let Some(parent) = bodies.get(parent) {
                self.velocity = rotation.rotate_vector(
                    Vector3::new(1., 0., 0.)
                        * (parent.GM * (2. / self.position.magnitude() - 1. / semimajor_axis))
                            .sqrt(),
                );
            }
        }
    }

    pub fn get_world_position(&self, bodies: &[CelestialBodyEntry]) -> Vector3 {
        if let Some(parent) = self
            .parent
            .and_then(|parent| bodies[parent.id as usize].dynamic.as_ref())
        {
            parent.get_world_position(bodies) + self.position
        } else {
            Vector3::zero()
        }
    }

    /// Update orbital elements from position and velocity.
    /// The whole discussion is found in chapter 4.4 in
    /// https://www.academia.edu/8612052/ORBITAL_MECHANICS_FOR_ENGINEERING_STUDENTS
    pub(crate) fn update(&mut self, bodies: CelestialBodyDynIter) {
        if let Some(parent) = self.parent.and_then(|parent| bodies.get(parent)) {
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
        &mut self,
        mut bodies: CelestialBodyDynIter,
        delta_time: f64,
        div: f64,
    ) -> anyhow::Result<bool> {
        // let children = &self.children;
        // println!("Children: {:?}", self.children);
        let mut parent_dirty = false;
        for child_id in self.children.iter() {
            let (a, mut rest) = if let Ok((Some(a), rest)) = bodies.exclude_id(*child_id) {
                (a, rest)
            } else {
                continue;
            };
            let sl = a.position.magnitude2();
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

            // Only controllable objects can change orbiting body
            if a.controllable {
                // Check if we are leaving sphere of influence of current parent.
                if let Some(grandparent) = self.parent.and_then(|parent| rest.get_mut(parent)) {
                    if 0. < self.soi && self.soi * 1.01 < a.position.magnitude() {
                        println!(
                            "Transitioning parent of {:?} from {:?} to {:?} with {:?}",
                            child_id, a.parent, grandparent.name, a.position
                        );
                        a.position += self.position;
                        a.velocity += self.velocity;
                        // remove_child_index.push(idx);
                        a.parent = self.parent;
                        // grandparent.children.push(*child_id);
                        parent_dirty = true;
                        continue;
                    }
                }

                // let mut skip = false;
                // Check if we are entering sphere of influence of another sibling.
                for another_child_id in self.children.iter() {
                    if *child_id == *another_child_id {
                        continue;
                    }
                    let another_child = if let Some(child) = rest.get_mut(*another_child_id) {
                        child
                    } else {
                        continue;
                    };
                    if another_child.soi == 0. {
                        continue;
                    }
                    if (another_child.position - a.position).magnitude2()
                        < (another_child.soi * 0.99).powf(2.)
                    {
                        println!("Transitioning parent to a sibling! {:?}", a.parent);
                        a.position -= another_child.position;
                        a.velocity -= another_child.velocity;
                        a.parent = Some(*another_child_id);
                        parent_dirty = true;
                        break;
                    }
                }
                // if skip {
                //     continue; // Continue but not increment i
                // }
            }
            // a.simulate_body(bodies, delta_time, div, timescale);
        }

        // for idx in remove_child_index.into_iter().rev() {
        //     self.children.swap_remove(idx);
        // }

        Ok(parent_dirty)
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
        map.serialize_entry("controllable", &self.controllable)?;
        map.serialize_entry("GM", &self.GM)?;
        map.serialize_entry("soi", &self.soi)?;
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
        let deserialize_bool =
            |target: &mut bool, map: &serde_json::Map<String, serde_json::Value>, key: &str| {
                if let Some(v) = map.get(key).and_then(|v| v.as_bool()) {
                    *target = v;
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
                    .filter_map(|v| {
                        v.as_u64().map(|v| CelestialId {
                            id: v as u32,
                            gen: 0,
                        })
                    })
                    .collect();
            }
            Some(())
        };

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
            .map(|v| CelestialId {
                id: v as u32,
                gen: 0,
            });
        ret.session_id = map
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|v| SessionId::from(v));
        deserialize_f64(&mut ret.radius, map, "radius");
        deserialize_bool(&mut ret.controllable, map, "controllable");
        deserialize_f64(&mut ret.GM, map, "GM");
        deserialize_f64(&mut ret.soi, map, "soi");
        if let Some(val) = map.get("orbitalElements") {
            ret.orbital_elements = serde_json::from_value(val.clone())?;
        }
        Ok(ret)
    }
}

#[derive(Debug)]
pub struct CelestialBodyEntry {
    pub gen: u32,
    pub dynamic: Option<CelestialBody>,
}

#[test]
fn serialize_cel() {
    let cel = CelestialBody::default();

    let ser = serde_json::to_string(&cel).unwrap();
    assert_eq!(ser, "{\"id\":0,\"name\":\"\",\"position\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"quaternion\":{\"_x\":0.0,\"_y\":0.0,\"_z\":0.0,\"_w\":1.0},\"angularVelocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"orbitColor\":\"\",\"children\":[],\"parent\":null,\"sessionId\":null,\"radius\":695800.0,\"GM\":3.9640159680940277e-14,\"orbitalElements\":{\"semimajor_axis\":0.0,\"ascending_node\":0.0,\"inclination\":0.0,\"eccentricity\":0.0,\"epoch\":0.0,\"mean_anomaly\":0.0,\"argument_of_perihelion\":0.0,\"soi\":0.0}}");
}
