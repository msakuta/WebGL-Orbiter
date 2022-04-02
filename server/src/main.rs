mod api {
    pub(crate) mod set_timescale;
}
mod quaternion;
mod server;
mod websocket;

use crate::{
    api::set_timescale::set_timescale,
    server::{ChatServer, NotifyNewBody},
    websocket::{websocket_index, NotifyBodyState, SetRocketStateWs},
};
use ::actix::prelude::*;
use ::actix_cors::Cors;
use ::actix_files::NamedFile;
use ::actix_web::{error, middleware, web, App, HttpRequest, HttpResponse, HttpServer};
use ::clap::Parser;
use ::orbiter_logic::{serialize, Universe};
use std::{
    fs,
    path::{Path, PathBuf},
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
    #[clap(long, default_value = "10")]
    push_period_s: f64,
}

struct OrbiterData {
    universe: RwLock<Universe>,
    asset_path: PathBuf,
    last_saved: Mutex<Instant>,
    last_pushed: Mutex<Instant>,
    autosave_file: PathBuf,
    srv: Addr<ChatServer>,
}

async fn new_session(data: web::Data<OrbiterData>) -> actix_web::Result<HttpResponse> {
    let mut universe = data.universe.write().unwrap();

    let (new_session, id) = universe.new_rocket();

    if let Some(body) = universe.get(id) {
        data.srv.do_send(NotifyNewBody {
            session_id: new_session,
            body: serde_json::to_value(&body)
                .map_err(|e| error::ErrorInternalServerError(e.to_string()))?,
            body_parent: body
                .parent
                .and_then(|parent| universe.get(parent))
                .map(|parent| parent.name.clone())
                .unwrap_or_else(|| "".to_string()),
        });
    }

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

    let data = web::Data::new(OrbiterData {
        universe: RwLock::new(universe),
        asset_path: args.asset_path,
        last_saved: Mutex::new(Instant::now()),
        last_pushed: Mutex::new(Instant::now()),
        autosave_file: args.autosave_file,
        srv: ChatServer::new().start(),
    });
    let data_copy = data.clone();
    let data_copy2 = data.clone();

    let autosave_period_s = args.autosave_period_s;
    let autosave_pretty = args.autosave_pretty;
    let push_period_s = args.push_period_s;

    actix_web::rt::spawn(async move {
        let mut interval = actix_web::rt::time::interval(std::time::Duration::from_secs(1));
        loop {
            interval.tick().await;

            // let start = Instant::now();

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

            let mut last_pushed = data_copy.last_pushed.lock().unwrap();
            if push_period_s < last_pushed.elapsed().as_micros() as f64 * 1e-6 {
                for i in 0..universe.bodies.len() {
                    if let Ok((body, chained)) = Universe::split_bodies(&mut universe.bodies, i) {
                        data_copy.srv.do_send(NotifyBodyState {
                            session_id: None,
                            body_state: SetRocketStateWs::from(body, chained),
                        });
                    }
                }
                *last_pushed = Instant::now();
            }

            // println!(
            //     "[{:?}] Tick {}, time {}, calc: {:.3}ms",
            //     std::thread::current().id(),
            //     universe.get_time(),
            //     universe.get_sim_time(),
            //     start.elapsed().as_micros() as f64 * 1e-3,
            // );
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
            .route("/api/time_scale", web::post().to(set_timescale));
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
