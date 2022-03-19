use super::{CelestialBody, CelestialId, OrbitalElements, Quaternion, Universe, Vector3};
use cgmath::{InnerSpace, Rad, Rotation3, Zero};

#[derive(Default)]
pub(super) struct CelestialBodyBuilder {
    name: Option<String>,
    parent: Option<CelestialId>,
    position: Option<Vector3>,
    velocity: Option<Vector3>,
    orbit_color: Option<String>,
    gm: Option<f64>,
    radius: Option<f64>,
}

impl CelestialBodyBuilder {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn name(&mut self, name: String) -> &mut Self {
        self.name = Some(name);
        self
    }

    pub(super) fn parent(&mut self, parent: CelestialId) -> &mut Self {
        self.parent = Some(parent);
        self
    }

    pub(super) fn position(&mut self, position: Vector3) -> &mut Self {
        self.position = Some(position);
        self
    }

    pub(super) fn velocity(&mut self, velocity: Vector3) -> &mut Self {
        self.velocity = Some(velocity);
        self
    }

    pub(super) fn orbit_color(&mut self, orbit_color: String) -> &mut Self {
        self.orbit_color = Some(orbit_color);
        self
    }

    pub(super) fn gm(&mut self, gm: f64) -> &mut Self {
        self.gm = Some(gm);
        self
    }

    pub(super) fn radius(&mut self, radius: f64) -> &mut Self {
        self.radius = Some(radius);
        self
    }

    pub(super) fn build(
        self,
        universe: &mut Universe,
        orbital_elements: OrbitalElements,
    ) -> CelestialBody {
        let id = universe.id_gen;
        universe.id_gen += 1;

        CelestialBody {
            id,
            name: self.name.unwrap(),
            position: self.position.unwrap_or_else(Vector3::zero),
            velocity: self.velocity.unwrap_or_else(Vector3::zero),
            quaternion: Quaternion::new(0., 0., 0., 1.),
            angular_velocity: Vector3::new(0., 0., 0.),
            orbit_color: self.orbit_color.unwrap_or_else(String::new),
            children: vec![],
            parent: self.parent,
            GM: self.gm.unwrap(),
            orbital_elements,
            radius: self.radius.unwrap_or(1. / crate::AU),
        }
    }
}
