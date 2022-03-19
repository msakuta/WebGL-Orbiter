use super::{Quaternion, Vector3};
use cgmath::{InnerSpace, Rad, Rotation3};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use std::rc::{Rc, Weak};

const Rsun: f64 = 695800.;
const epsilon: f64 = 1e-40; // Doesn't the machine epsilon depend on browsers!??
const acceleration: f64 = 5e-10;

#[derive(Serialize, Default)]
pub struct OrbitalElements {
    semimajor_axis: f64,
    ascending_node: f64,
    inclination: f64,
    eccentricity: f64,
    epoch: f64,
    mean_anomaly: f64,
    argument_of_perihelion: f64,
    soi: f64,
}

#[allow(non_snake_case)]
pub struct CelestialBody {
    id: usize,
    name: String,
    position: Vector3,
    velocity: Vector3,
    quaternion: Quaternion,
    angular_velocity: Vector3,
    orbit_color: String,
    // orbitMaterial: THREE.LineBasicMaterial;
    children: Vec<Rc<CelestialBody>>,
    parent: Weak<CelestialBody>,

    GM: f64,
    radius: f64,

    orbital_elements: OrbitalElements,
}

impl CelestialBody {
    pub(super) fn new(
        id_gen: &mut usize,
        parent: Option<Rc<CelestialBody>>,
        position: Vector3,
        orbit_color: String,
        GM: f64,
        name: String,
    ) -> Rc<Self> {
        let id = *id_gen;
        *id_gen += 1;

        let mut parent_clone = parent.clone();

        let ret = Rc::new(Self {
            id,
            name,
            position,
            velocity: Vector3::new(0., 0., 0.),
            quaternion: Quaternion::new(0., 0., 0., 1.),
            angular_velocity: Vector3::new(0., 0., 0.),
            orbit_color,
            children: vec![],
            parent: parent
                .map(|parent| Rc::downgrade(&parent))
                .unwrap_or_else(Weak::new),
            GM,
            orbital_elements: OrbitalElements::default(),
            radius: 1. / super::AU,
        });

        if let Some(parent) = parent_clone.as_mut().and_then(|parent| Rc::get_mut(parent)) {
            parent.children.push(ret.clone());
        }

        ret
    }

    /// Update orbital elements from position and velocity.
    /// The whole discussion is found in chapter 4.4 in
    /// https://www.academia.edu/8612052/ORBITAL_MECHANICS_FOR_ENGINEERING_STUDENTS
    fn update(&mut self) {
        if let Some(parent) = self.parent.upgrade() {
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
            if n.magnitude2() <= epsilon {
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
            let ascending_node_rot = <Quaternion as Rotation3>::from_axis_angle(
                Vector3::new(0., 0., 1.),
                Rad(self.orbital_elements.ascending_node - std::f64::consts::PI / 2.),
            );
            let inclination_rot = Quaternion::from_axis_angle(
                Vector3::new(0., 1., 0.),
                Rad(std::f64::consts::PI - self.orbital_elements.inclination),
            );
            let plane_rot = ascending_node_rot * inclination_rot;

            let heading_apoapsis =
                -self.position.dot(self.velocity) / (self.position.dot(self.velocity)).abs();

            // Avoid zero division and still get the correct answer when N == 0.
            // This is necessary to draw orbit with zero inclination and nonzero eccentricity.
            if n.magnitude2() <= epsilon || e.magnitude2() <= epsilon {
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
}

struct ChildrenList<'a>(&'a [Rc<CelestialBody>]);

impl Serialize for ChildrenList<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut children = serializer.serialize_seq(Some(self.0.len()))?;
        for child in self.0.iter() {
            children.serialize_element(&child.id)?;
        }
        children.end()
    }
}

impl Serialize for CelestialBody {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(4))?;
        map.serialize_entry("id", &self.id)?;
        map.serialize_entry("position", &self.position)?;
        map.serialize_entry("velocity", &self.velocity)?;
        map.serialize_entry("quaternion", &self.quaternion)?;
        map.serialize_entry("angular_velocity", &self.angular_velocity)?;
        map.serialize_entry("orbit_color", &self.orbit_color)?;
        map.serialize_entry("children", &ChildrenList(&self.children))?;
        map.serialize_entry("parent", &self.parent.upgrade().map(|p| p.id).unwrap_or(0))?;
        map.serialize_entry("radius", &self.radius)?;
        map.serialize_entry("GM", &self.GM)?;
        map.serialize_entry("orbital_elements", &self.orbital_elements)?;
        map.end()
    }
}

#[test]
fn serialize_cel() {
    let cel = CelestialBody {
        id: 0,
        name: "".to_string(),
        position: Vector3::new(0., 0., 0.),
        velocity: Vector3::new(0., 0., 0.),
        quaternion: Quaternion::new(1., 0., 0., 0.),
        angular_velocity: Vector3::new(0., 0., 0.),
        orbit_color: "".to_string(),
        children: vec![],
        parent: Weak::new(),
        GM: super::GMsun,
        radius: Rsun,
        orbital_elements: OrbitalElements::default(),
    };

    let ser = serde_json::to_string(&cel).unwrap();
    assert_eq!(ser, "{\"id\":0,\"position\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"quaternion\":{\"v\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"s\":1.0},\"angular_velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"orbit_color\":\"\",\"children\":[],\"parent\":0,\"radius\":695800.0,\"GM\":3.9640159680940277e-14,\"orbital_elements\":{\"semimajor_axis\":0.0,\"ascending_node\":0.0,\"inclination\":0.0,\"eccentricity\":0.0,\"epoch\":0.0,\"mean_anomaly\":0.0,\"argument_of_perihelion\":0.0,\"soi\":0.0}}");
}
