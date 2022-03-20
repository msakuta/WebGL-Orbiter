use crate::OrbiterData;
use ::actix_web::{web, HttpResponse};
use ::serde::Deserialize;

#[derive(Deserialize)]
pub(crate) struct SetTimeScale {
    time_scale: f64,
}

pub(crate) async fn set_timescale(
    data: web::Data<OrbiterData>,
    payload: web::Json<SetTimeScale>,
) -> HttpResponse {
    let mut universe = data.universe.write().unwrap();

    println!("Set timescale to: {}", payload.time_scale);
    universe.time_scale = payload.time_scale;

    HttpResponse::Ok().body("Ok")
}
