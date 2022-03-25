use crate::{
    server::{ClientMessage, Connect, Message},
    ChatServer, OrbiterData,
};
use ::actix::{prelude::*, Actor, StreamHandler};
use ::actix_web::{web, HttpResponse};
use ::orbiter_logic::{Quaternion, SessionId, Vector3};
use ::serde::{Deserialize, Serialize};
use actix_web_actors::ws;

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
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
    pub addr: Addr<ChatServer>,
}

impl Actor for SessionWs {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start.
    /// We register ws session with ChatServer
    fn started(&mut self, ctx: &mut Self::Context) {
        // we'll start heartbeat process on session start.
        // self.hb(ctx);

        // register self in chat server. `AsyncContext::wait` register
        // future within context, but context waits until this future resolves
        // before processing any other events.
        // HttpContext::state() is instance of WsChatSessionState, state is shared
        // across all routes within application
        let addr = ctx.address();
        self.addr
            .send(Connect {
                session_id: self.session_id,
                addr: addr.recipient(),
            })
            .into_actor(self)
            .then(|res, _act, ctx| {
                match res {
                    Ok(_) => (),
                    // something is wrong with chat server
                    _ => ctx.stop(),
                }
                fut::ready(())
            })
            .wait(ctx);
    }
}

/// Handle messages from chat server, we simply send it to peer websocket
impl Handler<Message> for SessionWs {
    type Result = ();

    fn handle(&mut self, msg: Message, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetRocketStateWs {
    parent: String,
    position: Vector3,
    velocity: Vector3,
    quaternion: QuaternionSerial,
    angular_velocity: Vector3,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum WsMessage {
    SetRocketState(SetRocketStateWs),
    Message { payload: String },
}

#[derive(Deserialize, Serialize, Debug, Message)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotifyRocketState {
    pub session_id: SessionId,
    pub rocket_state: SetRocketStateWs,
}

#[derive(Deserialize, Serialize, Debug, Message)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotifyMessage {
    pub session_id: SessionId,
    pub message: String,
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for SessionWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                let payload: WsMessage = if let Ok(payload) = serde_json::from_str(&text) {
                    payload
                } else {
                    return ctx.text("{\"type\": \"response\", \"payload\": \"fail\"}");
                };

                match payload {
                    WsMessage::SetRocketState(payload) => {
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
                        if let Some((_, rocket)) = universe
                            .bodies
                            .iter_mut()
                            .enumerate()
                            .find(|(_, body)| body.get_session_id() == Some(session_id))
                        {
                            rocket.parent = parent_id;
                            rocket.position = payload.position;
                            rocket.velocity = payload.velocity;
                            rocket.quaternion = payload.quaternion.into();
                            rocket.angular_velocity = payload.angular_velocity;
                            self.addr.do_send(NotifyRocketState {
                                session_id,
                                rocket_state: payload,
                            });
                        }
                    }
                    WsMessage::Message { payload } => {
                        println!("Got message: {:?}", payload);
                        self.addr.do_send(NotifyMessage {
                            session_id: self.session_id,
                            message: payload,
                        });
                    }
                }
            }
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            _ => (),
        }
    }
}
