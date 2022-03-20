use crate::OrbiterData;
use ::actix_web::{web, HttpResponse};
use ::orbiter_logic::{Quaternion, SessionId, Vector3};
use ::serde::Deserialize;

#[derive(Deserialize, Debug, Clone, Copy)]
struct QuaternionSerial {
    _x: f64,
    _y: f64,
    _z: f64,
    _w: f64,
}

impl From<QuaternionSerial> for Quaternion {
    fn from(serial: QuaternionSerial) -> Self {
        Self::new(serial._w, serial._x, serial._y, serial._z)
    }
}

#[derive(Deserialize, Debug)]
pub(crate) struct SetRocketState {
    session_id: String,
    position: Vector3,
    velocity: Vector3,
    quaternion: QuaternionSerial,
    angular_velocity: Vector3,
}

pub(crate) async fn set_rocket_state(
    data: web::Data<OrbiterData>,
    payload: web::Json<SetRocketState>,
) -> HttpResponse {
    let mut universe = data.universe.write().unwrap();

    println!("Set rocket state: {:?}", payload);
    let session_id = SessionId::from(&payload.session_id as &str);
    if let Some(rocket) = universe
        .bodies
        .iter_mut()
        .find(|body| body.get_session_id() == Some(session_id))
    {
        rocket.position = payload.position;
        rocket.velocity = payload.velocity;
        rocket.quaternion = payload.quaternion.into();
        rocket.angular_velocity = payload.angular_velocity;
    }

    HttpResponse::Ok().body("Ok")
}
