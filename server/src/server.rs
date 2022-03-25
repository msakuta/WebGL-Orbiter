use crate::websocket::{NotifyMessage, NotifyRocketState};
use ::actix::prelude::*;
use ::orbiter_logic::SessionId;
use serde::Serialize;
use std::{collections::HashMap, sync::atomic::AtomicUsize, sync::Arc};

/// Message for chat server communications

/// New chat session is created
#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
    pub session_id: SessionId,
    pub addr: Recipient<Message>,
}

/// Send message to specific room
#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientMessage {
    /// Id of the client session
    pub session_id: SessionId,
    /// Peer message
    pub msg: String,
}

/// Chat server sends this messages to session
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub String);

/// `ChatServer` manages chat rooms and responsible for coordinating chat session.
///
/// Implementation is very naïve.
#[derive(Debug)]
pub(crate) struct ChatServer {
    sessions: HashMap<SessionId, Recipient<Message>>,
    visitor_count: Arc<AtomicUsize>,
}

impl ChatServer {
    pub fn new(visitor_count: Arc<AtomicUsize>) -> ChatServer {
        ChatServer {
            sessions: HashMap::new(),
            visitor_count,
        }
    }
}

impl ChatServer {
    /// Send message to all users
    fn send_message(&self, message: &str, skip_id: Option<SessionId>) {
        for (i, addr) in &self.sessions {
            if Some(*i) != skip_id {
                let _ = addr.do_send(Message(message.to_owned()));
            }
        }
    }
}

/// Make actor from `ChatServer`
impl Actor for ChatServer {
    /// We are going to use simple Context, we just need ability to communicate
    /// with other actors.
    type Context = Context<Self>;
}

/// Handler for Connect message.
///
/// Register new session and assign unique id to this session
impl Handler<Connect> for ChatServer {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        self.sessions.insert(msg.session_id, msg.addr);
        let res_msg = format!(
            "{{\"type\": \"joined\", \"sessionId\": \"{}\" }}",
            msg.session_id.to_string()
        );

        println!("{}", res_msg);

        // notify all users in same room
        self.send_message(&res_msg, None);

        self.visitor_count.load(std::sync::atomic::Ordering::SeqCst)
    }
}

/// Handler for Message message.
impl Handler<ClientMessage> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        println!("Handling ClientMessage: {}", msg.msg);
        self.send_message(
            &format!(
                "{{\"type\": \"clientMessage\", \"payload\": \"{}\" }}",
                msg.msg.as_str()
            ),
            Some(msg.session_id),
        );
    }
}

impl Handler<NotifyRocketState> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: NotifyRocketState, _: &mut Context<Self>) {
        // println!("Handling NotifyRocketState: {}", msg.session_id.to_string());

        let session_id = msg.session_id;

        #[derive(Serialize)]
        struct Payload {
            #[serde(rename = "type")]
            type_: &'static str,
            payload: NotifyRocketState,
        }

        let payload = Payload {
            type_: "clientUpdate",
            payload: msg,
        };

        self.send_message(&serde_json::to_string(&payload).unwrap(), Some(session_id));
    }
}

impl Handler<NotifyMessage> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: NotifyMessage, _: &mut Context<Self>) {
        #[derive(Serialize)]
        struct Payload {
            #[serde(rename = "type")]
            type_: &'static str,
            payload: NotifyMessage,
        }

        let payload = Payload {
            type_: "message",
            payload: msg,
        };

        self.send_message(&serde_json::to_string(&payload).unwrap(), None);
    }
}
