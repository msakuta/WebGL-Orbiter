use actix_cors::Cors;
use actix_web::{http, web, App, HttpResponse, HttpResponseBuilder, HttpServer};
use clap::Parser;
use orbiter_logic::{serialize, CelestialBody, Universe};
use serde::Deserialize;
use std::sync::RwLock;

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
}

struct OrbiterData {
    universe: RwLock<Universe>,
}

async fn get_state(data: web::Data<OrbiterData>) -> actix_web::Result<HttpResponse> {
    let universe = data.universe.read().unwrap();

    let serialized = serialize(&universe)?;

    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(serialized))
}

#[derive(Deserialize)]
struct SetTimeScale {
    time_scale: f64,
}

async fn set_timescale(
    data: web::Data<OrbiterData>,
    payload: web::Json<SetTimeScale>,
) -> HttpResponse {
    let mut universe = data.universe.write().unwrap();

    println!("Set timescale to: {}", payload.time_scale);
    universe.time_scale = payload.time_scale;

    HttpResponse::Ok().body("Ok")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let args = Args::parse();

    let universe = Universe::new();

    let data = web::Data::new(OrbiterData {
        universe: RwLock::new(universe),
    });
    let data_copy = data.clone();

    actix_web::rt::spawn(async move {
        let mut interval = actix_web::rt::time::interval(std::time::Duration::from_secs(1));
        loop {
            interval.tick().await;

            let start = std::time::Instant::now();

            data_copy.universe.write().unwrap().update();
            let universe = data_copy.universe.read().unwrap();
            println!(
                "Tick {}, time {}, calc: {}",
                universe.get_time(),
                universe.get_sim_time(),
                start.elapsed().as_micros() as f64 * 1e-6,
            );
        }
    });

    let result = HttpServer::new(move || {
        let cors = Cors::permissive()
            // .allowed_methods(vec!["GET", "POST"])
            // .allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT])
            // .allowed_header(http::header::CONTENT_TYPE)
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(data.clone())
            .route("/load", web::get().to(get_state))
            .route("/time_scale", web::post().to(set_timescale))
    })
    .bind((args.host.as_str(), args.port))?
    .run()
    .await;

    // loop {
    // }
    Ok(())
}
