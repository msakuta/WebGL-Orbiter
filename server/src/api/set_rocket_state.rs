use crate::OrbiterData;
use ::actix::{Actor, StreamHandler};
use ::actix_web::{web, HttpResponse};
use ::orbiter_logic::{Quaternion, SessionId, Vector3};
use ::serde::Deserialize;
use actix_web_actors::ws;

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

/// Define HTTP actor
pub(crate) struct SessionWs {
    pub data: web::Data<OrbiterData>,
    pub session_id: SessionId,
}

impl Actor for SessionWs {
    type Context = ws::WebsocketContext<Self>;
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetRocketStateWs {
    parent: String,
    position: Vector3,
    velocity: Vector3,
    quaternion: QuaternionSerial,
    angular_velocity: Vector3,
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for SessionWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                let payload: SetRocketStateWs = if let Ok(payload) = serde_json::from_str(&text) {
                    payload
                } else {
                    return ctx.text("fail");
                };

                let mut universe = self.data.universe.write().unwrap();

                println!(
                    "Set rocket state from session: {}",
                    self.session_id.to_string()
                );
                let session_id = self.session_id;
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
            }
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            _ => (),
        }
    }
}
