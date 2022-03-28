use crate::{
    quaternion::QuaternionSerial,
    server::{Connect, Message},
    ChatServer, OrbiterData,
};
use ::actix::{prelude::*, Actor, StreamHandler};
use ::actix_web::{web, HttpRequest, HttpResponse};
use ::orbiter_logic::{CelestialBody, SessionId, Universe, Vector3};
use ::serde::{Deserialize, Serialize};
use actix_web_actors::ws;

/// Open a WebSocket instance and give it to the client.
/// `session_id` should be created by `/api/session` beforehand.
#[actix_web::get("/ws/{session_id}")]
pub(crate) async fn websocket_index(
    data: web::Data<OrbiterData>,
    session_id: web::Path<String>,
    req: HttpRequest,
    stream: web::Payload,
) -> Result<HttpResponse, actix_web::Error> {
    let session_id: SessionId = session_id.into_inner().into();

    let session_ws = SessionWs {
        data: data.clone(),
        session_id,
        addr: data.srv.clone(),
    };

    // let srv = data.srv.clone();
    // srv.do_send(Connect{addr: Addr(session_ws).recipient()});

    let resp = ws::start(session_ws, &req, stream);
    println!(
        "websocket received for session {:?}: {:?}",
        session_id, resp
    );
    resp
}

/// Define HTTP actor
struct SessionWs {
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

        self.addr.do_send(ChatHistoryRequest(self.session_id));
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
    name: String,
    parent: Option<String>,
    position: Vector3,
    velocity: Vector3,
    quaternion: QuaternionSerial,
    angular_velocity: Vector3,
}

impl SetRocketStateWs {
    pub(crate) fn from<'a>(
        body: &'a CelestialBody,
        mut bodies: impl Iterator<Item = &'a CelestialBody>,
    ) -> Self {
        Self {
            name: body.name.clone(),
            parent: body
                .parent
                .and_then(|parent| bodies.nth(parent))
                .map(|b| b.name.clone()),
            position: body.position,
            velocity: body.velocity,
            quaternion: body.quaternion.into(),
            angular_velocity: body.angular_velocity,
        }
    }
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
enum WsMessage {
    SetRocketState(SetRocketStateWs),
    Message { payload: String },
    TimeScale { payload: TimeScaleMessage },
    ChatHistoryRequest,
}

#[derive(Deserialize, Serialize, Debug, Message)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotifyBodyState {
    pub session_id: Option<SessionId>,
    pub body_state: SetRocketStateWs,
}

#[derive(Deserialize, Serialize, Debug, Message, Clone)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClientMessage {
    pub session_id: SessionId,
    pub message: String,
}

#[derive(Deserialize, Serialize, Debug, Message)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimeScaleMessage {
    pub time_scale: f64,
}

#[derive(Deserialize, Serialize, Debug, Message)]
#[rtype(result = "()")]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatHistoryRequest(pub SessionId);

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

                        fn find_rocket<'a>(
                            universe: &'a mut Universe,
                            name: &str,
                        ) -> Option<&'a mut CelestialBody> {
                            universe
                                .bodies
                                .iter_mut()
                                .enumerate()
                                .find(|(_, body)| body.name == name)
                                .map(|(_, rocket)| rocket)
                        }

                        let rocket = if let Some(rocket) = find_rocket(&mut universe, &payload.name)
                        {
                            rocket
                        } else {
                            return ctx.text(
                                "{\"type\": \"response\", \"payload\": \"could not find rocket\"}",
                            );
                        };

                        if Some(self.session_id) != rocket.session_id {
                            return ctx.text("{\"type\": \"response\", \"payload\": \"fail\"}");
                        }

                        println!(
                            "Set rocket state from session: {}",
                            self.session_id.to_string()
                        );
                        let parent_id = payload
                            .parent
                            .as_ref()
                            .and_then(|parent| {
                                universe
                                    .bodies
                                    .iter()
                                    .enumerate()
                                    .find(|(_, body)| body.name == *parent)
                            })
                            .map(|(i, _)| i);

                        let mut rocket = find_rocket(&mut universe, &payload.name).unwrap();
                        rocket.parent = parent_id;
                        rocket.position = payload.position;
                        rocket.velocity = payload.velocity;
                        rocket.quaternion = payload.quaternion.into();
                        rocket.angular_velocity = payload.angular_velocity;
                        self.addr.do_send(NotifyBodyState {
                            session_id: Some(self.session_id),
                            body_state: payload,
                        });
                    }
                    WsMessage::Message { payload } => {
                        println!("Got message: {:?}", payload);
                        self.addr.do_send(ClientMessage {
                            session_id: self.session_id,
                            message: payload,
                        });
                    }
                    WsMessage::TimeScale { payload } => {
                        let mut data = self.data.universe.write().unwrap();
                        println!("Got timeScale: {}", payload.time_scale);
                        data.time_scale = payload.time_scale;
                        self.addr.do_send(payload);
                    }
                    WsMessage::ChatHistoryRequest => {
                        self.addr.do_send(ChatHistoryRequest(self.session_id));
                    }
                }
            }
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            _ => (),
        }
    }
}
