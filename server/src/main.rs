use actix_web::{web, App, HttpResponse, HttpServer};
use clap::Parser;
use orbiter_logic::{serialize, CelestialBody, Universe};
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

    println!("Serialized: {}", serialized);

    Ok(HttpResponse::Ok()
        .append_header(("Access-Control-Allow-Origin", "*"))
        .append_header(("Access-Control-Allow-Methods", "OPTIONS, POST, GET"))
        .append_header(("Access-Control-Max-Age", 2592000)) // 30 days
        .content_type("application/json")
        .body(serialized))
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
            std::thread::sleep(std::time::Duration::from_secs(1));
            data_copy.universe.write().unwrap().update();
            let universe = data_copy.universe.read().unwrap();
            println!("Tick {}: {:?}", universe.get_time(), universe);
        }
    });

    let result = HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/load", web::get().to(get_state))
    })
    .bind((args.host.as_str(), args.port))?
    .run()
    .await;

    // loop {
    // }
    Ok(())
}
