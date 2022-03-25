use crate::{quaternion::QuaternionSerial, OrbiterData};
use ::actix_web::{web, HttpResponse};
use ::orbiter_logic::{SessionId, Vector3};
use ::serde::Deserialize;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetRocketState {
    session_id: String,
    parent: String,
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

    println!("Set rocket state from session: {}", payload.session_id);
    let session_id = SessionId::from(&payload.session_id as &str);
    let parent_id = universe
        .bodies
        .iter()
        .find(|body| body.name == payload.parent)
        .map(|body| body.id);
    if let Some(rocket) = universe
        .bodies
        .iter_mut()
        .find(|body| body.get_session_id() == Some(session_id))
    {
        rocket.parent = parent_id;
        rocket.position = payload.position;
        rocket.velocity = payload.velocity;
        rocket.quaternion = payload.quaternion.into();
        rocket.angular_velocity = payload.angular_velocity;
    }

    HttpResponse::Ok().body("Ok")
}
