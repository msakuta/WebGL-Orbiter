use crate::{
    quaternion::QuaternionSerial,
    server::{Connect, Message},
    ChatServer, OrbiterData,
};
use ::actix::{prelude::*, Actor, StreamHandler};
use ::actix_web::{web, HttpRequest, HttpResponse};
use ::orbiter_logic::{SessionId, Vector3};
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
