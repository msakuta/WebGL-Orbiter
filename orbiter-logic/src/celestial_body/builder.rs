use super::{
    iter::CelestialBodyDynIter, CelestialBody, CelestialId, OrbitalElementsInput, Quaternion,
    Universe, Vector3,
};
use crate::session::SessionId;
use cgmath::{Rad, Rotation, Rotation3, Zero};
use rand::Rng;

#[derive(Default)]
pub(crate) struct CelestialBodyBuilder {
    name: Option<String>,
    parent: Option<CelestialId>,
    session_id: Option<SessionId>,
    position: Option<Vector3>,
    velocity: Option<Vector3>,
    orbit_color: Option<String>,
    controllable: bool,
    gm: Option<f64>,
    radius: Option<f64>,
    soi: Option<f64>,
}

impl CelestialBodyBuilder {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn name(&mut self, name: String) -> &mut Self {
        self.name = Some(name);
        self
    }

    pub(crate) fn parent(&mut self, parent: CelestialId) -> &mut Self {
        self.parent = Some(parent);
        self
    }

    pub(crate) fn _session_id(&mut self, session_id: SessionId) -> &mut Self {
        self.session_id = Some(session_id);
        self
    }

    pub(crate) fn position(&mut self, position: Vector3) -> &mut Self {
        self.position = Some(position);
        self
    }

    pub(crate) fn _velocity(&mut self, velocity: Vector3) -> &mut Self {
        self.velocity = Some(velocity);
        self
    }

    pub(crate) fn orbit_color(&mut self, orbit_color: String) -> &mut Self {
        self.orbit_color = Some(orbit_color);
        self
    }

    pub(crate) fn controllable(&mut self, value: bool) -> &mut Self {
        self.controllable = value;
        self
    }

    pub(crate) fn gm(&mut self, gm: f64) -> &mut Self {
        self.gm = Some(gm);
        self
    }

    pub(crate) fn radius(&mut self, radius: f64) -> &mut Self {
        self.radius = Some(radius);
        self
    }

    pub(crate) fn soi(&mut self, soi: f64) -> &mut Self {
        self.soi = Some(soi);
        self
    }

    pub(crate) fn build(&mut self, orbital_elements: OrbitalElementsInput) -> CelestialBody {
        const COLOR_PALETTE: [&'static str; 17] = [
            "1 1 1",
            "1 0.75 0.75",
            "0.75 1 0.75",
            "0.75 0.75 1",
            "1 1 0.75",
            "0.75 1 1",
            "1 0.75 1",
            "1 0.25 0.25",
            "0.25 1 0.25",
            "1 0.25 1",
            "0.25 1 1",
            "0.25 0.5 1",
            "0.25 1 0.5",
            "1 0.25 0.25",
            "0.5 1 0.25",
            "1 0.25 0.5",
            "0.5 0.25 1",
        ];

        CelestialBody {
            name: self.name.take().unwrap(),
            position: self.position.unwrap_or_else(Vector3::zero),
            velocity: self.velocity.unwrap_or_else(Vector3::zero),
            quaternion: Quaternion::new(0., 0., 0., 1.),
            angular_velocity: Vector3::new(0., 0., 0.),
            orbit_color: self.orbit_color.take().unwrap_or_else(String::new),
            model_color: COLOR_PALETTE[rand::thread_rng().gen_range(0..COLOR_PALETTE.len())]
                .to_string(),
            children: vec![],
            parent: self.parent,
            session_id: self.session_id,
            controllable: self.controllable,
            GM: self.gm.unwrap(),
            orbital_elements: orbital_elements.into(),
            radius: self.radius.unwrap_or(1. / crate::AU),
            soi: self.soi.unwrap_or(0.),
            #[cfg(feature = "wasm")]
            model: wasm_bindgen::JsValue::null(),
            #[cfg(feature = "wasm")]
            js_body: wasm_bindgen::JsValue::null(),
        }
    }
}

pub(crate) struct AddPlanetParams {
    pub axial_tilt: f64,
    pub rotation_period: f64,
}

impl Default for AddPlanetParams {
    fn default() -> Self {
        Self {
            axial_tilt: 0.,
            rotation_period: 0.,
        }
    }
}

impl CelestialBodyBuilder {
    pub(crate) fn build_from_orbital_elements(
        &mut self,
        universe: &mut Universe,
        orbital_elements: OrbitalElementsInput,
        params: AddPlanetParams,
    ) -> CelestialBody {
        let rotation =
            Quaternion::from_angle_z(Rad(
                orbital_elements.ascending_node - std::f64::consts::PI / 2.
            )) * (Quaternion::from_angle_y(Rad(
                std::f64::consts::PI - orbital_elements.inclination
            ))) * (Quaternion::from_angle_z(Rad(orbital_elements.argument_of_perihelion)));
        let axis = Vector3::new(0., 1. - orbital_elements.eccentricity, 0.)
            * orbital_elements.semimajor_axis;

        let mut ret = self
            .position(rotation * axis)
            .orbit_color("#fff".to_string())
            .build(orbital_elements);

        // Orbital speed at given position and eccentricity can be calculated by v = \sqrt(\mu (2 / r - 1 / a))
        // https://en.wikipedia.org/wiki/Orbital_speed
        ret.set_orbiting_velocity(
            CelestialBodyDynIter::new_all(&mut universe.bodies),
            ret.orbital_elements.semimajor_axis,
            rotation,
        );
        ret.quaternion = Quaternion::from_angle_x(Rad(params.axial_tilt));
        ret.angular_velocity = if params.rotation_period != 0. {
            ret.quaternion.rotate_vector(Vector3::new(
                0.,
                0.,
                2. * std::f64::consts::PI / params.rotation_period,
            ))
        } else {
            Vector3::zero()
        };

        ret
    }
}
