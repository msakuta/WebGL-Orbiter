mod api {
    pub(crate) mod set_rocket_state;
    pub(crate) mod set_timescale;
}

use crate::api::{
    set_rocket_state::{set_rocket_state, SessionWs},
    set_timescale::set_timescale,
};
use ::actix::prelude::*;
use ::actix_cors::Cors;
use ::actix_files::NamedFile;
use ::actix_web::{middleware, web, App, HttpRequest, HttpResponse, HttpServer};
use ::actix_web_actors::ws;
use ::clap::Parser;
use ::orbiter_logic::{serialize, SessionId, Universe};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::atomic::AtomicUsize,
    sync::Arc,
    sync::{Mutex, RwLock},
    time::Instant,
};

#[derive(Parser, Debug)]
#[clap(author, version, about)]
struct Args {
    #[clap(default_value = ".")]
    path: String,
    #[clap(
        short,
        long,
        default_value = "8088",
        help = "The port number to listen to."
    )]
    port: u16,
    #[clap(
        short,
        long,
        default_value = "127.0.0.1",
        help = "The host address to listen to. By default, only the localhost can access."
    )]
    host: String,
    #[clap(short, long, default_value = "../dist")]
    asset_path: PathBuf,
    #[clap(long, default_value = "save.json")]
    autosave_file: PathBuf,
    #[clap(long, default_value = "5")]
    autosave_period_s: f64,
    #[clap(long)]
    autosave_pretty: bool,
}

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
pub struct ChatServer {
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
        let res_msg = format!("Someone joined: {}", msg.session_id.to_string());

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
        self.send_message(msg.msg.as_str(), Some(msg.session_id));
    }
}

struct OrbiterData {
    universe: RwLock<Universe>,
    asset_path: PathBuf,
    last_saved: Mutex<Instant>,
    autosave_file: PathBuf,
    srv: Addr<ChatServer>,
}

async fn new_session(data: web::Data<OrbiterData>) -> actix_web::Result<HttpResponse> {
    let mut universe = data.universe.write().unwrap();

    let new_session = universe.new_rocket();

    println!("New session id: {:?}", new_session);

    Ok(HttpResponse::Ok().body(new_session.to_string()))
}

async fn get_state(data: web::Data<OrbiterData>) -> actix_web::Result<HttpResponse> {
    let start = Instant::now();

    let universe = data.universe.read().unwrap();

    let serialized = serialize(&universe)?;

    println!(
        "Serialized universe at tick {} in {:.3}ms",
        universe.get_time(),
        start.elapsed().as_micros() as f64 * 1e-3
    );

    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(serialized))
}

#[cfg(not(debug_assertions))]
async fn get_bundle() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/javascript")
        .body(include_str!("../../dist/bundle.js"))
}

#[cfg(not(debug_assertions))]
async fn get_index() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html")
        .body(include_str!("../../dist/index.html"))
}

async fn get_file(data: web::Data<OrbiterData>, req: HttpRequest) -> actix_web::Result<NamedFile> {
    let asset_path = &data.asset_path;
    let filename: PathBuf = req.match_info().query("filename").parse().unwrap();
    let path: PathBuf = asset_path.join(&filename);
    Ok(NamedFile::open(path)?)
}

fn serialize_state(universe: &Universe, autosave_pretty: bool) -> serde_json::Result<String> {
    if autosave_pretty {
        serde_json::to_string_pretty(&universe as &Universe)
    } else {
        serde_json::to_string(&universe as &Universe)
    }
}

fn save_file(autosave_file: &Path, serialized: &str) {
    println!(
        "[{:?}] Writing {}",
        std::thread::current().id(),
        serialized.len()
    );
    let start = Instant::now();
    fs::write(autosave_file, serialized.as_bytes()).expect("Write to save file should succeed");
    println!(
        "Wrote in {:.3}ms",
        start.elapsed().as_micros() as f64 * 1e-3
    );
}

/// Open a WebSocket instance and give it to the client.
/// `session_id` should be created by `/api/session` beforehand.
#[actix_web::get("/ws/{session_id}")]
async fn websocket_index(
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let args = Args::parse();

    let mut universe = Universe::new();

    let start = Instant::now();
    if let Ok(data) = fs::read(&args.autosave_file) {
        if let Ok(saved_data) = String::from_utf8(data) {
            if let Ok(json) = serde_json::from_str(&saved_data) {
                if let Err(e) = universe.deserialize(json) {
                    eprintln!("Error on loading serialized data: {}", e);
                } else {
                    eprintln!(
                        "Deserialized data {} object in {}ms",
                        universe.bodies.len(),
                        start.elapsed().as_micros() as f64 * 1e-3
                    );
                }
            }
        }
    }

    // set up applications state
    // keep a count of the number of visitors
    let app_state = Arc::new(AtomicUsize::new(0));

    let data = web::Data::new(OrbiterData {
        universe: RwLock::new(universe),
        asset_path: args.asset_path,
        last_saved: Mutex::new(Instant::now()),
        autosave_file: args.autosave_file,
        srv: ChatServer::new(app_state.clone()).start(),
    });
    let data_copy = data.clone();
    let data_copy2 = data.clone();

    let autosave_period_s = args.autosave_period_s;
    let autosave_pretty = args.autosave_pretty;

    actix_web::rt::spawn(async move {
        let mut interval = actix_web::rt::time::interval(std::time::Duration::from_secs(1));
        loop {
            interval.tick().await;

            let start = Instant::now();

            let mut universe = data_copy.universe.write().unwrap();
            universe.update();

            let mut last_saved = data_copy.last_saved.lock().unwrap();
            if autosave_period_s < last_saved.elapsed().as_micros() as f64 * 1e-6 {
                if let Ok(serialized) = serialize_state(&universe, autosave_pretty) {
                    let autosave_file = data_copy.autosave_file.clone();
                    actix_web::rt::spawn(async move {
                        save_file(&autosave_file, &serialized);
                    });
                }
                *last_saved = Instant::now();
            }

            println!(
                "[{:?}] Tick {}, time {}, calc: {:.3}ms",
                std::thread::current().id(),
                universe.get_time(),
                universe.get_sim_time(),
                start.elapsed().as_micros() as f64 * 1e-3,
            );
        }
    });

    let _result = HttpServer::new(move || {
        let cors = Cors::permissive()
            // .allowed_methods(vec!["GET", "POST"])
            // .allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT])
            // .allowed_header(http::header::CONTENT_TYPE)
            .max_age(3600);

        let app = App::new()
            .wrap(middleware::Compress::default())
            .wrap(cors)
            .app_data(data.clone())
            .service(websocket_index)
            .route("/api/session", web::post().to(new_session))
            .route("/api/load", web::get().to(get_state))
            .route("/api/time_scale", web::post().to(set_timescale))
            .route("/api/rocket_state", web::post().to(set_rocket_state));
        #[cfg(not(debug_assertions))]
        {
            app.route("/", web::get().to(get_index))
                .route("/bundle.js", web::get().to(get_bundle))
                .route("/{filename:.*}", web::get().to(get_file))
        }
        #[cfg(debug_assertions)]
        app.route("/{filename:.*}", web::get().to(get_file))
    })
    .bind((args.host.as_str(), args.port))?
    .run()
    .await;

    if let Ok(serialized) = serialize_state(&data_copy2.universe.read().unwrap(), autosave_pretty) {
        save_file(&data_copy2.autosave_file, &serialized);
    }
    Ok(())
}
