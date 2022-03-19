use super::{Quaternion, Universe, Vector3};
use crate::dyn_iter::DynIterMut;
use cgmath::{InnerSpace, Rad, Rotation3};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use std::sync::{Arc, Mutex, Weak};

const Rsun: f64 = 695800.;
const epsilon: f64 = 1e-40; // Doesn't the machine epsilon depend on browsers!??
const acceleration: f64 = 5e-10;

#[derive(Serialize, Default, Debug)]
pub struct OrbitalElements {
    pub semimajor_axis: f64,
    pub ascending_node: f64,
    pub inclination: f64,
    pub eccentricity: f64,
    pub epoch: f64,
    pub mean_anomaly: f64,
    pub argument_of_perihelion: f64,
    pub soi: f64,
}

pub struct AddPlanetParams {
    pub axial_tilt: f64,
    pub rotation_period: f64,
    pub quaternion: Quaternion,
    pub angular_velocity: Vector3,
}

pub type CelestialId = usize;

#[allow(non_snake_case)]
#[derive(Debug)]
pub struct CelestialBody {
    pub id: CelestialId,
    pub name: String,
    position: Vector3,
    velocity: Vector3,
    pub quaternion: Quaternion,
    angular_velocity: Vector3,
    orbit_color: String,
    // orbitMaterial: THREE.LineBasicMaterial;
    pub children: Vec<CelestialId>,
    pub parent: Option<CelestialId>,

    GM: f64,
    radius: f64,

    orbital_elements: OrbitalElements,
}

impl CelestialBody {
    pub(super) fn new(
        universe: &mut Universe,
        parent: Option<CelestialId>,
        position: Vector3,
        orbit_color: String,
        GM: f64,
        name: String,
        orbital_elements: OrbitalElements,
    ) -> Self {
        let id = universe.id_gen;
        universe.id_gen += 1;

        let mut parent_clone = parent.clone();

        let ret = Self {
            id,
            name,
            position,
            velocity: Vector3::new(0., 0., 0.),
            quaternion: Quaternion::new(0., 0., 0., 1.),
            angular_velocity: Vector3::new(0., 0., 0.),
            orbit_color,
            children: vec![],
            parent,
            GM,
            orbital_elements,
            radius: 1. / super::AU,
        };

        ret
    }

    pub(crate) fn from_orbital_elements(
        universe: &mut Universe,
        parent: Option<usize>,
        orbital_elements: OrbitalElements,
        GM: f64,
        radius: f64,
        name: String,
    ) -> Self {
        let rotation =
            Quaternion::from_angle_z(Rad(
                orbital_elements.ascending_node - std::f64::consts::PI / 2.
            )) * (Quaternion::from_angle_y(Rad(
                std::f64::consts::PI - orbital_elements.inclination
            ))) * (Quaternion::from_angle_z(Rad(orbital_elements.argument_of_perihelion)));
        let axis = Vector3::new(0., 1. - orbital_elements.eccentricity, 0.)
            * orbital_elements.semimajor_axis;
        Self::new(
            universe,
            parent,
            rotation * axis,
            "#fff".to_string(),
            GM,
            name,
            orbital_elements,
        )
    }

    /// Update orbital elements from position and velocity.
    /// The whole discussion is found in chapter 4.4 in
    /// https://www.academia.edu/8612052/ORBITAL_MECHANICS_FOR_ENGINEERING_STUDENTS
    pub(crate) fn update(&mut self, universe: &mut Universe) {
        if let Some(parent) = self.parent {
            let parent = &universe.bodies[parent];
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

    pub(crate) fn simulate_body(
        &self,
        mut bodies: impl DynIterMut<Item = CelestialBody>,
        delta_time: f64,
        div: f64,
        timescale: f64,
    ) {
        // let children = &self.children;
        for body in bodies.dyn_iter_mut() {
            if self.children.iter().find(|id| **id == body.id).is_none() {
                continue;
            }
            let a = body;
            let sl = a.position.magnitude2();
            println!(
                "Body {} simulating with {}... sl: {}",
                a.name, delta_time, sl
            );
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
                    a.quaternion = <Quaternion as Rotation3>::from_axis_angle(
                        axis,
                        Rad(a.angular_velocity.magnitude() * delta_time / div),
                    ) * a.quaternion;
                }
            }
            // a.simulate_body(bodies, delta_time, div, timescale);
        }
    }
}

struct ChildrenList<'a>(&'a [Arc<Mutex<CelestialBody>>]);

impl Serialize for ChildrenList<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut children = serializer.serialize_seq(Some(self.0.len()))?;
        for child in self.0.iter() {
            children.serialize_element(&child.lock().unwrap().id)?;
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
        map.serialize_entry("children", &self.children)?;
        map.serialize_entry("parent", &self.parent)?;
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
        parent: None,
        GM: super::GMsun,
        radius: Rsun,
        orbital_elements: OrbitalElements::default(),
    };

    let ser = serde_json::to_string(&cel).unwrap();
    assert_eq!(ser, "{\"id\":0,\"position\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"quaternion\":{\"v\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"s\":1.0},\"angular_velocity\":{\"x\":0.0,\"y\":0.0,\"z\":0.0},\"orbit_color\":\"\",\"children\":[],\"parent\":0,\"radius\":695800.0,\"GM\":3.9640159680940277e-14,\"orbital_elements\":{\"semimajor_axis\":0.0,\"ascending_node\":0.0,\"inclination\":0.0,\"eccentricity\":0.0,\"epoch\":0.0,\"mean_anomaly\":0.0,\"argument_of_perihelion\":0.0,\"soi\":0.0}}");
}
