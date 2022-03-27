use crate::websocket::{ChatHistoryRequest, ClientMessage, NotifyBodyState, TimeScaleMessage};
use ::actix::prelude::*;
use ::orbiter_logic::SessionId;
use ::serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    io::Write,
    sync::atomic::AtomicUsize,
    sync::Arc,
};

/// Message for chat server communications

/// New chat session is created
#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
    pub session_id: SessionId,
    pub addr: Recipient<Message>,
}

/// Chat server sends this messages to session
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub String);

const CHAT_HISTORY_MAX: usize = 100;
const CHAT_LOG_FILE: &'static str = "chatlog.json";

/// `ChatServer` manages chat rooms and responsible for coordinating chat session.
///
/// Implementation is very naïve.
pub(crate) struct ChatServer {
    sessions: HashMap<SessionId, Recipient<Message>>,
    chat_history: VecDeque<ClientMessage>,
    visitor_count: Arc<AtomicUsize>,
}

impl ChatServer {
    pub fn new(visitor_count: Arc<AtomicUsize>) -> ChatServer {
        fn load_log() -> anyhow::Result<VecDeque<ClientMessage>> {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct ClientMessageSerial {
                session_id: String,
                message: String,
            }
            let data = std::fs::read(CHAT_LOG_FILE)?;
            let data = String::from_utf8(data)?;
            let ret: Vec<ClientMessageSerial> = serde_json::from_str(&data)?;
            println!("Loaded {} chat items from log file", ret.len());
            Ok(ret
                .into_iter()
                .map(|val| ClientMessage {
                    session_id: SessionId::from(val.session_id),
                    message: val.message,
                })
                .collect())
        }

        ChatServer {
            sessions: HashMap::new(),
            chat_history: match load_log() {
                Ok(val) => val,
                Err(e) => {
                    println!("Failed to load chat log: {:?}", e);
                    VecDeque::new()
                }
            },
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

#[derive(Serialize)]
struct Payload<T: Serialize> {
    #[serde(rename = "type")]
    type_: &'static str,
    payload: T,
}

impl Handler<NotifyBodyState> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: NotifyBodyState, _: &mut Context<Self>) {
        let session_id = msg.session_id;

        let payload = Payload {
            type_: "clientUpdate",
            payload: msg,
        };

        self.send_message(&serde_json::to_string(&payload).unwrap(), session_id);
    }
}

impl Handler<ClientMessage> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        if CHAT_HISTORY_MAX <= self.chat_history.len() {
            self.chat_history.pop_front();
        }
        self.chat_history.push_back(msg.clone());
        if let Ok(mut f) = std::fs::File::create(CHAT_LOG_FILE) {
            if let Ok(s) = serde_json::to_string(&self.chat_history) {
                if let Err(e) = f.write_all(s.as_bytes()) {
                    println!("Failed to save chat log: {:?}", e);
                }
            }
        }
        let payload = Payload {
            type_: "message",
            payload: msg,
        };

        self.send_message(&serde_json::to_string(&payload).unwrap(), None);
    }
}

impl Handler<TimeScaleMessage> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: TimeScaleMessage, _: &mut Context<Self>) {
        let payload = Payload {
            type_: "timeScale",
            payload: msg,
        };

        self.send_message(&serde_json::to_string(&payload).unwrap(), None);
    }
}

impl Handler<ChatHistoryRequest> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: ChatHistoryRequest, _: &mut Context<Self>) {
        println!(
            "Handling ChatHistoryRequest returning {} items",
            self.chat_history.len()
        );
        let session_id = msg.0;

        if let Some(session) = self.sessions.get(&session_id) {
            session.do_send(Message(
                serde_json::to_string(&Payload {
                    type_: "chatHistory",
                    payload: &self.chat_history,
                })
                .unwrap(),
            ));
        }
    }
}
